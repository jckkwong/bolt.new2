import React, { useState, useEffect } from 'react';
import { X, Key, Sliders, Database, TestTube } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useRAG } from '../hooks/useRAG';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { state, dispatch } = useAppContext();
  const { testConnection } = useRAG();
  const [localSettings, setLocalSettings] = useState(state.settings);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setLocalSettings(state.settings);
  }, [state.settings]);

  const handleSave = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: localSettings });
    onClose();
  };

  const handleTestConnection = async () => {
    if (!localSettings.apiKey) {
      setConnectionStatus('error');
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Update the API key temporarily for testing
      dispatch({ type: 'UPDATE_SETTINGS', payload: { apiKey: localSettings.apiKey } });
      
      const isConnected = await testConnection();
      setConnectionStatus(isConnected ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* OpenAI Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                OpenAI Configuration
              </h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={localSettings.apiKey}
                    onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || !localSettings.apiKey}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                      connectionStatus === 'success'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : connectionStatus === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                    }`}
                  >
                    <TestTube className="w-4 h-4" />
                    <span>
                      {isTestingConnection 
                        ? 'Testing...' 
                        : connectionStatus === 'success'
                        ? 'Connected'
                        : connectionStatus === 'error'
                        ? 'Failed'
                        : 'Test'
                      }
                    </span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Your OpenAI API key is stored locally and never sent to our servers.
                </p>
              </div>
            </div>
          </div>

          {/* AI Parameters */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              AI Parameters
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature: {localSettings.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={localSettings.temperature}
                  onChange={(e) => setLocalSettings({ 
                    ...localSettings, 
                    temperature: parseFloat(e.target.value) 
                  })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Controls randomness in responses
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="1000"
                  max="8000"
                  value={localSettings.maxTokens}
                  onChange={(e) => setLocalSettings({ 
                    ...localSettings, 
                    maxTokens: parseInt(e.target.value) 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum length of responses (higher values allow more detailed guides)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conversation Memory (turns)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={localSettings.conversationTurns}
                  onChange={(e) => setLocalSettings({ 
                    ...localSettings, 
                    conversationTurns: parseInt(e.target.value) 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  How many conversation turns to remember
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retrieved Chunks
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={localSettings.retrievalCount}
                  onChange={(e) => setLocalSettings({ 
                    ...localSettings, 
                    retrievalCount: parseInt(e.target.value) 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Number of document chunks to retrieve
                </p>
              </div>
            </div>
          </div>

          {/* Database Status */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-purple-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Database Status
              </h3>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`ml-2 font-medium ${
                    state.vectorDbStatus === 'connected' ? 'text-green-600' :
                    state.vectorDbStatus === 'initializing' ? 'text-yellow-600' :
                    state.vectorDbStatus === 'error' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {state.vectorDbStatus === 'connected' ? 'Connected' :
                     state.vectorDbStatus === 'initializing' ? 'Loading...' :
                     state.vectorDbStatus === 'error' ? 'Error' :
                     'Disconnected'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Documents:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {state.documents.length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Chunks:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {state.documentCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Theme:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white capitalize">
                    {state.theme}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Response Mode Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Response Preferences
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Response Mode
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setLocalSettings({ ...localSettings, defaultResponseMode: 'quick' })}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    localSettings.defaultResponseMode === 'quick'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                  }`}
                >
                  Detailed Guides
                </button>
                <button
                  onClick={() => setLocalSettings({ ...localSettings, defaultResponseMode: 'detailed' })}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    localSettings.defaultResponseMode === 'detailed'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                  }`}
                >
                  Training Manuals
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Choose your preferred response style. Detailed Guides provide step-by-step instructions with examples. Training Manuals include comprehensive templates and checklists.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}