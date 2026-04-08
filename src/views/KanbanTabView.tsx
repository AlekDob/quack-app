import { memo } from 'react';
import type { Tab } from '../components/TabBar';
import KanbanView from '../components/kanban/KanbanView';
import type { TerminalInfo, ChatMessage, ChatAttachment, KanbanTask, EffortLevel } from '../types';
import type { ChatSendOptions, PermissionMode } from '../hooks/useClaudeChat';

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
  defaultModel?: string;
  defaultThinkingMode?: 'auto' | 'think' | 'hard' | 'harder' | 'ultra';
  defaultPermissionMode?: PermissionMode;
  defaultEffort?: EffortLevel;
  onLoadChatSessions?: () => Promise<void>;
  onDiffClick?: (filePath: string, status: 'created' | 'modified' | 'deleted') => void;
  onOpenSessionInTerminal?: (taskId: string) => void;
  // Side panel toggle
  onToggleSidePanel?: () => void;
  sidePanelExpanded?: boolean;
  // Mini panel toggle - exits Kanban to Chat with mini panel in sidebar
  onToggleMiniPanel?: () => void;
  showMiniPanel?: boolean;
  // Task tab handling
  onOpenTaskTab?: (task: KanbanTask) => void;
  // 🦆 SESSIONS-FIRST: Open session directly (preferred)
  onSessionClick?: (sessionId: string) => void;
  // Open terminal in specified directory (for worktree tasks)
  onOpenTerminal?: (path: string, label?: string) => void;
  // Exit Kanban and return to chat
  onExitKanban?: () => void;
  // When rendered in split pane, enables horizontal scroll with min-width
  isSplitPane?: boolean;
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
  onDiffClick,
  onOpenSessionInTerminal,
  onToggleSidePanel,
  sidePanelExpanded,
  onToggleMiniPanel,
  showMiniPanel,
  onOpenTaskTab,
  onSessionClick,
  onOpenTerminal,
  onExitKanban,
  isSplitPane,
}: KanbanTabViewProps) {
  if (!isActive || tab.type !== 'kanban') {
    return null;
  }

  return (
    <div className={`kanban-tab-view${isSplitPane ? ' split-pane' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
        onDiffClick={onDiffClick}
        onOpenSessionInTerminal={onOpenSessionInTerminal}
        onToggleSidePanel={onToggleSidePanel}
        sidePanelExpanded={sidePanelExpanded}
        onToggleMiniPanel={onToggleMiniPanel}
        showMiniPanel={showMiniPanel}
        onOpenTaskTab={onOpenTaskTab}
        onSessionClick={onSessionClick}
        onOpenTerminal={onOpenTerminal}
        onExitKanban={onExitKanban}
      />
    </div>
  );
}

export default memo(KanbanTabView);
