import { useState, useCallback } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { ChatMessage, ChatSession } from '../types';
import './ChatView.css';

interface ChatViewProps {
  session?: ChatSession;
  onSendMessage?: (content: string) => Promise<void>;
}

export default function ChatView({ session, onSendMessage }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(session?.messages ?? []);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Create user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete',
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (onSendMessage) {
        await onSendMessage(content);
      } else {
        // Placeholder response when no service is connected
        setTimeout(() => {
          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: 'Quack quack! 🦆 The Claude Agent SDK is not yet configured. Please set up your API key in settings.',
            timestamp: Date.now(),
            status: 'complete',
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setIsLoading(false);
        }, 1000);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message.',
        timestamp: Date.now(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  }, [isLoading, onSendMessage]);

  return (
    <div className="chat-view">
      <div className="chat-view-header">
        <div className="chat-view-title">
          <span className="chat-view-icon">🦆</span>
          <h2>Claude Chat</h2>
        </div>
        <div className="chat-view-status">
          <span className={`status-indicator ${isLoading ? 'active' : ''}`} />
          <span className="status-text">{isLoading ? 'Thinking...' : 'Ready'}</span>
        </div>
      </div>
      <MessageList messages={messages} loading={isLoading} />
      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        placeholder="Ask Claude about your code, commands, or project..."
      />
    </div>
  );
}
