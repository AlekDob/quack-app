import { memo } from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import ToolCallCard from './ToolCallCard';
import StreamMessage from './StreamMessage';
import './ChatMessage.css';
import './StreamMessage.css';

// Import duck avatar
import duckAvatar from '../../images/duck.png';

interface ChatMessageProps {
  message: ChatMessageType;
  onOpenFile?: (path: string) => void;
}

function ChatMessage({ message, onOpenFile }: ChatMessageProps) {
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
          <div className="avatar-icon user-avatar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="5" r="3"/>
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
            </svg>
          </div>
        ) : (
          <div className="avatar-icon assistant-avatar">
            <img src={duckAvatar} alt="Jack" />
          </div>
        )}
      </div>
      <div className="chat-message-content">
        <div className="chat-message-header">
          <span className="chat-message-role">
            {isUser ? 'You' : 'Jack'}
          </span>
          <span className="chat-message-timestamp">
            {new Date(message.timestamp).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        {/* If we have Claude events, show them using StreamMessage */}
        {message.events && message.events.length > 0 ? (
          <div className="chat-message-events">
            {message.events.map((event, idx) => (
              <StreamMessage
                key={idx}
                message={event}
                streamMessages={message.events || []}
              />
            ))}
          </div>
        ) : (
          <div className="chat-message-body">
            {message.content}
            {isStreaming && <span className="streaming-cursor">▊</span>}
          </div>
        )}
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
                      <svg className="chat-message-attachment-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.5 3.5a2.5 2.5 0 0 1 5 0V11h-1V3.5a1.5 1.5 0 0 0-3 0V12a3 3 0 1 1-6 0V3h1v9a2 2 0 1 0 4 0V3.5Z"/>
                      </svg>
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
            Error: {message.error}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="chat-message-tools">
            {message.toolCalls.map((tool) => (
              <ToolCallCard key={tool.id} tool={tool} onOpenFile={onOpenFile} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);
