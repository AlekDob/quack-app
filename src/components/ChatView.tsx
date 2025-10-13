import { useMemo, useState } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ChatSettingsMenu from './ChatSettingsMenu';
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
      <MessageList messages={messages} loading={isLoading} />
      <div className="chat-view-footer">
        <ChatSettingsMenu
          model={model}
          thinkingMode={thinkingMode}
          permissionMode={permissionMode}
          onModelChange={setModel}
          onThinkingModeChange={setThinkingMode}
          onPermissionModeChange={setPermissionMode}
          disabled={isLoading}
        />
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder="Ask Claude about your code, commands, or project..."
        />
      </div>
    </div>
  );
}
