import React, { useState } from 'react';
import { User, Bot, Copy, Check, Zap, FileText, Download } from 'lucide-react';
import Markdown from 'markdown-to-jsx';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Custom components for markdown-to-jsx
  const markdownOptions = {
    overrides: {
      h1: {
        component: ({ children, ...props }: any) => (
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 mt-6 border-b border-gray-200 dark:border-gray-700 pb-2">
            {children}
          </h1>
        ),
      },
      h2: {
        component: ({ children, ...props }: any) => (
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-5">
            {children}
          </h2>
        ),
      },
      h3: {
        component: ({ children, ...props }: any) => (
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 mt-4">
            {children}
          </h3>
        ),
      },
      h4: {
        component: ({ children, ...props }: any) => (
          <h4 className="text-base font-medium text-gray-900 dark:text-white mb-2 mt-3">
            {children}
          </h4>
        ),
      },
      h5: {
        component: ({ children, ...props }: any) => (
          <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2 mt-3">
            {children}
          </h5>
        ),
      },
      h6: {
        component: ({ children, ...props }: any) => (
          <h6 className="text-xs font-medium text-gray-900 dark:text-white mb-2 mt-3">
            {children}
          </h6>
        ),
      },
      p: {
        component: ({ children, ...props }: any) => (
          <p className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed">
            {children}
          </p>
        ),
      },
      ul: {
        component: ({ children, ...props }: any) => (
          <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300 ml-4">
            {children}
          </ul>
        ),
      },
      ol: {
        component: ({ children, ...props }: any) => (
          <ol className="list-decimal list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300 ml-4">
            {children}
          </ol>
        ),
      },
      li: {
        component: ({ children, ...props }: any) => (
          <li className="mb-1 leading-relaxed">{children}</li>
        ),
      },
      strong: {
        component: ({ children, ...props }: any) => (
          <strong className="font-semibold text-gray-900 dark:text-white">
            {children}
          </strong>
        ),
      },
      em: {
        component: ({ children, ...props }: any) => (
          <em className="italic text-gray-800 dark:text-gray-200">
            {children}
          </em>
        ),
      },
      code: {
        component: ({ children, ...props }: any) => (
          <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
            {children}
          </code>
        ),
      },
      pre: {
        component: ({ children, ...props }: any) => (
          <div className="mb-4 relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  const text = typeof children === 'string' ? children : 
                    children?.props?.children || '';
                  navigator.clipboard.writeText(String(text));
                }}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs flex items-center space-x-1"
                title="Copy code"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            </div>
            <pre className="bg-gray-900 dark:bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm leading-relaxed border border-gray-200 dark:border-gray-700">
              {children}
            </pre>
          </div>
        ),
      },
      blockquote: {
        component: ({ children, ...props }: any) => (
          <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-blue-50 dark:bg-blue-900/20 text-gray-700 dark:text-gray-300 italic rounded-r-lg">
            {children}
          </blockquote>
        ),
      },
      table: {
        component: ({ children, ...props }: any) => (
          <div className="overflow-x-auto mb-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full">
              {children}
            </table>
          </div>
        ),
      },
      thead: {
        component: ({ children, ...props }: any) => (
          <thead className="bg-gray-50 dark:bg-gray-800">
            {children}
          </thead>
        ),
      },
      tbody: {
        component: ({ children, ...props }: any) => (
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {children}
          </tbody>
        ),
      },
      th: {
        component: ({ children, ...props }: any) => (
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {children}
          </th>
        ),
      },
      td: {
        component: ({ children, ...props }: any) => (
          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
            {children}
          </td>
        ),
      },
      tr: {
        component: ({ children, ...props }: any) => (
          <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            {children}
          </tr>
        ),
      },
      a: {
        component: ({ children, href, ...props }: any) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-600/30 hover:decoration-blue-600 transition-colors"
          >
            {children}
          </a>
        ),
      },
      hr: {
        component: ({ ...props }: any) => (
          <hr className="my-6 border-gray-200 dark:border-gray-700" />
        ),
      },
      img: {
        component: ({ src, alt, ...props }: any) => (
          <img 
            src={src} 
            alt={alt} 
            className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4"
          />
        ),
      },
    },
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group animate-fade-in`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} space-x-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
            isUser 
              ? 'bg-blue-600 text-white' 
              : 'bg-gradient-to-br from-purple-500 to-blue-600 text-white'
          }`}>
            {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          </div>
        </div>
        
        {/* Message Content */}
        <div className={`relative ${isUser ? 'text-right' : 'text-left'}`}>
          {/* Response Type Badge for AI messages */}
          {!isUser && (message as any).responseMode && (
            <div className="mb-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                (message as any).responseMode === 'quick'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
              }`}>
                {(message as any).responseMode === 'quick' ? (
                  <>
                    <Zap className="w-3 h-3 mr-1" />
                    Detailed Guide
                  </>
                ) : (
                  <>
                    <FileText className="w-3 h-3 mr-1" />
                    Training Manual
                  </>
                )}
              </span>
            </div>
          )}
          
          <div className={`inline-block px-6 py-4 rounded-2xl shadow-sm ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md max-w-prose'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-md'
          }`}>
            {isUser ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-white">
                {message.content}
              </p>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white prose-code:text-gray-800 dark:prose-code:text-gray-200">
                <Markdown options={markdownOptions}>
                  {message.content}
                </Markdown>
              </div>
            )}
          </div>
          
          {/* Download option for detailed reports */}
          {!isUser && (message as any).responseMode === 'detailed' && (
            <div className="mt-2">
              <button
                onClick={() => downloadReport(message.content, `analysis-report-${message.timestamp.toISOString().split('T')[0]}`)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
              >
                <Download className="w-3 h-3" />
                <span>Download Report</span>
              </button>
            </div>
          )}
          
          {/* Timestamp and Actions */}
          <div className={`flex items-center mt-2 space-x-2 ${
            isUser ? 'justify-end' : 'justify-start'
          }`}>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            
            {!isUser && (
              <button
                onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                title="Copy message"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}