export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Document {
  id: string;
  name: string;
  content: string;
  chunks: number;
  uploadedAt: Date;
  size: number;
}

export interface Settings {
  apiKey: string;
  temperature: number;
  maxTokens: number;
  conversationTurns: number;
  retrievalCount: number;
  defaultResponseMode: 'quick' | 'detailed';
}

export interface ReasoningData {
  originalQuery?: string;
  subtopics?: string[];
  currentStep?: 'planning' | 'retrieving' | 'synthesizing' | 'complete';
  processingSubtopics?: string[];
  completedSubtopics?: string[];
  subtopicResults?: Array<{
    subtopic: string;
    chunks: Array<{
      content: string;
      source: string;
      similarity: number;
    }>;
    status: 'pending' | 'processing' | 'complete';
  }>;
  synthesisContext?: string;
  // Legacy support for simple RAG
  retrievedChunks?: Array<{
    content: string;
    source: string;
    similarity: number;
  }>;
  processingTime: number;
  tokensUsed: number;
  model: string;
  orchestrationMode?: boolean;
}

export interface AppState {
  messages: Message[];
  documents: Document[];
  isLoading: boolean;
  error: string | null;
  settings: Settings;
  theme: 'light' | 'dark';
  reasoning: ReasoningData | null;
  vectorDbStatus: 'connected' | 'disconnected' | 'error' | 'initializing';
  documentCount: number;
  responseMode: 'quick' | 'detailed';
  isAuthenticated: boolean;
  user: { username: string } | null;
}

export type AppAction =
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'TOGGLE_THEME' }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'ADD_DOCUMENT'; payload: Document }
  | { type: 'REMOVE_DOCUMENT'; payload: string }
  | { type: 'SET_REASONING'; payload: ReasoningData | null }
  | { type: 'SET_VECTOR_DB_STATUS'; payload: 'connected' | 'disconnected' | 'error' | 'initializing' }
  | { type: 'SET_DOCUMENT_COUNT'; payload: number }
  | { type: 'SET_RESPONSE_MODE'; payload: 'quick' | 'detailed' }
  | { type: 'LOGIN'; payload: { username: string } }
  | { type: 'LOGOUT' };