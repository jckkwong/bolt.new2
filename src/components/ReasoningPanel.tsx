import React from 'react';
import { useMemo } from 'react';
import { Brain, Clock, Zap, FileText, TrendingUp, GitBranch, CheckCircle, Loader2, Target, Layers, FileSearch } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

export function ReasoningPanel() {
  const { state } = useAppContext();

  const getSubtopicStatus = useMemo(() => (subtopic: string) => {
    if (!state.reasoning?.subtopicResults) return 'pending';
    const result = state.reasoning.subtopicResults.find(r => r.subtopic === subtopic);
    return result?.status || 'pending';
  }, [state.reasoning?.subtopicResults]);

  const getStepIcon = useMemo(() => (step: string, currentStep?: string) => {
    if (currentStep === step) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />;
    } else if (currentStep && ['planning', 'retrieving', 'synthesizing', 'complete'].indexOf(currentStep) > ['planning', 'retrieving', 'synthesizing', 'complete'].indexOf(step)) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else {
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  }, []);

  if (!state.reasoning && state.documents.length === 0) {
    return (
      <div className="h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Brain className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Training Process
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm max-w-sm">
            Start a conversation to see how the AI creates detailed step-by-step training guides with examples and templates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {state.reasoning?.orchestrationMode ? (
            <GitBranch className="w-5 h-5 text-purple-600" />
          ) : (
            <Brain className="w-5 h-5 text-purple-600" />
          )}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {state.reasoning?.orchestrationMode ? 'Multi-Agent Training' : 'Training Guide Process'}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {state.reasoning?.orchestrationMode 
            ? 'Creating comprehensive guides from multiple sources'
            : 'Building detailed step-by-step instructions'
          }
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {state.reasoning?.orchestrationMode && (
          <>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-4">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Training Guide Creation
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  {getStepIcon('planning', state.reasoning.currentStep)}
                  <span className={`text-sm ${
                    state.reasoning.currentStep === 'planning' ? 'text-blue-600 font-medium' :
                    ['retrieving', 'synthesizing', 'complete'].includes(state.reasoning.currentStep || '') ? 'text-green-600' :
                    'text-gray-500'
                  }`}>
                    Breaking Down Question
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {getStepIcon('retrieving', state.reasoning.currentStep)}
                  <span className={`text-sm ${
                    state.reasoning.currentStep === 'retrieving' ? 'text-blue-600 font-medium' :
                    ['synthesizing', 'complete'].includes(state.reasoning.currentStep || '') ? 'text-green-600' :
                    'text-gray-500'
                  }`}>
                    Gathering Information ({state.reasoning.completedSubtopics?.length || 0}/{state.reasoning.subtopics?.length || 0})
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {getStepIcon('synthesizing', state.reasoning.currentStep)}
                  <span className={`text-sm ${
                    ['synthesizing', 'generating_report'].includes(state.reasoning.currentStep || '') ? 'text-blue-600 font-medium' :
                    state.reasoning.currentStep === 'complete' ? 'text-green-600' :
                    'text-gray-500'
                  }`}>
                    {state.responseMode === 'quick' ? 'Creating Detailed Guide' : 'Building Training Manual'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {getStepIcon('complete', state.reasoning.currentStep)}
                  <span className={`text-sm ${
                    state.reasoning.currentStep === 'complete' ? 'text-green-600 font-medium' : 'text-gray-500'
                  }`}>
                    Complete
                  </span>
                </div>
              </div>
            </div>

            {state.reasoning.originalQuery && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Target className="w-4 h-4 text-orange-600" />
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Question Analysis
                  </h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Original Question
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-white dark:bg-gray-800 rounded border">
                      {state.reasoning.originalQuery}
                    </p>
                  </div>
                  {state.reasoning.subtopics && state.reasoning.subtopics.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Research Areas ({state.reasoning.subtopics.length})
                      </span>
                      <div className="mt-2 space-y-2">
                        {state.reasoning.subtopics.map((subtopic, index) => {
                          const status = getSubtopicStatus(subtopic);
                          return (
                            <div key={index} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded border">
                              <div className={`w-2 h-2 rounded-full ${
                                status === 'complete' ? 'bg-green-500' :
                                status === 'processing' ? 'bg-blue-500 animate-pulse' :
                                'bg-gray-300'
                              }`} />
                              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                                {subtopic}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                status === 'complete' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                status === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                                {status === 'complete' ? 'Done' :
                                 status === 'processing' ? 'Processing...' :
                                 'Pending'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {state.reasoning.subtopicResults && state.reasoning.subtopicResults.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Information Gathered
                  </h3>
                </div>
                <div className="space-y-4">
                  {state.reasoning.subtopicResults.map((result, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {result.subtopic}
                        </h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {result.chunks.length} sources
                        </span>
                      </div>
                      {result.chunks.length > 0 ? (
                        <div className="space-y-2">
                          {result.chunks.slice(0, 2).map((chunk, chunkIndex) => (
                            <div key={chunkIndex} className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                  {chunk.source}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">
                                  {(chunk.similarity * 100).toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {chunk.content.substring(0, 150)}...
                              </p>
                            </div>
                          ))}
                          {result.chunks.length > 2 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                              +{result.chunks.length - 2} more sources
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          No relevant information found for this area
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.reasoning.synthesisContext && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  {state.responseMode === 'quick' ? (
                    <Zap className="w-4 h-4 text-green-600" />
                  ) : (
                    <FileSearch className="w-4 h-4 text-purple-600" />
                  )}
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {state.responseMode === 'quick' ? 'Guide Creation Process' : 'Manual Creation Process'}
                  </h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {state.reasoning.synthesisContext}
                </p>
              </div>
            )}
          </>
        )}

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              Knowledge Base
            </h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Documents:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {state.documents.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Chunks:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {state.documentCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className={`font-medium ${
                state.vectorDbStatus === 'connected' ? 'text-green-600' :
                state.vectorDbStatus === 'initializing' ? 'text-yellow-600' :
                state.vectorDbStatus === 'error' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {state.vectorDbStatus === 'connected' ? 'Ready' :
                 state.vectorDbStatus === 'initializing' ? 'Loading...' :
                 state.vectorDbStatus === 'error' ? 'Error' :
                 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {state.documents.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              Available Documents
            </h3>
            <div className="space-y-2">
              {state.documents.slice(0, 8).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 truncate">
                    {doc.name.replace(/\.(txt|docx|pdf)$/, '')}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {doc.chunks} chunks
                  </span>
                </div>
              ))}
              {state.documents.length > 8 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  +{state.documents.length - 8} more documents
                </p>
              )}
            </div>
          </div>
        )}

        {state.reasoning && !state.reasoning.orchestrationMode && state.reasoning.retrievedChunks && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <h3 className="font-medium text-gray-900 dark:text-white">
                Information Sources
              </h3>
            </div>
            <div className="space-y-3">
              {state.reasoning.retrievedChunks.map((chunk, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {chunk.source}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {(chunk.similarity * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.reasoning && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-600" />
              <h3 className="font-medium text-gray-900 dark:text-white">
                Processing Stats
              </h3>
            </div>
            <div className="space-y-2 text-sm">
              {state.reasoning.orchestrationMode && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Mode:</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">
                    Multi-Agent Training
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Response Type:</span>
                <span className={`font-medium ${
                  state.responseMode === 'quick' ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'
                }`}>
                  {state.responseMode === 'quick' ? 'Detailed Guide' : 'Training Manual'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Model:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {state.reasoning.model}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tokens Used:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {state.reasoning.tokensUsed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Response Time:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {state.reasoning.currentStep === 'complete' 
                    ? `${(state.reasoning.processingTime / 1000).toFixed(2)}s`
                    : `${((Date.now() - (state.reasoning.processingTime || Date.now())) / 1000).toFixed(1)}s`
                  }
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}