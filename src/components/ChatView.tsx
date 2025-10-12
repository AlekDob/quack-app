import { useMemo, useState } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { ChatMessage } from '../types';
import type {
  ChatSendOptions,
  ThinkingMode,
  PermissionMode,
} from '../hooks/useClaudeChat';
import './ChatView.css';

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string, options?: ChatSendOptions) => Promise<void>;
}

export default function ChatView({ messages, isLoading, onSendMessage }: ChatViewProps) {
  const [model, setModel] = useState('sonnet');
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('auto');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('act');

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
      { value: 'auto' as ThinkingMode, label: '▮ Auto · Let model decide' },
      { value: 'think' as ThinkingMode, label: '▮▮ Think · Step-by-step' },
      { value: 'hard' as ThinkingMode, label: '▮▮▮ Think Hard · Deeper reasoning' },
      { value: 'harder' as ThinkingMode, label: '▮▮▮▮ Think Harder · Thorough reasoning' },
      { value: 'ultra' as ThinkingMode, label: '▮▮▮▮▮ Ultra Think · Maximum deliberation' },
    ],
    []
  );

  const permissionModeOptions = useMemo(
    () => [
      { value: 'plan' as PermissionMode, label: '◇ Plan · Planning only' },
      { value: 'act' as PermissionMode, label: '◆ Act · Direct execution' },
      { value: 'bypass' as PermissionMode, label: '⬢ Bypass · Full access' },
      { value: 'read' as PermissionMode, label: '▤ Read · View-only capabilities' },
      { value: 'review' as PermissionMode, label: '▦ Review · Feedback focus' },
      { value: 'write' as PermissionMode, label: '▧ Write · Create new only' },
      { value: 'safe' as PermissionMode, label: '▩ Safe · Manual confirmation' },
    ],
    []
  );

  const handleSend = async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;
    await onSendMessage(content, {
      ...options,
      model,
      thinkingMode,
      permissionMode,
    });
  };

  return (
    <div className="chat-view">
      <div className="chat-view-header">
        <div className="chat-view-title">
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
              <span className="chat-control-label">Mode</span>
              <select
                value={permissionMode}
                onChange={(event) => setPermissionMode(event.target.value as PermissionMode)}
              >
                {permissionModeOptions.map((option) => (
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
