import { config } from '../config/config';

export interface VectorChunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    chunkIndex: number;
    timestamp: number;
  };
}

export interface SearchResult {
  chunk: VectorChunk;
  similarity: number;
}

interface StoredVectorData {
  chunks: Array<VectorChunk>;
  manifestHash: string;
  timestamp: number;
  version: string;
}

export class VectorDatabase {
  private chunks: Map<string, VectorChunk> = new Map();
  private isInitialized = false;
  private readonly STORAGE_KEY = 'vectordb_data';
  private readonly VERSION = '1.0.0';

  async initialize(): Promise<void> {
    try {
      // Try to load from localStorage first
      const stored = this.loadFromStorage();
      if (stored) {
        console.log(`Loaded ${stored.chunks.length} chunks from storage`);
        for (const chunk of stored.chunks) {
          this.chunks.set(chunk.id, chunk);
        }
      }
      
      this.isInitialized = true;
      console.log('Vector database initialized');
    } catch (error) {
      console.error('Failed to initialize vector database:', error);
      throw error;
    }
  }

  private loadFromStorage(): StoredVectorData | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const data: StoredVectorData = JSON.parse(stored);
      
      // Check if data is still valid (not too old and same version)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const isExpired = Date.now() - data.timestamp > maxAge;
      const isWrongVersion = data.version !== this.VERSION;
      
      if (isExpired || isWrongVersion) {
        console.log('Stored vector data is expired or wrong version, clearing...');
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error loading from storage:', error);
      localStorage.removeItem(this.STORAGE_KEY);
      return null;
    }
  }

  private saveToStorage(manifestHash: string): void {
    try {
      const data: StoredVectorData = {
        chunks: Array.from(this.chunks.values()),
        manifestHash,
        timestamp: Date.now(),
        version: this.VERSION,
      };

      const serialized = JSON.stringify(data);
      
      // Check if we're approaching localStorage limit (usually 5-10MB)
      if (serialized.length > 4 * 1024 * 1024) { // 4MB limit
        console.warn('Vector data is large, may hit localStorage limits');
      }
      
      localStorage.setItem(this.STORAGE_KEY, serialized);
      console.log(`Saved ${data.chunks.length} chunks to storage`);
    } catch (error) {
      console.error('Error saving to storage:', error);
      // If storage fails, continue without persistence
    }
  }

  async checkIfUpdateNeeded(): Promise<{ needsUpdate: boolean; currentHash?: string }> {
    try {
      // If we already have chunks loaded and they're recent, don't update
      if (this.chunks.size > 0) {
        const stored = this.loadFromStorage();
        if (stored && Date.now() - stored.timestamp < 60 * 60 * 1000) { // 1 hour
          return { needsUpdate: false };
        }
      }

      // Create a simple hash based on file list and timestamp
      const fileList = [
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
      const currentHash = this.hashManifest({ documents: fileList });

      // Check stored data
      const stored = this.loadFromStorage();
      if (!stored || stored.manifestHash !== currentHash || this.chunks.size === 0) {
        return { needsUpdate: true, currentHash };
      }

      return { needsUpdate: false, currentHash };
    } catch (error) {
      console.error('❌ Error checking update status:', error);
      return { needsUpdate: true };
    }
  }

  private hashManifest(manifest: any): string {
    // Simple hash function for manifest
    const str = JSON.stringify(manifest);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  async addChunk(chunk: VectorChunk): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`Adding chunk to vector DB: ${chunk.id} from ${chunk.metadata.source}`);
    this.chunks.set(chunk.id, chunk);
  }

  async removeChunksBySource(source: string): Promise<void> {
    const chunksToRemove = Array.from(this.chunks.values())
      .filter(chunk => chunk.metadata.source === source);

    for (const chunk of chunksToRemove) {
      this.chunks.delete(chunk.id);
    }
    
    console.log(`Removed ${chunksToRemove.length} chunks from source: ${source}`);
  }

  async search(queryEmbedding: number[], limit: number = config.rag.maxRetrievedChunks): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`Searching vector DB with ${this.chunks.size} chunks, limit: ${limit}`);

    const results: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      
      if (similarity >= config.rag.similarityThreshold) {
        results.push({ chunk, similarity });
      }
    }

    // Sort by similarity (highest first) and limit results
    return results
      .filter(result => result.similarity > 0.1) // Filter out very low similarity results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getChunkCount(): number {
    return this.chunks.size;
  }

  getStatus(): 'connected' | 'disconnected' | 'error' | 'initializing' {
    return this.isInitialized ? 'connected' : 'disconnected';
  }

  async clear(): Promise<void> {
    console.log(`Clearing vector database with ${this.chunks.size} chunks`);
    this.chunks.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  async finalizeBatch(manifestHash: string): Promise<void> {
    // Save to storage after all chunks are added
    this.saveToStorage(manifestHash);
  }
}