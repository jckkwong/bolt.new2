import React, { useState } from 'react';
import { Settings, MessageSquare, Sun, Moon, Zap, Brain, LogOut, User } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { SettingsPanel } from './SettingsPanel';
import { useRAG } from '../hooks/useRAG';

export function Header() {
  const { state, dispatch } = useAppContext();
  const { clearConversation } = useRAG();
  const [showSettings, setShowSettings] = useState(false);

  const handleNewChat = () => {
    clearConversation();
  };

  const handleToggleTheme = () => {
    dispatch({ type: 'TOGGLE_THEME' });
  };

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  const getStatusColor = () => {
    switch (state.vectorDbStatus) {
      case 'connected': return 'text-green-500';
      case 'initializing': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Cybersecurity Training Assistant
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Step-by-Step Guidance for Junior Staff
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Status Indicators */}
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <Brain className={`w-4 h-4 ${getStatusColor()}`} />
                <span className="text-gray-600 dark:text-gray-300">
                  {state.vectorDbStatus === 'connected' ? 'Knowledge Base Ready' :
                   state.vectorDbStatus === 'initializing' ? 'Loading Knowledge Base...' :
                   state.vectorDbStatus === 'error' ? 'Knowledge Base Error' :
                   'Knowledge Base Disconnected'}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  state.settings.apiKey ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-gray-600 dark:text-gray-300">
                  {state.settings.apiKey ? 'API Connected' : 'API Key Required'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {/* User Info */}
              <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {state.user?.username}
                </span>
              </div>

              <button
                onClick={handleNewChat}
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>New Chat</span>
              </button>

              <button
                onClick={handleToggleTheme}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {state.theme === 'light' ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>

              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </>
  );
}