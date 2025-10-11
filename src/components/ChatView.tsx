import { useMemo, useState } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { ChatMessage } from '../types';
import type { ChatSendOptions, ThinkingMode } from '../hooks/useClaudeChat';
import './ChatView.css';

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string, options?: ChatSendOptions) => Promise<void>;
}

export default function ChatView({ messages, isLoading, onSendMessage }: ChatViewProps) {
  const [model, setModel] = useState('sonnet');
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('auto');
  const [thinkingDuration, setThinkingDuration] = useState('auto');

  const modelOptions = useMemo(
    () => [
      { value: 'haiku', label: 'Haiku 3.5' },
      { value: 'sonnet', label: 'Sonnet 4.5' },
      { value: 'opus', label: 'Opus 4.5' },
    ],
    []
  );

  const thinkingModeOptions = useMemo(
    () => [
      { value: 'auto' as ThinkingMode, label: 'Auto' },
      { value: 'think' as ThinkingMode, label: 'Think' },
      { value: 'hard' as ThinkingMode, label: 'Think Hard' },
      { value: 'harder' as ThinkingMode, label: 'Think Harder' },
      { value: 'ultra' as ThinkingMode, label: 'Ultra Think' },
    ],
    []
  );

  const thinkingDurationOptions = useMemo(
    () => [
      { value: 'auto', label: 'Auto' },
      { value: '15s', label: '15s' },
      { value: '30s', label: '30s' },
      { value: '60s', label: '60s' },
    ],
    []
  );

  const handleSend = async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;
    await onSendMessage(content, {
      ...options,
      model,
      thinkingMode,
      thinkingDuration,
    });
  };

  return (
    <div className="chat-view">
      <div className="chat-view-header">
        <div className="chat-view-title">
          <span className="chat-view-icon">🦆</span>
          <h2>Claude Chat</h2>
        </div>
        <div className="chat-view-controls">
          <div className="chat-view-status">
            <span className={`status-indicator ${isLoading ? 'active' : ''}`} />
            <span className="status-text">{isLoading ? 'Thinking...' : 'Ready'}</span>
          </div>
          <div className="chat-view-selectors">
            <label className="chat-control">
              <span className="chat-control-label">Model</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="chat-control">
              <span className="chat-control-label">Thinking</span>
              <select
                value={thinkingMode}
                onChange={(event) => setThinkingMode(event.target.value as ThinkingMode)}
              >
                {thinkingModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="chat-control">
              <span className="chat-control-label">Duration</span>
              <select
                value={thinkingDuration}
                onChange={(event) => setThinkingDuration(event.target.value)}
              >
                {thinkingDurationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
