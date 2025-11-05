import { useState, useMemo, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import TerminalGroup from "./TerminalGroup";
import RepositoryGroup from "./RepositoryGroup";
import ContextMenu from "./ContextMenu";
import CommitHistoryModal from "./CommitHistoryModal";
import type { TerminalInfo, AgentChat, ChatMessage, GitPullResult } from "../types";

const normalize = (value: string) => value.toLowerCase();
const fuzzyMatch = (query: string, target: string) => {
  if (!query) {
    return true;
  }
  const normalizedQuery = normalize(query);
  const normalizedTarget = normalize(target);
  let queryIndex = 0;
  let targetIndex = 0;
  while (
    queryIndex < normalizedQuery.length &&
    targetIndex < normalizedTarget.length
  ) {
    if (normalizedQuery[queryIndex] === normalizedTarget[targetIndex]) {
      queryIndex += 1;
    }
    targetIndex += 1;
  }
  return queryIndex === normalizedQuery.length;
};

interface TerminalSidebarProps {
  terminals: TerminalInfo[];
  activeId: string | null;
  creating: boolean;
  collapsedGroups: Set<string>;
  // Phase 4: AgentChat props
  agentChats: AgentChat[];
  activeAgentChatId: string | null;
  onSelectAgentChat: (agentChatId: string | null) => void;
  onDeleteAgentChat: (agentChatId: string) => void;
  onUpdateAgentChat: (agentChatId: string, updates: Partial<Omit<AgentChat, 'id'>>) => void;
  onCreateAgent: () => void; // NEW: Create AgentChat only (no terminal)
  // PiP props
  onTogglePip?: () => void;
  isPipOpen?: boolean;
  // Chat sessions
  chatSessions?: Map<string, ChatMessage[]>;
  // Terminal props
  onAdd: () => void; // Will be used by "+" button for terminal creation
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onEdit: (terminal: TerminalInfo) => void;
  onDuplicate: (terminal: TerminalInfo) => void;
  onReset: (terminal: TerminalInfo) => void;
  onToggleGroup: (cwd: string) => void;
  onReorder: (reorderedIds: string[]) => void;
  onOpenSettings?: () => void; // NEW: Open settings panel
  onOpenGitPanel?: () => void; // NEW: Open Git Panel drawer
}

export default function TerminalSidebar({
  terminals,
  activeId,
  creating,
  collapsedGroups,
  // AgentChat props (unused - kept for backward compatibility)
  agentChats: _agentChats,
  activeAgentChatId: _activeAgentChatId,
  onSelectAgentChat: _onSelectAgentChat,
  onDeleteAgentChat: _onDeleteAgentChat,
  onUpdateAgentChat: _onUpdateAgentChat,
  onCreateAgent,
  // PiP props
  onTogglePip,
  isPipOpen,
  // Chat sessions
  chatSessions,
  // Terminal props
  onAdd,
  onSelect,
  onClose,
  onColorChange: _onColorChange,
  onEdit,
  onDuplicate,
  onReset,
  onToggleGroup,
  onReorder,
  onOpenSettings,
  onOpenGitPanel,
}: TerminalSidebarProps) {
  void _onColorChange;
  void _onDeleteAgentChat; // Will be used in context menu (Phase 4)
  void _onUpdateAgentChat; // Will be used in rename functionality (Phase 4)
  void onAdd; // Used by "+" button in toolbar (kept for future use)
  const [query, setQuery] = useState("");
  const [useMetroStyle, setUseMetroStyle] = useState(true); // Enable metro style by default
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    terminal: TerminalInfo;
  } | null>(null);
  const [commitHistoryModal, setCommitHistoryModal] = useState<{
    branchName: string;
    rootPath: string;
  } | null>(null);

  // Drag & drop state
  const [draggedTerminalId, setDraggedTerminalId] = useState<string | null>(null);
  const [dragOverTerminalId, setDragOverTerminalId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('after');
  const [draggedGroupCwd, setDraggedGroupCwd] = useState<string | null>(null);
  const [dragOverGroupCwd, setDragOverGroupCwd] = useState<string | null>(null);
  const [groupDropPosition, setGroupDropPosition] = useState<'before' | 'after'>('after');

  // Filter terminals by query only
  const filteredTerminals = useMemo(() => {
    return terminals.filter((terminal) => fuzzyMatch(query, terminal.label));
  }, [terminals, query]);

  // Group terminals by repository (main repo vs worktrees)
  const repositoryGroups = useMemo(() => {
    const repoMap = new Map<string, {
      mainAgents: TerminalInfo[];
      worktreeAgents: TerminalInfo[];
      repoPath: string;
    }>();

    filteredTerminals.forEach((terminal) => {
      const cwd = terminal.cwd || 'unknown';

      // Determine if this is a worktree
      const isWorktree = terminal.useWorktree === true ||
                        cwd.includes('-worktree-') ||
                        cwd.includes('-feature-');

      // Extract base repository name more intelligently
      let repoName: string;
      const parts = cwd.split('/');
      const lastPart = parts[parts.length - 1];

      if (isWorktree) {
        // For worktrees, extract the base repo name
        // Handle patterns like:
        // - quack-app-worktree-feature-xyz
        // - quack-app-feature-agent-avery-tree-feature-agent-giusppe

        if (lastPart.includes('-worktree-')) {
          repoName = lastPart.split('-worktree-')[0];
        } else if (lastPart.includes('-feature-')) {
          // Extract base name before -feature- suffix
          // quack-app-feature-agent-giusppe → quack-app
          const featureIndex = lastPart.indexOf('-feature-');
          if (featureIndex > 0) {
            repoName = lastPart.substring(0, featureIndex);
          } else {
            repoName = lastPart.split('-feature-')[0];
          }
        } else {
          // Default fallback
          repoName = lastPart;
        }
      } else {
        // For main repos, use the directory name directly
        repoName = lastPart;
      }

      // Get or create repository group
      if (!repoMap.has(repoName)) {
        repoMap.set(repoName, {
          mainAgents: [],
          worktreeAgents: [],
          repoPath: cwd,
        });
      }

      const group = repoMap.get(repoName)!;

      // Add terminal to appropriate list
      if (isWorktree) {
        group.worktreeAgents.push(terminal);
      } else {
        group.mainAgents.push(terminal);
        // Update repo path to main repo path if we have one
        if (!cwd.includes('-worktree-') && !cwd.includes('-feature-')) {
          group.repoPath = cwd;
        }
      }
    });

    return Array.from(repoMap.entries());
  }, [filteredTerminals]);

  // Legacy cwd groups for fallback (when not using metro style)
  const cwdGroups = useMemo(() => {
    const groupMap: Record<string, TerminalInfo[]> = {};

    filteredTerminals.forEach((terminal) => {
      const cwd = terminal.cwd || 'unknown';
      if (!groupMap[cwd]) {
        groupMap[cwd] = [];
      }
      groupMap[cwd].push(terminal);
    });

    const groups: Array<[string, TerminalInfo[]]> = Object.entries(groupMap);
    return { groups };
  }, [filteredTerminals]);

  // SIMPLE: Just select terminal - no AgentChat logic!
  const handleSelectTerminal = (terminal: TerminalInfo) => {
    onSelect(terminal.id);
  };

  const handleContextMenu = (event: MouseEvent, terminal: TerminalInfo) => {
    event.preventDefault();
    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      terminal,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Handle Git operations from dropdown menu
  const handleGitOperation = async (operation: string, terminal: TerminalInfo) => {
    const rootPath = terminal.worktreePath || terminal.cwd;
    const branchName = terminal.branch || 'main';

    try {
      switch (operation) {
        case 'pull': {
          const result = await invoke<GitPullResult>('git_pull', {
            branchName,
            rootPath,
          });

          if (result.hasConflicts) {
            alert(`Pull has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join('\n')}`);
          } else {
            console.log(`✅ Pull successful: ${result.message}`);
            // TODO: Show toast notification instead of console
          }
          break;
        }

        case 'push': {
          const result = await invoke<string>('git_push', {
            branchName,
            force: false,
            rootPath,
          });
          console.log(`✅ Push successful: ${result}`);
          // TODO: Show toast notification instead of console
          break;
        }

        case 'merge-to-main': {
          // First switch to main
          await invoke('git_switch_branch', {
            branchName: 'main',
            rootPath,
          });

          // Then merge the feature branch
          const result = await invoke<{
            success: boolean;
            hasConflicts: boolean;
            conflictedFiles: string[];
            message: string;
          }>('git_merge_branch', {
            branchName,
            rootPath,
          });

          if (result.hasConflicts) {
            alert(`Merge has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join('\n')}`);
          } else {
            console.log(`✅ Merge successful: ${result.message}`);
            // TODO: Show toast notification
          }
          break;
        }

        case 'create-pr': {
          // Generate GitHub/GitLab PR URL
          const prUrl = await generatePRUrl(rootPath, branchName);
          if (prUrl) {
            window.open(prUrl, '_blank');
          } else {
            alert('Could not generate PR URL. Make sure the repository has a remote configured.');
          }
          break;
        }

        case 'view-commits': {
          // Open commit history modal
          setCommitHistoryModal({
            branchName,
            rootPath,
          });
          break;
        }

        case 'view-diff': {
          // TODO: Open modal with diff viewer
          alert(`View diff feature for ${branchName} coming soon!`);
          break;
        }

        case 'delete-worktree': {
          const confirmed = window.confirm(
            `Are you sure you want to delete the worktree for ${branchName}?\n\nThis will remove:\n- ${rootPath}\n\nThe branch will still exist in the repository.`
          );

          if (confirmed) {
            await invoke('git_remove_worktree', {
              path: rootPath,
              force: false,
              rootPath: terminal.cwd, // Use main repo path
            });
            console.log(`✅ Worktree deleted: ${rootPath}`);
            // TODO: Close terminal and refresh UI
            onClose(terminal.id);
          }
          break;
        }

        default:
          console.warn(`Unknown git operation: ${operation}`);
      }
    } catch (error) {
      console.error(`Git operation failed:`, error);
      alert(`Git operation failed: ${error}`);
    }
  };

  // Helper to generate PR URL
  const generatePRUrl = async (rootPath: string, branchName: string): Promise<string | null> => {
    try {
      // Get remote URL using git config
      const remoteUrl = await invoke<string>('git_get_remote_url', { rootPath });

      // Parse GitHub/GitLab URL
      if (remoteUrl.includes('github.com')) {
        // GitHub: https://github.com/owner/repo or git@github.com:owner/repo.git
        const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          return `https://github.com/${owner}/${repo}/compare/${branchName}?expand=1`;
        }
      } else if (remoteUrl.includes('gitlab.com')) {
        // GitLab: https://gitlab.com/owner/repo or git@gitlab.com:owner/repo.git
        const match = remoteUrl.match(/gitlab\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          return `https://gitlab.com/${owner}/${repo}/-/merge_requests/new?merge_request[source_branch]=${branchName}`;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to generate PR URL:', error);
      return null;
    }
  };

  // Drag & drop handlers for terminals
  const handleTerminalDragStart = (terminal: TerminalInfo) => {
    setDraggedTerminalId(terminal.id);
  };

  const handleTerminalDragOver = (terminal: TerminalInfo, event: React.DragEvent) => {
    if (terminal.id === draggedTerminalId) return;

    // Block drag between different projects (different cwd)
    const draggedTerminal = terminals.find(t => t.id === draggedTerminalId);
    if (draggedTerminal && draggedTerminal.cwd !== terminal.cwd) {
      return; // Don't allow drop if different project
    }

    // Calculate drop position based on mouse Y position
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = event.clientY < midpoint ? 'before' : 'after';

    setDragOverTerminalId(terminal.id);
    setDropPosition(position);
  };

  const handleTerminalDragLeave = () => {
    setDragOverTerminalId(null);
  };

  const handleTerminalDrop = (targetTerminal: TerminalInfo) => {
    if (!draggedTerminalId || targetTerminal.id === draggedTerminalId) return;

    const currentIds = terminals.map((t) => t.id);
    const draggedIndex = currentIds.indexOf(draggedTerminalId);
    let targetIndex = currentIds.indexOf(targetTerminal.id);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Adjust target index based on drop position
    if (dropPosition === 'after') {
      targetIndex += 1;
    }

    const reordered = [...currentIds];
    reordered.splice(draggedIndex, 1);

    // Recalculate insertion index if needed
    const newTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    reordered.splice(newTargetIndex, 0, draggedTerminalId);

    onReorder(reordered);
    setDragOverTerminalId(null);
  };

  const handleTerminalDragEnd = () => {
    setDraggedTerminalId(null);
    setDragOverTerminalId(null);
  };

  // Drag & drop handlers for groups
  const handleGroupDragStart = (cwd: string) => {
    setDraggedGroupCwd(cwd);
  };

  const handleGroupDragOver = (cwd: string, event: React.DragEvent) => {
    if (cwd === draggedGroupCwd) return;

    // Calculate drop position based on mouse Y position
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = event.clientY < midpoint ? 'before' : 'after';

    setDragOverGroupCwd(cwd);
    setGroupDropPosition(position);
  };

  const handleGroupDragLeave = () => {
    setDragOverGroupCwd(null);
  };

  const handleGroupDrop = (targetCwd: string) => {
    if (!draggedGroupCwd || targetCwd === draggedGroupCwd) return;

    // Find all terminals in both groups
    const draggedGroup = cwdGroups.groups.find(([cwd]) => cwd === draggedGroupCwd)?.[1] || [];
    const targetGroup = cwdGroups.groups.find(([cwd]) => cwd === targetCwd)?.[1] || [];

    if (draggedGroup.length === 0 || targetGroup.length === 0) return;

    const currentIds = terminals.map((t) => t.id);
    const draggedGroupIds = draggedGroup.map((t) => t.id);

    // Remove dragged group terminals from current order
    const withoutDragged = currentIds.filter((id) => !draggedGroupIds.includes(id));

    // Determine insertion point based on drop position
    let insertId: string;
    if (groupDropPosition === 'before') {
      insertId = targetGroup[0].id;
    } else {
      insertId = targetGroup[targetGroup.length - 1].id;
    }

    const insertIndex = withoutDragged.indexOf(insertId);
    const finalIndex = groupDropPosition === 'before' ? insertIndex : insertIndex + 1;

    // Insert dragged group at the correct position
    const reordered = [...withoutDragged];
    reordered.splice(finalIndex, 0, ...draggedGroupIds);

    onReorder(reordered);
    setDragOverGroupCwd(null);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroupCwd(null);
    setDragOverGroupCwd(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <span className="sidebar-title">Quack Agents</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* PiP Mode Button */}
            {onTogglePip && (
              <button
                type="button"
                className="sidebar-button"
                onClick={onTogglePip}
                style={{
                  background: isPipOpen ? 'rgba(242, 140, 82, 0.2)' : undefined,
                  borderColor: isPipOpen ? 'rgba(242, 140, 82, 0.4)' : undefined,
                  color: isPipOpen ? '#f28c52' : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={isPipOpen ? 'Close PiP Mode' : 'Open PiP Mode'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" />
                  <rect x="8" y="8" width="8" height="8" rx="1" />
                </svg>
                PiP
              </button>
            )}
            {/* New Agent Button */}
            <button
              type="button"
              className="sidebar-button"
              onClick={onCreateAgent}
              disabled={creating}
            >
              {creating ? "Creating…" : "New"}
            </button>
          </div>
        </div>
        <input
          className="explorer-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents"
        />
      </div>

      <div className="explorer-root-label sidebar-terminals-label">
        ACTIVE AGENTS
      </div>

      <div className="sidebar-list">
        {/* Toggle for metro style */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={useMetroStyle}
              onChange={(e) => setUseMetroStyle(e.target.checked)}
              className="rounded"
            />
            <span>Metro Style View</span>
          </label>
        </div>

        {/* Render based on selected style */}
        {useMetroStyle ? (
          // Metro-style repository groups
          repositoryGroups.map(([repoName, group]) => {
            const repoKey = `repo-${repoName}`;
            const isCollapsed = collapsedGroups.has(repoKey);

            return (
              <RepositoryGroup
                key={repoKey}
                repoPath={group.repoPath}
                repoName={repoName}
                mainAgents={group.mainAgents}
                worktreeAgents={group.worktreeAgents}
                isCollapsed={isCollapsed}
                activeId={activeId}
                chatSessions={chatSessions}
                onToggle={() => onToggleGroup(repoKey)}
                onSelect={handleSelectTerminal}
                onClose={onClose}
                onContextMenu={handleContextMenu}
                onGitOperation={handleGitOperation}
                onOpenGitPanel={onOpenGitPanel}
              />
            );
          })
        ) : (
          // Legacy cwd-based groups
          cwdGroups.groups.map(([cwd, groupTerminals]) => {
            const isCollapsed = collapsedGroups.has(cwd);

            return (
              <TerminalGroup
                key={cwd}
                cwd={cwd}
                terminals={groupTerminals}
                isCollapsed={isCollapsed}
                activeId={activeId}
                chatSessions={chatSessions}
                onToggle={() => onToggleGroup(cwd)}
                onSelect={handleSelectTerminal}
                onClose={onClose}
                onContextMenu={handleContextMenu}
                // Drag & drop for terminals
                draggedTerminalId={draggedTerminalId}
                dragOverTerminalId={dragOverTerminalId}
                dropPosition={dropPosition}
                onTerminalDragStart={handleTerminalDragStart}
                onTerminalDragOver={handleTerminalDragOver}
                onTerminalDragLeave={handleTerminalDragLeave}
                onTerminalDrop={handleTerminalDrop}
                onTerminalDragEnd={handleTerminalDragEnd}
                // Drag & drop for groups
                draggedGroupCwd={draggedGroupCwd}
                dragOverGroupCwd={dragOverGroupCwd}
                groupDropPosition={groupDropPosition}
                onGroupDragStart={handleGroupDragStart}
                onGroupDragOver={handleGroupDragOver}
                onGroupDragLeave={handleGroupDragLeave}
                onGroupDrop={handleGroupDrop}
                onGroupDragEnd={handleGroupDragEnd}
              />
            );
          })
        )}

        {/* Empty state */}
        {terminals.length === 0 && (
          <div className="empty-state">
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="text-6xl mb-4">🦆</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No agents yet
              </h3>
              <p className="text-sm text-white/60 mb-12 max-w-xs">
                Quack quack! Create your first agent to start coding with AI assistance.
              </p>
              <button
                type="button"
                onClick={onCreateAgent}
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2"
                style={{
                  background: 'rgba(242, 140, 82, 0.1)',
                  border: '1px solid rgba(242, 140, 82, 0.3)',
                  color: '#f28c52',
                  marginTop: '32px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(242, 140, 82, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(242, 140, 82, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.3)';
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create your first agent
              </button>
            </div>
          </div>
        )}

        {terminals.length > 0 && cwdGroups.groups.length === 0 && (
          <div className="empty-state">No terminals found</div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          terminal={contextMenu.terminal}
          onEdit={() => onEdit(contextMenu.terminal)}
          onClose={closeContextMenu}
          onCopyPath={() => {
            // Copy handled inside ContextMenu
          }}
          onDuplicate={() => onDuplicate(contextMenu.terminal)}
          onReset={() => onReset(contextMenu.terminal)}
          onCloseTerminal={() => onClose(contextMenu.terminal.id)}
        />
      )}

      {/* Settings Button */}
      {onOpenSettings && (
        <button
          type="button"
          className="sidebar-settings-button"
          onClick={onOpenSettings}
        >
          <div className="sidebar-settings-content">
            <div className="sidebar-settings-top">
              <svg className="sidebar-settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span className="sidebar-settings-label">Settings</span>
            </div>
            <span className="sidebar-settings-version">v1.0.0</span>
          </div>
        </button>
      )}

      {/* Commit History Modal */}
      {commitHistoryModal && (
        <CommitHistoryModal
          branchName={commitHistoryModal.branchName}
          rootPath={commitHistoryModal.rootPath}
          onClose={() => setCommitHistoryModal(null)}
        />
      )}
    </aside>
  );
}
