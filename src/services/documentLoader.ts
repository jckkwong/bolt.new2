import { config } from '../config/config';
import type { Document } from '../types';
import { VectorDatabase, VectorChunk } from './vectorDatabase';
import { OpenAIService } from './openai';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';

// Define list of files to process automatically
const DOCUMENT_FILES = [
  'Claude.docx',
  'DeepSeek.docx', 
  'Combined using Claude.docx',
  'Combined using Gemini.docx',
  'GPT.docx',
  'Gemini.docx',
  'Moller D. Guide to Cybersecurity in Digital Transformation...Best Practices 2023.pdf',
  'Singh T. Digital Resilience, Cybersecurity and Supply Chains 2025.pdf',
  'Dunham K. Cyber CISO Marksmanship. Hitting the Mark in Cybersecurity...2025.pdf',
  'Baker D. A CISO Guide to Cyber Resilience. A how-to guide for every CISO...2024.pdf',
  'Aslaner M. Cybersecurity Strategies and Best Practices...2024.pdf',
  'Crelin J. Principles of Cybersecurity 2024.pdf',
  'Faisal J. Dark Web Secrets. Ethical Hacking and Cybersecurity...Ex-Hacker 2025.pdf',
  'Kaushik K. Advanced Techniques and Applications of Cybersecurity & Forensics 2025.pdf',
  'CybersecurityFundamental - Oppos Class.pdf'
];

export class DocumentLoader {
  private vectorDb: VectorDatabase;
  private openaiService: OpenAIService;

  constructor(vectorDb: VectorDatabase, openaiService: OpenAIService) {
    this.vectorDb = vectorDb;
    this.openaiService = openaiService;
  }

  async loadPredefinedDocuments(): Promise<Document[]> {
    console.log('🚀 Starting automatic vectorization of documents...');
    
    const documents: Document[] = [];

    // Check if we need to update the vector database
    const { needsUpdate, currentHash } = await this.vectorDb.checkIfUpdateNeeded();
    
    if (!needsUpdate) {
      console.log('📚 Vector database is up to date, skipping reload');
      // Still need to return document metadata for UI
      return await this.getDocumentMetadata(DOCUMENT_FILES);
    }

    console.log('🔄 Vector database needs update, processing documents...');
    
    // Clear existing data
    await this.vectorDb.clear();

    console.log(`📄 Processing ${DOCUMENT_FILES.length} document files:`, DOCUMENT_FILES);

    try {
      // Process documents in parallel for faster loading
      const documentPromises = DOCUMENT_FILES.map(async (filename) => {
        try {
          console.log(`📖 Processing: ${filename}`);
          const content = await this.loadDocumentContent(filename);
          console.log(`📝 Text extracted from ${filename}: ${content.length} characters`);
          const document = await this.processDocument(filename, content);
          console.log(`✅ Vectorized ${filename}: ${document.chunks} chunks`);
          return document;
        } catch (error) {
          console.error(`❌ Failed to process ${filename}:`, error);
          return null;
        }
      });

      const results = await Promise.all(documentPromises);
      const successfulDocuments = results.filter((doc): doc is Document => doc !== null);
      
      documents.push(...successfulDocuments);

      // Finalize the batch save
      if (currentHash) {
        await this.vectorDb.finalizeBatch(currentHash);
      }

      console.log(`✅ Vectorization complete: ${documents.length}/${DOCUMENT_FILES.length} documents processed successfully`);
      console.log(`📊 Total chunks created: ${documents.reduce((sum, doc) => sum + doc.chunks, 0)}`);
      
      return documents;
    } catch (error) {
      console.error('❌ Error during vectorization:', error);
      throw new Error('Failed to load knowledge base documents');
    }
  }

  private async getDocumentMetadata(documentFiles?: string[]): Promise<Document[]> {
    // Return metadata for documents that are already loaded
    const files = documentFiles || DOCUMENT_FILES;
    
    return files.map((filename: string, index: number) => ({
        id: `cached_${index}`,
        name: filename,
        content: '', // Don't load full content for cached documents
        chunks: 0, // Will be updated from vector DB
        uploadedAt: new Date(),
        size: 0,
    }));
  }

  private async loadDocumentContent(filename: string): Promise<string> {
    console.log(`🔍 Fetching: /documents/${filename}`);
    const response = await fetch(`/documents/${filename}`);
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to load document: ${filename} (${response.status})`);
    }

    const extension = filename.toLowerCase().split('.').pop();
    console.log(`🔧 Processing ${filename} as ${extension?.toUpperCase()} file`);
    
    if (extension === 'docx') {
      // Handle Word documents
      const arrayBuffer = await response.arrayBuffer();
      console.log(`📄 DOCX size: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
      
      // Use mammoth to extract HTML then convert to text
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const textContent = result.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      console.log(`📝 Extracted ${textContent.length} characters from DOCX`);
      return result.value;
    } else if (extension === 'pdf') {
      // Handle PDF documents
      const arrayBuffer = await response.arrayBuffer();
      console.log(`📄 PDF size: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);
      
      try {
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        console.log(`📖 PDF has ${pdf.numPages} pages`);
        let text = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          text += pageText + '\n';
        }
        
        console.log(`📝 Extracted ${text.length} characters from PDF`);
        
        if (!text || text.trim().length === 0) {
          throw new Error(`PDF ${filename} appears to be empty or contains no extractable text`);
        }
        
        return text;
      } catch (error) {
        console.error(`❌ Error extracting text from PDF ${filename}:`, error);
        throw new Error(`Failed to extract text from PDF ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Handle text files
      const text = await response.text();
      console.log(`📝 Loaded ${text.length} characters from text file`);
      return text;
    }
  }

  private async processDocument(filename: string, content: string): Promise<Document> {
    console.log(`⚙️ Creating chunks for: ${filename}`);
    
    if (!content || content.trim().length === 0) {
      throw new Error(`Document ${filename} is empty or could not be read`);
    }
    
    try {
      const chunks = this.chunkText(content, filename);
      console.log(`📦 Created ${chunks.length} chunks (~500 tokens each)`);
      
      const document: Document = {
        id: this.generateId(),
        name: filename,
        content,
        chunks: chunks.length,
        uploadedAt: new Date(),
        size: content.length,
      };

      // Generate embeddings for each chunk with rate limiting
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`🧠 Generating embedding ${i + 1}/${chunks.length} for ${filename}`);
        
        try {
          const embedding = await this.openaiService.generateEmbedding(chunk);
          
          const vectorChunk: VectorChunk = {
            id: `${document.id}_chunk_${i}`,
            content: chunk,
            embedding,
            metadata: {
              source: document.name,
              chunkIndex: i,
              timestamp: Date.now(),
            },
          };

          await this.vectorDb.addChunk(vectorChunk);
          
          // Add small delay to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`❌ Failed to generate embedding for chunk ${i + 1} of ${filename}:`, error);
          throw error;
        }
      }

      return document;
    } catch (error) {
      console.error(`❌ Error processing document ${filename}:`, error);
      throw new Error(`Failed to process document: ${filename}`);
    }
  }

  private chunkText(text: string, filename: string): string[] {
    console.log(`✂️ Chunking text (${text.length} chars) from ${filename}`);
    const chunks: string[] = [];
    
    // Clean the text first
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Aim for ~500 token chunks (roughly 2000 characters)
    const targetChunkSize = 2000;
    const sections = cleanText.split(/\n\s*\n/);
    console.log(`📄 Split into ${sections.length} sections`);
    
    for (const section of sections) {
      const trimmedSection = section.trim();
      if (trimmedSection.length < 50) continue; // Skip very short sections
      
      // If section is small enough, use as single chunk
      if (trimmedSection.length <= targetChunkSize) {
        chunks.push(trimmedSection);
        continue;
      }
      
      // Split larger sections into smaller chunks
      const sentences = trimmedSection.split(/[.!?]+/).filter(s => s.trim().length > 0);
      let currentChunk = '';
      
      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;
        
        const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;
        
        if (potentialChunk.length <= targetChunkSize) {
          currentChunk = potentialChunk;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk + '.');
          }
          currentChunk = trimmedSentence;
        }
      }
      
      if (currentChunk) {
        chunks.push(currentChunk + '.');
      }
    }
    
    const filteredChunks = chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
    console.log(`📦 Final result: ${filteredChunks.length} chunks (~500 tokens each)`);
    return filteredChunks;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}