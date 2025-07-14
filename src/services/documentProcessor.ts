import { config } from '../config/config';
import type { Document } from '../types';
import { VectorDatabase, VectorChunk } from './vectorDatabase';
import { OpenAIService } from './openai';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';

export class DocumentProcessor {
  private vectorDb: VectorDatabase;
  private openaiService: OpenAIService;

  constructor(vectorDb: VectorDatabase, openaiService: OpenAIService) {
    this.vectorDb = vectorDb;
    this.openaiService = openaiService;
  }

  async processDocument(file: File): Promise<Document> {
    try {
      const content = await this.extractTextFromFile(file);
      const chunks = this.chunkText(content);
      
      const document: Document = {
        id: this.generateId(),
        name: file.name,
        content,
        chunks: chunks.length,
        uploadedAt: new Date(),
        size: file.size,
      };

      // Generate embeddings for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
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
      }

      return document;
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractTextFromFile(file: File): Promise<string> {
    const extension = file.name.toLowerCase().split('.').pop();

    switch (extension) {
      case 'txt':
      case 'md':
        return await file.text();
      
      case 'docx':
        // Note: For file uploads, you would need mammoth.js here too
        // This is a fallback for the file upload functionality
        throw new Error('DOCX file upload processing not implemented in this demo. Please use the pre-loaded documents.');
      
      case 'pdf':
        // Handle PDF file uploads
        const arrayBuffer = await file.arrayBuffer();
        
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
          
          if (!text || text.trim().length === 0) {
            throw new Error(`PDF ${file.name} appears to be empty or contains no extractable text`);
          }
          
          return text;
        } catch (error) {
          console.error(`Error extracting text from uploaded PDF ${file.name}:`, error);
          throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
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
    
    return chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  async removeDocument(documentName: string): Promise<void> {
    await this.vectorDb.removeChunksBySource(documentName);
  }

  validateFile(file: File): { valid: boolean; error?: string } {
    const extension = '.' + file.name.toLowerCase().split('.').pop();
    
    if (!config.files.supportedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Unsupported file type. Supported types: ${config.files.supportedExtensions.join(', ')}`
      };
    }
    
    if (file.size > config.files.maxFileSize) {
      return {
        valid: false,
        error: `File too large. Maximum size: ${config.files.maxFileSize / (1024 * 1024)}MB`
      };
    }
    
    return { valid: true };
  }
}