import React from 'react';
import { AppProvider } from './contexts/AppContext';
import { useAppContext } from './contexts/AppContext';
import { Header } from './components/Header';
import { ChatInterface } from './components/ChatInterface';
import { ReasoningPanel } from './components/ReasoningPanel';
import { LoginScreen } from './components/LoginScreen';

function AppContent() {
  const { state } = useAppContext();

  if (!state.isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0">
          <ChatInterface />
        </div>
        <div className="w-96 flex-shrink-0">
          <ReasoningPanel />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;