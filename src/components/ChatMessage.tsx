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
  const attachments = message.attachments ?? [];

  const formatSize = (size: number | undefined) => {
    if (!size) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
  };

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
        {attachments.length > 0 && (
          <div className="chat-message-attachments">
            {attachments.map((attachment) => {
              const isImage = attachment.previewUrl !== undefined;
              return (
                <div key={attachment.id} className="chat-message-attachment">
                  <div className="chat-message-attachment-preview">
                    {isImage ? (
                      <img src={attachment.previewUrl} alt={attachment.name} />
                    ) : (
                      <span className="chat-message-attachment-icon">📎</span>
                    )}
                  </div>
                  <div className="chat-message-attachment-meta">
                    <span className="chat-message-attachment-name">{attachment.name}</span>
                    <span className="chat-message-attachment-size">{formatSize(attachment.size)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
