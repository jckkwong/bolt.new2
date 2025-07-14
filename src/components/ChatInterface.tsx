import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMemo } from 'react';
import { Send, FileText, Loader2, Database, Zap } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useRAG } from '../hooks/useRAG';
import { ChatMessage } from './ChatMessage';

export function ChatInterface() {
  const { state, dispatch } = useAppContext();
  const { sendMessage } = useRAG();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isKnowledgeBaseReady, isInitializing, hasApiKey, canSendMessage } = useMemo(() => {
    const ready = state.vectorDbStatus === 'connected';
    const initializing = state.vectorDbStatus === 'initializing';
    const apiKey = !!state.settings.apiKey;
    const canSend = apiKey && ready && !state.isLoading;
    
    return {
      isKnowledgeBaseReady: ready,
      isInitializing: initializing,
      hasApiKey: apiKey,
      canSendMessage: canSend,
    };
  }, [state.vectorDbStatus, state.settings.apiKey, state.isLoading]);
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !canSendMessage) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const setResponseMode = (mode: 'quick' | 'detailed') => {
    dispatch({ type: 'SET_RESPONSE_MODE', payload: mode });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {state.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Welcome to Cybersecurity Training Assistant
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
              Ask questions about AI models and cybersecurity. Get detailed step-by-step guides 
              with examples, checklists, and templates designed for junior staff training.
            </p>
            {!hasApiKey ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 max-w-md">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  Please configure your OpenAI API key in Settings to enable the knowledge base.
                </p>
              </div>
            ) : isInitializing ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-md">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <div>
                    <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
                      Loading Knowledge Base...
                    </p>
                    <p className="text-blue-600 dark:text-blue-300 text-xs mt-1">
                      Processing {state.documents.length} documents. Please wait.
                    </p>
                  </div>
                </div>
              </div>
            ) : state.vectorDbStatus === 'error' ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-md">
                <p className="text-red-800 dark:text-red-200 text-sm">
                  Failed to load knowledge base. Please check your API key and try again.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {state.messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {state.isLoading && (
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {state.reasoning?.orchestrationMode 
                    ? state.reasoning.currentStep === 'planning' 
                      ? 'Breaking down your question...'
                      : state.reasoning.currentStep === 'retrieving'
                      ? `Searching knowledge base (${state.reasoning.completedSubtopics?.length || 0}/${state.reasoning.subtopics?.length || 0} subtopics)...`
                      : state.reasoning.currentStep === 'synthesizing'
                      ? 'Creating comprehensive guide...'
                      : 'Processing...'
                    : 'Creating detailed guide...'
                  }
                </span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="mx-6 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm">{state.error}</p>
        </div>
      )}

      {/* Response Mode Selection */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Response Detail:
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setResponseMode('quick')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  state.responseMode === 'quick'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>Detailed Guide</span>
                </div>
              </button>
              <button
                onClick={() => setResponseMode('detailed')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  state.responseMode === 'detailed'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <FileText className="w-3 h-3" />
                  <span>Training Manual</span>
                </div>
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            {state.responseMode === 'quick' ? (
              <>
                <Zap className="w-3 h-3" />
                <span>Step-by-step guides with examples</span>
              </>
            ) : (
              <>
                <FileText className="w-3 h-3" />
                <span>Complete training manuals with templates</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        {!canSendMessage && hasApiKey && (
          <div className="mb-4">
            {isInitializing ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-blue-800 dark:text-blue-200 text-sm">
                    Loading knowledge base... ({state.documents.length} documents processed)
                  </span>
                </div>
              </div>
            ) : state.vectorDbStatus === 'error' ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <span className="text-red-800 dark:text-red-200 text-sm">
                  Knowledge base failed to load. Please check your settings.
                </span>
              </div>
            ) : null}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                !hasApiKey ? "Please configure your API key in Settings..." :
                isInitializing ? "Loading knowledge base..." :
                state.vectorDbStatus === 'error' ? "Knowledge base error - check settings..." :
                "Ask about cybersecurity, AI models, or request step-by-step guidance..."
              }
              className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                canSendMessage 
                  ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700' 
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-not-allowed'
              }`}
              disabled={!canSendMessage}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || !canSendMessage}
            className={`px-6 py-3 rounded-lg transition-colors flex items-center space-x-2 text-white ${
              canSendMessage && input.trim()
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isInitializing ? 'Loading...' : 'Send'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}