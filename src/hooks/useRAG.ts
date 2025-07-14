import { useCallback, useRef, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { OpenAIService } from '../services/openai';
import { VectorDatabase } from '../services/vectorDatabase';
import { DocumentLoader } from '../services/documentLoader';
import { config } from '../config/config';
import type { Message, ReasoningData } from '../types';

// Global services to prevent recreation
let vectorDb: VectorDatabase | null = null;
let openaiService: OpenAIService | null = null;
let documentLoader: DocumentLoader | null = null;

// Global initialization state
let isInitializing = false;
let hasInitialized = false;

export function useRAG() {
  const { state, dispatch } = useAppContext();
  const initStartedRef = useRef(false);

  const initializeServices = useCallback(() => {
    if (!vectorDb) {
      vectorDb = new VectorDatabase();
    }
    if (!openaiService) {
      openaiService = new OpenAIService(state.settings.apiKey);
    } else {
      openaiService.updateApiKey(state.settings.apiKey);
    }
    if (!documentLoader) {
      documentLoader = new DocumentLoader(vectorDb, openaiService);
    }

    return { vectorDb, openaiService, documentLoader };
  }, [state.settings.apiKey]);

  // Initialize knowledge base only once when API key is available
  useEffect(() => {
    const shouldInitialize = 
      state.settings.apiKey && 
      !isInitializing && 
      !hasInitialized && 
      !initStartedRef.current &&
      state.vectorDbStatus === 'disconnected';

    if (shouldInitialize) {
      initStartedRef.current = true;
      isInitializing = true;
      
      const initializeKnowledgeBase = async () => {
        dispatch({ type: 'SET_VECTOR_DB_STATUS', payload: 'initializing' });
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'CLEAR_ERROR' });

        try {
          const { documentLoader: dl, vectorDb: vdb } = initializeServices();
          
          await vdb!.initialize();
          const documents = await dl!.loadPredefinedDocuments();
          
          if (documents.length === 0) {
            throw new Error('No documents were loaded from the knowledge base');
          }
          
          for (const document of documents) {
            dispatch({ type: 'ADD_DOCUMENT', payload: document });
          }
          
          dispatch({ type: 'SET_DOCUMENT_COUNT', payload: vdb!.getChunkCount() });
          dispatch({ type: 'SET_VECTOR_DB_STATUS', payload: 'connected' });
          
          hasInitialized = true;
          console.log(`Knowledge base initialized with ${vdb!.getChunkCount()} chunks`);
        } catch (error) {
          console.error('Error initializing knowledge base:', error);
          dispatch({ 
            type: 'SET_ERROR', 
            payload: error instanceof Error ? error.message : 'Failed to initialize knowledge base' 
          });
          dispatch({ type: 'SET_VECTOR_DB_STATUS', payload: 'error' });
          hasInitialized = false;
          initStartedRef.current = false;
        } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
          isInitializing = false;
        }
      };

      initializeKnowledgeBase();
    }
  }, [state.settings.apiKey, state.vectorDbStatus, initializeServices, dispatch]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const { vectorDb: vdb, openaiService: oai } = initializeServices();

    if (!state.settings.apiKey) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Please configure your OpenAI API key in Settings to use the chat.' 
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      const shouldOrchestrate = content.length > 50 && (
        content.includes('compare') || 
        content.includes('difference') || 
        content.includes('vs') ||
        content.includes('versus') ||
        content.includes('which') ||
        content.includes('how') ||
        content.includes('what are') ||
        content.includes('explain') ||
        content.split(' ').length > 8
      );

      if (shouldOrchestrate && vdb!.getChunkCount() > 10) {
        await handleOrchestrationWorkflow(content, userMessage, oai!, vdb!);
      } else {
        await handleSimpleRAGWorkflow(content, userMessage, oai!, vdb!);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to send message' 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.settings.apiKey, initializeServices, dispatch]);

  const handleOrchestrationWorkflow = useCallback(async (
    content: string,
    userMessage: Message,
    oai: OpenAIService,
    vdb: VectorDatabase
  ) => {
    const startTime = Date.now();
    
    try {
      console.log('Starting orchestration workflow...');
      
      const initialReasoning: ReasoningData = {
        originalQuery: content,
        currentStep: 'planning',
        subtopics: [],
        processingSubtopics: [],
        completedSubtopics: [],
        subtopicResults: [],
        processingTime: startTime,
        tokensUsed: 0,
        model: config.openai.chatModel,
        orchestrationMode: true,
      };
      
      dispatch({ type: 'SET_REASONING', payload: initialReasoning });
      
      const subtopics = await oai.orchestrateQuery(content);
      console.log('Generated subtopics:', subtopics);
      
      const planningReasoning: ReasoningData = {
        ...initialReasoning,
        subtopics,
        subtopicResults: subtopics.map(subtopic => ({
          subtopic,
          chunks: [],
          status: 'pending' as const,
        })),
      };
      
      dispatch({ type: 'SET_REASONING', payload: planningReasoning });
      
      dispatch({ type: 'SET_REASONING', payload: {
        ...planningReasoning,
        currentStep: 'retrieving',
        processingSubtopics: [...subtopics],
      }});
      
      const retrievalPromises = subtopics.map(async (subtopic, index) => {
        try {
          dispatch({ type: 'SET_REASONING', payload: {
            ...planningReasoning,
            currentStep: 'retrieving',
            processingSubtopics: subtopics.filter((_, i) => i >= index),
            completedSubtopics: subtopics.filter((_, i) => i < index),
            subtopicResults: planningReasoning.subtopicResults!.map((result, i) => 
              i === index ? { ...result, status: 'processing' as const } : result
            ),
          }});
          
          const embedding = await oai.generateEmbedding(subtopic);
          const searchResults = await vdb.search(embedding, Math.ceil(state.settings.retrievalCount / subtopics.length) + 1);
          
          const chunks = searchResults.map(result => ({
            content: result.chunk.content,
            source: result.chunk.metadata.source,
            similarity: result.similarity,
          }));
          
          return { subtopic, chunks, status: 'complete' as const };
        } catch (error) {
          console.error(`Error retrieving for subtopic "${subtopic}":`, error);
          return { 
            subtopic, 
            chunks: [], 
            status: 'complete' as const 
          };
        }
      });
      
      const subtopicResults = await Promise.all(retrievalPromises);
      
      const synthesisReasoning: ReasoningData = {
        ...planningReasoning,
        currentStep: state.responseMode === 'quick' ? 'synthesizing' : 'generating_report',
        processingSubtopics: [],
        completedSubtopics: subtopics,
        subtopicResults,
      };
      
      dispatch({ type: 'SET_REASONING', payload: synthesisReasoning });
      
      const recentMessages = state.messages.slice(-state.settings.conversationTurns * 2);
      
      let response: string;
      let tokensUsed: number;
      
      if (state.responseMode === 'quick') {
        const result = await oai.synthesizeQuickResponse(
          content,
          subtopicResults,
          [...recentMessages, userMessage],
          {
            temperature: state.settings.temperature,
            maxTokens: state.settings.maxTokens,
          }
        );
        response = result.response;
        tokensUsed = result.tokensUsed;
      } else {
        const result = await oai.generateDetailedReport(
          content,
          subtopicResults,
          [...recentMessages, userMessage],
          {
            temperature: state.settings.temperature,
            maxTokens: state.settings.maxTokens * 2, // Allow more tokens for detailed reports
          }
        );
        response = result.response;
        tokensUsed = result.tokensUsed;
      }
      
      const finalReasoning: ReasoningData = {
        ...synthesisReasoning,
        currentStep: 'complete',
        processingTime: Date.now() - startTime,
        tokensUsed,
        synthesisContext: state.responseMode === 'quick' 
          ? `Quick summary from ${subtopicResults.length} subtopics with ${subtopicResults.reduce((acc, result) => acc + result.chunks.length, 0)} total chunks`
          : `Detailed report from ${subtopicResults.length} subtopics with ${subtopicResults.reduce((acc, result) => acc + result.chunks.length, 0)} total chunks`,
      };
      
      dispatch({ type: 'SET_REASONING', payload: finalReasoning });
      
      const assistantMessage: Message & { responseMode?: 'quick' | 'detailed' } = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        responseMode: state.responseMode,
      };
      
      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
      
    } catch (error) {
      console.error('Orchestration workflow failed, falling back to simple RAG:', error);
      await handleSimpleRAGWorkflow(content, userMessage, oai, vdb);
    }
  }, [state.messages, state.settings, state.responseMode, dispatch]);

  const handleSimpleRAGWorkflow = useCallback(async (
    content: string,
    userMessage: Message,
    oai: OpenAIService,
    vdb: VectorDatabase
  ) => {
    try {
      const queryEmbedding = await oai.generateEmbedding(content);
      const searchResults = await vdb.search(queryEmbedding, state.settings.retrievalCount);
      
      const context = searchResults.length > 0 
        ? searchResults
            .map(result => `[Source: ${result.chunk.metadata.source}]\n${result.chunk.content}`)
            .join('\n\n')
        : 'No specific context available from knowledge base. Please provide a general response about AI models.';

      const recentMessages = state.messages.slice(-state.settings.conversationTurns * 2);

      let response: string;
      let reasoning: ReasoningData;
      
      if (state.responseMode === 'quick') {
        const result = await oai.generateQuickResponse(
          [...recentMessages, userMessage],
          context,
          {
            temperature: state.settings.temperature,
            maxTokens: Math.max(state.settings.maxTokens, 2000), // Ensure enough tokens for detailed guides
          }
        );
        response = result.response;
        reasoning = result.reasoning;
      } else {
        const result = await oai.generateDetailedResponse(
          [...recentMessages, userMessage],
          context,
          {
            temperature: state.settings.temperature,
            maxTokens: Math.max(state.settings.maxTokens * 2, 4000), // Ensure enough tokens for training manuals
          }
        );
        response = result.response;
        reasoning = result.reasoning;
      }

      const updatedReasoning = {
        ...reasoning,
        retrievedChunks: searchResults.length > 0 
          ? searchResults.map(result => ({
              content: result.chunk.content.substring(0, 200) + '...',
              source: result.chunk.metadata.source,
              similarity: result.similarity,
            }))
          : [{
              content: 'No knowledge base context retrieved',
              source: 'General AI Knowledge',
              similarity: 0,
            }],
      };

      dispatch({ type: 'SET_REASONING', payload: updatedReasoning });

      const assistantMessage: Message & { responseMode?: 'quick' | 'detailed' } = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        responseMode: state.responseMode,
      };

      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
    } catch (error) {
      throw error;
    }
  }, [state.messages, state.settings, state.responseMode, dispatch]);

  const clearConversation = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, [dispatch]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    const { openaiService: oai } = initializeServices();
    
    try {
      return await oai!.testConnection();
    } catch {
      return false;
    }
  }, [initializeServices]);

  return {
    sendMessage,
    clearConversation,
    testConnection,
  };
}