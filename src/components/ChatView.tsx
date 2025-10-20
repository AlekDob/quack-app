import { useEffect } from 'react';
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
  onFilePathClick?: (path: string) => void;
  pendingAgentMention?: AgentInfo | null;
  onMentionInserted?: () => void;
  pendingFileMention?: { name: string; path: string; relativePath: string } | null;
  onFileMentionInserted?: () => void;
  pendingSlashCommand?: { name: string; description: string } | null;
  onCommandInserted?: () => void;
  basePath?: string;
  // Agent Chat Settings - controlled from parent
  inputDraft?: string;
  onInputDraftChange?: (draft: string) => void;
  model?: 'opus' | 'sonnet' | 'haiku' | 'haiku-3.5';
  onModelChange?: (model: 'opus' | 'sonnet' | 'haiku' | 'haiku-3.5') => void;
  thinkingMode?: ThinkingMode;
  onThinkingModeChange?: (mode: ThinkingMode) => void;
  permissionMode?: PermissionMode;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  // Streaming control
  onAbortStream?: () => void;
  lastPrompt?: string;
}

export default function ChatView({
  messages,
  isLoading,
  onSendMessage,
  activeAgent,
  onClearAgent,
  agents,
  onSelectAgent,
  onFilePathClick,
  pendingAgentMention,
  onMentionInserted,
  pendingFileMention,
  onFileMentionInserted,
  pendingSlashCommand,
  onCommandInserted,
  basePath,
  // Agent Chat Settings - controlled from parent
  inputDraft = '',
  onInputDraftChange,
  model = 'sonnet',
  onModelChange,
  thinkingMode = 'auto',
  onThinkingModeChange,
  permissionMode = 'bypass',
  onPermissionModeChange,
  // Streaming control
  onAbortStream,
  lastPrompt,
}: ChatViewProps) {
  const handleSend = async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;
    await onSendMessage(content, {
      ...options,
      model,
      thinkingMode,
      permissionMode,
    });
  };

  // Keyboard shortcuts: Shift+Tab to cycle modes, ESC to abort
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to abort operation
      if (e.key === 'Escape' && isLoading) {
        e.preventDefault();
        console.warn('ESC pressed - abort requested (not yet implemented in backend)');
        // TODO: Implement actual abort by killing Node.js process
        // For now, just log a warning
        alert('⚠️ ESC pressed. Abort functionality coming soon!\n\nNote: The backend process will continue, but you can close this tab or reload the page.');
        return;
      }

      // Shift+Tab to cycle permission modes
      if (e.key === 'Tab' && e.shiftKey && !isLoading && onPermissionModeChange) {
        e.preventDefault();

        // Cycle through permission modes
        const modes: PermissionMode[] = ['plan', 'bypass'];
        const currentIndex = modes.indexOf(permissionMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        onPermissionModeChange(modes[nextIndex]);

        console.log(`Switched to ${modes[nextIndex]} mode`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [permissionMode, isLoading, onPermissionModeChange]);

  return (
    <div className="chat-view">
      <MessageList
        messages={messages}
        loading={isLoading}
        onFilePathClick={onFilePathClick}
      />
      <div className="chat-view-footer">
        <ChatSettingsMenu
          model={model}
          thinkingMode={thinkingMode}
          permissionMode={permissionMode}
          onModelChange={(m) => onModelChange?.(m as 'opus' | 'sonnet' | 'haiku' | 'haiku-3.5')}
          onThinkingModeChange={(mode) => onThinkingModeChange?.(mode)}
          onPermissionModeChange={(mode) => onPermissionModeChange?.(mode)}
          disabled={isLoading}
        />
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder="Ask Claude about your code, commands, or project..."
          agents={agents}
          onSelectAgent={onSelectAgent}
          activeAgent={activeAgent}
          onClearAgent={onClearAgent}
          pendingAgentMention={pendingAgentMention}
          onMentionInserted={onMentionInserted}
          pendingFileMention={pendingFileMention}
          onFileMentionInserted={onFileMentionInserted}
          pendingSlashCommand={pendingSlashCommand}
          onCommandInserted={onCommandInserted}
          basePath={basePath}
          // Controlled input draft
          inputValue={inputDraft}
          onInputChange={onInputDraftChange}
          // Streaming control
          isStreaming={isLoading}
          onAbort={onAbortStream}
          lastPrompt={lastPrompt}
        />
      </div>
    </div>
  );
}
