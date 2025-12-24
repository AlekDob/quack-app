import { useState, useMemo, useEffect, useCallback, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Store } from '@tauri-apps/plugin-store';
import { getCurrentVersion } from '../utils/version';
import { useUpdateChecker } from '../hooks/useUpdateChecker';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import RepositoryGroup from "./RepositoryGroup";
import ContextMenu from "./ContextMenu";
import CommitHistoryModal from "./CommitHistoryModal";
import DragHandle from "./DragHandle";
import BackgroundTasksSidebarButton from "./BackgroundTasksSidebarButton";
import type { TerminalInfo, AgentChat, ChatMessage, GitPullResult, AgentInfo } from "../types";

// Sortable Repository Group wrapper
interface SortableRepositoryGroupProps {
  repoKey: string;
  repoPath: string;
  repoName: string;
  mainAgents: TerminalInfo[];
  worktreeAgents: TerminalInfo[];
  isCollapsed: boolean;
  activeId: string | null;
  chatSessions?: Map<string, ChatMessage[]>;
  lastReadTimestamps?: Map<string, number>; // 🔵 Read-once notification system
  onToggle: () => void;
  onSelect: (terminal: TerminalInfo) => void;
  onClose: (id: string) => void;
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void;
  onGitOperation: (operation: string, terminal: TerminalInfo) => void;
  onOpenGitPanel?: () => void;
  onOpenTerminalWindow?: (repoPath: string, repoName: string) => void; // Open terminal in Terminal Window
  gitRefreshTrigger?: number;
  onCreateAgent?: () => void; // Create new agent associated with this project
}

function SortableRepositoryGroup({
  repoKey,
  ...props
}: SortableRepositoryGroupProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: repoKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    willChange: isDragging ? 'transform' : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-repository-group group relative"
    >
      {/* 🦆 Drag Handle for Repository Groups - ENABLED (important for project organization) */}
      <div
        className="absolute left-0 top-[10px] z-10"
        style={{
          opacity: isHovered ? 0.6 : 0,
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={() => !isDragging && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <DragHandle
          isDragging={isDragging}
          {...attributes}
          {...listeners}
        />
      </div>

      {/* Repository Group with extra padding for drag handle */}
      <div
        style={{ paddingLeft: '16px' }}
        onMouseEnter={() => !isDragging && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <RepositoryGroup {...props} />
      </div>
    </div>
  );
}

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
  // Kanban View props
  isKanbanViewActive?: boolean;
  onToggleKanbanView?: () => void;
  // Quack sound props
  onToggleQuackSound?: () => void;
  quackSoundEnabled?: boolean;
  // Chat sessions
  chatSessions?: Map<string, ChatMessage[]>;
  lastReadTimestamps?: Map<string, number>; // 🔵 Read-once notification system
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
  onOpenSettings?: () => void; // Open settings panel
  onOpenGitPanel?: () => void; // Open Git Panel drawer
  onOpenTerminalWindow?: (repoPath: string, repoName: string) => void; // Open terminal in Terminal Window
  onOpenBackgroundTasks?: () => void; // Open Background Tasks drawer
  gitRefreshTrigger?: number; // Trigger to refresh git status after commit
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
  // Kanban View props
  isKanbanViewActive = false,
  onToggleKanbanView,
  // Quack sound props
  onToggleQuackSound,
  quackSoundEnabled,
  // Chat sessions
  chatSessions,
  lastReadTimestamps,
  // Terminal props
  onAdd,
  onSelect,
  onClose,
  onColorChange: _onColorChange,
  onEdit,
  onDuplicate,
  onReset,
  onToggleGroup,
  onReorder: _onReorder,
  onOpenSettings,
  onOpenGitPanel,
  onOpenTerminalWindow,
  onOpenBackgroundTasks,
  gitRefreshTrigger,
}: TerminalSidebarProps) {
  void _onColorChange;
  void _onDeleteAgentChat; // Will be used in context menu (Phase 4)
  void _onUpdateAgentChat; // Will be used in rename functionality (Phase 4)
  void _onReorder; // Drag & drop reordering functionality (currently disabled)
  void onAdd; // Used by "+" button in toolbar (kept for future use)
  const [query, setQuery] = useState("");
  const [appVersion, setAppVersion] = useState('v0.0.0');

  // Fetch app version on mount
  useEffect(() => {
    getCurrentVersion().then(version => setAppVersion(`v${version}`));
  }, []);

  // Check for updates
  const { updateAvailable, latestRelease } = useUpdateChecker();
  // Metro style is now the only option (removed useMetroStyle state)
  const [repositoryOrder, setRepositoryOrder] = useState<string[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    terminal: TerminalInfo;
  } | null>(null);
  const [commitHistoryModal, setCommitHistoryModal] = useState<{
    branchName: string;
    rootPath: string;
  } | null>(null);

  // Cleanup: Ensure dragging class is removed on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('dragging-active');
    };
  }, []);

  // Configure drag sensors for repository groups with optimized constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        tolerance: 5,
        delay: 100,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Load saved repository order on mount
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const store = await Store.load('.quack-repo-order.dat');
        const savedOrder = await store.get<string[]>('repository-order');
        if (savedOrder) {
          setRepositoryOrder(savedOrder);
        }
      } catch (error) {
        console.error('Failed to load repository order:', error);
      }
    };
    loadOrder();
  }, []);

  // Save repository order
  const saveRepositoryOrder = useCallback(async (order: string[]) => {
    try {
      const store = await Store.load('.quack-repo-order.dat');
      await store.set('repository-order', order);
      await store.save();
    } catch (error) {
      console.error('Failed to save repository order:', error);
    }
  }, []);

  // Handle repository drag start
  const handleRepoDragStart = (event: DragStartEvent) => {
    setActiveRepoId(String(event.active.id));
    // Add class to disable animations for performance
    document.body.classList.add('dragging-active');
  };

  // Handle repository drag end
  const handleRepoDragEnd = (event: DragEndEvent) => {
    // Remove dragging class to re-enable animations
    document.body.classList.remove('dragging-active');
    
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveRepoId(null);
      return;
    }

    const activeIndex = repositoryOrder.indexOf(String(active.id));
    const overIndex = repositoryOrder.indexOf(String(over.id));

    if (activeIndex !== -1 && overIndex !== -1) {
      const newOrder = arrayMove(repositoryOrder, activeIndex, overIndex);
      setRepositoryOrder(newOrder);
      saveRepositoryOrder(newOrder);
    } else {
      // If not in saved order, create new order from current groups
      const currentOrder = repositoryGroups.map(([name]) => `repo-${name}`);
      const activeIdx = currentOrder.indexOf(String(active.id));
      const overIdx = currentOrder.indexOf(String(over.id));

      if (activeIdx !== -1 && overIdx !== -1) {
        const newOrder = arrayMove(currentOrder, activeIdx, overIdx);
        setRepositoryOrder(newOrder);
        saveRepositoryOrder(newOrder);
      }
    }

    setActiveRepoId(null);
  };

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

  // Apply custom ordering to repository groups
  const orderedRepositoryGroups = useMemo(() => {
    if (repositoryOrder.length === 0) {
      return repositoryGroups;
    }

    // Create a map for quick lookup
    const groupMap = new Map(repositoryGroups.map(([name, group]) => [`repo-${name}`, [name, group] as [string, typeof group]]));

    // Sort based on saved order
    const ordered: typeof repositoryGroups = [];
    const added = new Set<string>();

    // First add repositories in the saved order
    for (const repoKey of repositoryOrder) {
      const group = groupMap.get(repoKey);
      if (group && !added.has(repoKey)) {
        ordered.push(group);
        added.add(repoKey);
      }
    }

    // Then add any new repositories not in the saved order
    for (const [name, group] of repositoryGroups) {
      const repoKey = `repo-${name}`;
      if (!added.has(repoKey)) {
        ordered.push([name, group]);
      }
    }

    return ordered;
  }, [repositoryGroups, repositoryOrder]);

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

  return (
    <aside className="sidebar">
      <div className="sidebar-header" data-tauri-drag-region>
        <div className="sidebar-header-top" data-tauri-drag-region>
          {/* Title removed to avoid conflict with macOS traffic lights */}
          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
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
            {/* Quack Sound Button */}
            {onToggleQuackSound && (
              <button
                type="button"
                className="sidebar-button"
                onClick={onToggleQuackSound}
                style={{
                  background: quackSoundEnabled ? 'rgba(77, 212, 179, 0.2)' : 'rgba(255, 59, 48, 0.15)',
                  borderColor: quackSoundEnabled ? 'rgba(77, 212, 179, 0.4)' : 'rgba(255, 59, 48, 0.3)',
                  color: quackSoundEnabled ? '#4dd4b3' : '#ff3b30',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={quackSoundEnabled ? 'Sound ON (Click to disable)' : 'Sound OFF (Click to enable)'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {quackSoundEnabled ? (
                    // Volume ON icon
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </>
                  ) : (
                    // Volume OFF icon
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </>
                  )}
                </svg>
                Quack
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

      {/* Agent List - always shown in sidebar */}
      <div className="explorer-root-label sidebar-terminals-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '12px' }}>
        <span>ACTIVE AGENTS</span>
        {/* View Toggle Button - switches between Kanban and Agents */}
        <button
          type="button"
          onClick={onToggleKanbanView}
          style={{
            background: isKanbanViewActive ? 'rgba(242, 140, 82, 0.15)' : 'rgba(139, 92, 246, 0.15)',
            border: `1px solid ${isKanbanViewActive ? 'rgba(242, 140, 82, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 500,
            color: isKanbanViewActive ? '#f28c52' : '#8b5cf6',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
          }}
          title={isKanbanViewActive ? 'Switch to Agent List' : 'Switch to Kanban Board'}
        >
          {isKanbanViewActive ? (
            // Agents icon (people/users)
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ) : (
            // Kanban icon (columns)
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="15" rx="1" />
            </svg>
          )}
          {isKanbanViewActive ? 'Agents' : 'Kanban'}
        </button>
      </div>

      <div className="sidebar-list" style={{ marginTop: '5px' }}>
        {/* Metro Style View is now the only option */}

            {/* Metro-style repository groups with drag-and-drop */}
            <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleRepoDragStart}
            onDragEnd={handleRepoDragEnd}
          >
            <SortableContext
              items={orderedRepositoryGroups.map(([name]) => `repo-${name}`)}
              strategy={verticalListSortingStrategy}
            >
              {orderedRepositoryGroups.map(([repoName, group]) => {
                const repoKey = `repo-${repoName}`;
                const isCollapsed = collapsedGroups.has(repoKey);

                return (
                  <SortableRepositoryGroup
                    key={repoKey}
                    repoKey={repoKey}
                    repoPath={group.repoPath}
                    repoName={repoName}
                    mainAgents={group.mainAgents}
                    worktreeAgents={group.worktreeAgents}
                    isCollapsed={isCollapsed}
                    activeId={activeId}
                    chatSessions={chatSessions}
                    lastReadTimestamps={lastReadTimestamps}
                    onToggle={() => onToggleGroup(repoKey)}
                    onSelect={handleSelectTerminal}
                    onClose={onClose}
                    onContextMenu={handleContextMenu}
                    onGitOperation={handleGitOperation}
                    onOpenGitPanel={onOpenGitPanel}
                    onOpenTerminalWindow={onOpenTerminalWindow}
                    gitRefreshTrigger={gitRefreshTrigger}
                    onCreateAgent={onCreateAgent}
                  />
                );
              })}
            </SortableContext>

            {/* Drag Overlay - Ghost Preview for repositories */}
            <DragOverlay dropAnimation={null}>
              {activeRepoId ? (() => {
                const activeRepo = orderedRepositoryGroups.find(([name]) => `repo-${name}` === activeRepoId);
                if (!activeRepo) return null;
                
                const [repoName] = activeRepo;
                return (
                  <div
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(242, 140, 82, 0.15)',
                      border: '2px dashed #f28c52',
                      borderRadius: '6px',
                      boxShadow: '0 8px 24px rgba(242, 140, 82, 0.25), 0 0 40px rgba(242, 140, 82, 0.2)',
                      pointerEvents: 'none',
                      opacity: 0.8,
                    }}
                  >
                    <span className="font-semibold text-sm text-white/90">{repoName}</span>
                  </div>
                );
              })() : null}
            </DragOverlay>
          </DndContext>

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
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 animated-button"
                title="Start to Quack"
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
                <span className="typewriter-text"></span>
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

      {/* Background Tasks Button */}
      {onOpenBackgroundTasks && (
        <BackgroundTasksSidebarButton onClick={onOpenBackgroundTasks} />
      )}

      {/* Settings Button */}
      {onOpenSettings && (
        <button
          type="button"
          className={`sidebar-settings-button ${import.meta.env.DEV ? 'dev-mode' : ''}`}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="sidebar-settings-version">
                {appVersion}
                {import.meta.env.DEV && <span style={{ marginLeft: '4px', color: '#ef4444', fontWeight: 600 }}>DEV</span>}
              </span>
              {updateAvailable && latestRelease && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    fontWeight: 600,
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}
                  title={`New version ${latestRelease.tag_name} available`}
                >
                  UPDATE
                </span>
              )}
            </div>
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
