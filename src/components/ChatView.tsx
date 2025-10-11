import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { ChatMessage } from '../types';
import './ChatView.css';

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<void>;
}

export default function ChatView({ messages, isLoading, onSendMessage }: ChatViewProps) {
  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;
    await onSendMessage(content);
  };

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
