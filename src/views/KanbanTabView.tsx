import { memo } from 'react';
import type { Tab } from '../components/TabBar';
import KanbanView from '../components/kanban/KanbanView';
import type { TerminalInfo, ChatMessage, ChatAttachment } from '../types';
import type { ChatSendOptions } from '../hooks/useClaudeChat';

interface KanbanTabViewProps {
  tab: Tab;
  isActive: boolean;
  // All props from KanbanView
  terminals: TerminalInfo[];
  chatSessions: Map<string, ChatMessage[]>;
  chatLoadingMap: Map<string, boolean>;
  onSendMessage: (agentId: string, content: string, options?: ChatSendOptions) => Promise<void>;
  onAbortStream: (agentId: string) => void;
  onClearConversation: (agentId: string) => void;
  onCompactConversation: (agentId: string) => void;
  getLastPrompt: (agentId: string) => string | null;
  sessionTokensMap: Map<string, { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; totalCost: number }>;
  onCreateNewAgent?: (projectPath: string) => void;
  defaultModel?: 'opus' | 'sonnet' | 'haiku';
  defaultThinkingMode?: 'auto' | 'think' | 'hard' | 'harder' | 'ultra';
  defaultPermissionMode?: 'plan' | 'bypass';
  defaultEffort?: 'low' | 'medium' | 'high';
  onLoadChatSessions?: () => Promise<void>;
  onProjectClick?: (projectPath: string) => void;
  onDiffClick?: (filePath: string, status: 'created' | 'modified' | 'deleted') => void;
  onOpenSessionInTerminal?: (taskId: string) => void;
  // Side panel toggle
  onToggleSidePanel?: () => void;
  sidePanelExpanded?: boolean;
}

/**
 * Kanban Tab View
 * Wraps KanbanView for use as a tab instead of an overlay
 */
function KanbanTabView({
  tab,
  isActive,
  terminals,
  chatSessions,
  chatLoadingMap,
  onSendMessage,
  onAbortStream,
  onClearConversation,
  onCompactConversation,
  getLastPrompt,
  sessionTokensMap,
  onCreateNewAgent,
  defaultModel,
  defaultThinkingMode,
  defaultPermissionMode,
  defaultEffort,
  onLoadChatSessions,
  onProjectClick,
  onDiffClick,
  onOpenSessionInTerminal,
  onToggleSidePanel,
  sidePanelExpanded,
}: KanbanTabViewProps) {
  if (!isActive || tab.type !== 'kanban') {
    return null;
  }

  return (
    <div className="kanban-tab-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <KanbanView
        terminals={terminals}
        chatSessions={chatSessions}
        chatLoadingMap={chatLoadingMap}
        onSendMessage={onSendMessage}
        onAbortStream={onAbortStream}
        onClearConversation={onClearConversation}
        onCompactConversation={onCompactConversation}
        getLastPrompt={getLastPrompt}
        sessionTokensMap={sessionTokensMap}
        onCreateNewAgent={onCreateNewAgent}
        defaultModel={defaultModel}
        defaultThinkingMode={defaultThinkingMode}
        defaultPermissionMode={defaultPermissionMode}
        defaultEffort={defaultEffort}
        onLoadChatSessions={onLoadChatSessions}
        onProjectClick={onProjectClick}
        onDiffClick={onDiffClick}
        onOpenSessionInTerminal={onOpenSessionInTerminal}
        onToggleSidePanel={onToggleSidePanel}
        sidePanelExpanded={sidePanelExpanded}
      />
    </div>
  );
}

export default memo(KanbanTabView);
