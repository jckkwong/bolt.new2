import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { config } from '../config/config';
import type { 
  AppState, 
  AppAction, 
  Message, 
  Document, 
  Settings,
  ReasoningData 
} from '../types';

const initialState: AppState = {
  messages: [],
  documents: [],
  isLoading: false,
  error: null,
  settings: {
    apiKey: config.openai.apiKey,
    temperature: config.openai.temperature,
    maxTokens: config.openai.maxTokens,
    conversationTurns: config.conversation.maxTurns,
    retrievalCount: config.rag.maxRetrievedChunks,
    defaultResponseMode: 'quick' as 'quick' | 'detailed',
  },
  theme: config.ui.theme as 'light' | 'dark',
  reasoning: null,
  vectorDbStatus: 'disconnected',
  documentCount: 0,
  responseMode: 'quick' as 'quick' | 'detailed',
  isAuthenticated: false,
  user: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    
    case 'TOGGLE_THEME':
      return {
        ...state,
        theme: state.theme === 'light' ? 'dark' : 'light',
      };
    
    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        reasoning: null,
      };
    
    case 'ADD_DOCUMENT':
      return {
        ...state,
        documents: [...state.documents, action.payload],
      };
    
    case 'REMOVE_DOCUMENT':
      return {
        ...state,
        documents: state.documents.filter(doc => doc.id !== action.payload),
      };
    
    case 'SET_REASONING':
      return {
        ...state,
        reasoning: action.payload,
      };
    
    case 'SET_VECTOR_DB_STATUS':
      return {
        ...state,
        vectorDbStatus: action.payload,
      };
    
    case 'SET_DOCUMENT_COUNT':
      return {
        ...state,
        documentCount: action.payload,
      };
    
    case 'SET_RESPONSE_MODE':
      return {
        ...state,
        responseMode: action.payload,
        settings: {
          ...state.settings,
          defaultResponseMode: action.payload,
        },
      };
    
    case 'LOGIN':
      return {
        ...state,
        isAuthenticated: true,
        user: { username: action.payload.username },
        error: null,
      };
    
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        messages: [],
        reasoning: null,
        error: null,
      };
    
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load authentication state from localStorage on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('authState');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        if (authData.isAuthenticated && authData.user) {
          dispatch({ type: 'LOGIN', payload: { username: authData.user.username } });
        }
      } catch (error) {
        console.error('Failed to load auth state:', error);
        localStorage.removeItem('authState');
      }
    }
  }, []);

  // Save authentication state to localStorage when it changes
  useEffect(() => {
    if (state.isAuthenticated && state.user) {
      localStorage.setItem('authState', JSON.stringify({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }));
    } else {
      localStorage.removeItem('authState');
    }
  }, [state.isAuthenticated, state.user]);

  // Load response mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('responseMode') as 'quick' | 'detailed' | null;
    if (savedMode && (savedMode === 'quick' || savedMode === 'detailed')) {
      dispatch({ type: 'SET_RESPONSE_MODE', payload: savedMode });
    }
  }, []);

  // Save response mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('responseMode', state.responseMode);
  }, [state.responseMode]);

  // Apply theme to document - only when theme changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}