import { config } from '../config/config';
import type { Document } from '../types';
import { VectorDatabase, VectorChunk } from './vectorDatabase';
import { OpenAIService } from './openai';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';

export class DocumentLoader {
  private vectorDb: VectorDatabase;
  private openaiService: OpenAIService;

  constructor(vectorDb: VectorDatabase, openaiService: OpenAIService) {
    this.vectorDb = vectorDb;
    this.openaiService = openaiService;
  }

  async loadPredefinedDocuments(): Promise<Document[]> {
    console.log('Starting to load predefined documents...');
    
    const documents: Document[] = [];
    
    // Try to get list of documents from a manifest file first
    let documentFiles: string[] = [];
    
    try {
      const manifestResponse = await fetch('/documents/manifest.json');
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        documentFiles = manifest.documents || [];
        console.log('Loaded manifest with documents:', documentFiles);
      }
    } catch (error) {
      console.warn('Failed to load manifest, using fallback list:', error);
      // Fallback to predefined list if manifest doesn't exist
      documentFiles = [
        'Claude.docx',
        'DeepSeek.docx',
        'Combined using Claude.docx',
        'GPT.docx',
        'Gemini.docx'
      ];
    }

    // Check if we need to update the vector database
    const { needsUpdate, currentHash } = await this.vectorDb.checkIfUpdateNeeded();
    
    if (!needsUpdate) {
      console.log('Vector database is up to date, skipping reload');
      // Still need to return document metadata for UI
      return await this.getDocumentMetadata(documentFiles);
    }

    console.log('Vector database needs update, loading documents...');
    
    // Clear existing data
    await this.vectorDb.clear();

    console.log('Processing document files:', documentFiles);

    try {
      // Process documents in parallel for faster loading
      const documentPromises = documentFiles.map(async (filename) => {
        try {
          console.log(`Loading document: ${filename}`);
          const content = await this.loadDocumentContent(filename);
          console.log(`Content loaded for ${filename}, length: ${content.length}`);
          const document = await this.processDocument(filename, content);
          console.log(`Document processed: ${filename}, chunks: ${document.chunks}`);
          return document;
        } catch (error) {
          console.error(`Failed to load document ${filename}:`, error);
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

      console.log(`Successfully loaded ${documents.length} documents`);
      return documents;
    } catch (error) {
      console.error('Error loading predefined documents:', error);
      throw new Error('Failed to load knowledge base documents');
    }
  }

  private async getDocumentMetadata(documentFiles?: string[]): Promise<Document[]> {
    // Return metadata for documents that are already loaded
    try {
      let files = documentFiles;
      if (!files) {
        const manifestResponse = await fetch('/documents/manifest.json');
        if (!manifestResponse.ok) {
          return [];
        }
        const manifest = await manifestResponse.json();
        files = manifest.documents || [];
      }

      return files.map((filename: string, index: number) => ({
        id: `cached_${index}`,
        name: filename,
        content: '', // Don't load full content for cached documents
        chunks: 0, // Will be updated from vector DB
        uploadedAt: new Date(),
        size: 0,
      }));
    } catch {
      return [];
    }
  }

  private async loadDocumentContent(filename: string): Promise<string> {
    console.log(`Fetching document: /documents/${filename}`);
    const response = await fetch(`/documents/${filename}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to load document: ${filename} (${response.status})`);
    }

    const extension = filename.toLowerCase().split('.').pop();
    console.log(`Processing ${filename} as ${extension} file`);
    
    if (extension === 'docx') {
      // Handle Word documents
      const arrayBuffer = await response.arrayBuffer();
      console.log(`Extracting text from ${filename}, size: ${arrayBuffer.byteLength} bytes`);
      const result = await mammoth.extractRawText({ arrayBuffer });
      console.log(`Extracted ${result.value.length} characters from ${filename}`);
      return result.value;
    } else if (extension === 'pdf') {
      // Handle PDF documents
      const arrayBuffer = await response.arrayBuffer();
      console.log(`Extracting text from PDF ${filename}, size: ${arrayBuffer.byteLength} bytes`);
      
      try {
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          text += pageText + '\n';
        }
        
        console.log(`Extracted ${text.length} characters from PDF ${filename}`);
        
        if (!text || text.trim().length === 0) {
          throw new Error(`PDF ${filename} appears to be empty or contains no extractable text`);
        }
        
        return text;
      } catch (error) {
        console.error(`Error extracting text from PDF ${filename}:`, error);
        throw new Error(`Failed to extract text from PDF ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Handle text files
      const text = await response.text();
      console.log(`Loaded ${text.length} characters from ${filename}`);
      return text;
    }
  }

  private async processDocument(filename: string, content: string): Promise<Document> {
    console.log(`Processing document: ${filename}`);
    
    if (!content || content.trim().length === 0) {
      throw new Error(`Document ${filename} is empty or could not be read`);
    }
    
    try {
      const chunks = this.chunkText(content);
      console.log(`Created ${chunks.length} chunks for ${filename}`);
      
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
        console.log(`Generating embedding for chunk ${i + 1}/${chunks.length} of ${filename}`);
        
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
          console.error(`Failed to generate embedding for chunk ${i} of ${filename}:`, error);
          throw error;
        }
      }

      console.log(`Successfully processed ${filename} with ${chunks.length} chunks`);
      return document;
    } catch (error) {
      console.error(`Error processing document ${filename}:`, error);
      throw new Error(`Failed to process document: ${filename}`);
    }
  }

  private chunkText(text: string): string[] {
    console.log(`Chunking text of length: ${text.length}`);
    const chunks: string[] = [];
    
    // Clean the text first
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split on section dividers or paragraphs
    const sections = cleanText.split(/\n\s*\n/); // Split on double newlines (paragraphs)
    console.log(`Split text into ${sections.length} sections`);
    
    for (const section of sections) {
      const trimmedSection = section.trim();
      if (trimmedSection.length < 50) continue; // Skip very short sections
      
      // If section is small enough, use as single chunk
      if (trimmedSection.length <= config.rag.chunkSize) {
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
        
        if (potentialChunk.length <= config.rag.chunkSize) {
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
    console.log(`Created ${filteredChunks.length} chunks after filtering`);
    return filteredChunks;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}