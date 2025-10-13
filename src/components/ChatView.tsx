import { useMemo, useState, useEffect } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ChatSettingsMenu from './ChatSettingsMenu';
import type { ChatMessage, AgentInfo } from '../types';
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
  activeAgent?: AgentInfo | null;
  onClearAgent?: () => void;
  agents?: AgentInfo[];
  onSelectAgent?: (agent: AgentInfo) => void;
}

export default function ChatView({ messages, isLoading, onSendMessage, activeAgent, onClearAgent, agents, onSelectAgent }: ChatViewProps) {
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

  // Keyboard shortcut: Shift+Tab to cycle permission modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && e.shiftKey && !isLoading) {
        e.preventDefault();

        // Cycle through permission modes
        const modes: PermissionMode[] = ['plan', 'act', 'acceptEdits', 'bypass'];
        const currentIndex = modes.indexOf(permissionMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        setPermissionMode(modes[nextIndex]);

        // Show toast notification (we'll add this later)
        console.log(`Switched to ${modes[nextIndex]} mode`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [permissionMode, isLoading]);

  return (
    <div className="chat-view">
      <MessageList
        messages={messages}
        loading={isLoading}
        onPermissionModeChange={setPermissionMode}
      />
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
        {activeAgent && (
          <div className="active-agent-indicator">
            <span className="active-agent-label">Agent:</span>
            <span className="active-agent-name">{activeAgent.name.replace(/-/g, ' ')}</span>
            {onClearAgent && (
              <button
                type="button"
                onClick={onClearAgent}
                className="active-agent-clear"
                title="Clear active agent"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder="Ask Claude about your code, commands, or project..."
          agents={agents}
          onSelectAgent={onSelectAgent}
        />
      </div>
    </div>
  );
}
