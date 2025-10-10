import { memo } from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import './ChatMessage.css';

interface ChatMessageProps {
  message: ChatMessageType;
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const hasError = message.status === 'error';

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'} ${hasError ? 'error' : ''}`}>
      <div className="chat-message-avatar">
        {isUser ? (
          <div className="avatar-icon user-avatar">👤</div>
        ) : (
          <div className="avatar-icon assistant-avatar">🦆</div>
        )}
      </div>
      <div className="chat-message-content">
        <div className="chat-message-header">
          <span className="chat-message-role">
            {isUser ? 'You' : 'Claude'}
          </span>
          <span className="chat-message-timestamp">
            {new Date(message.timestamp).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <div className="chat-message-body">
          {message.content}
          {isStreaming && <span className="streaming-cursor">▊</span>}
        </div>
        {hasError && message.error && (
          <div className="chat-message-error">
            ⚠️ {message.error}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="chat-message-tools">
            {message.toolCalls.map((tool) => (
              <div key={tool.id} className="tool-call">
                <span className="tool-icon">🛠️</span>
                <span className="tool-name">{tool.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);
