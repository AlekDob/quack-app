import { useState, useMemo, useEffect, useCallback, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-shell';
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
import KeyboardShortcutTooltip from "./KeyboardShortcutTooltip";
import { extractProjectId } from "../utils/projectUtils";
import type { TerminalInfo, AgentChat, ChatMessage, GitPullResult, AgentInfo } from "../types";

// Storage format for project order and colors
interface ProjectStorageData {
  order: string[];
  colors: Record<string, string>;
}

// Default color palette for auto-assignment
const DEFAULT_PROJECT_COLORS = [
  '#FF6B35', // Orange (Quack primary)
  '#4DA6FF', // Blue
  '#9B59B6', // Purple
  '#2ECC71', // Green
  '#E74C3C', // Red
  '#F39C12', // Yellow
  '#1ABC9C', // Teal
  '#E84393', // Pink
];

// Sortable Repository Group wrapper
interface SortableRepositoryGroupProps {
  repoKey: string;
  repoPath: string;
  repoName: string;
  mainAgents: TerminalInfo[];
  worktreeAgents: TerminalInfo[];
  isCollapsed: boolean;
  activeId: string | null;
  projectColor?: string; // Color for visual identification
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
  onCreateAgent?: (projectPath?: string) => void; // Create new agent, optionally with pre-selected project path
  onRemoveProject?: (projectPath: string) => void; // Remove project from sidebar
  onOpenDashboard?: (projectPath: string, projectName: string) => void; // Open Project Dashboard tab
  onOpenClaudeAssets?: (projectPath: string) => void; // Open Claude Assets tab with project pre-selected
  // Kanban tab props
  isKanbanTabActive?: boolean;
  onOpenKanbanTab?: () => void;
  // Chat loading state for task status indicators
  chatLoadingMap?: Map<string, boolean>;
  // Session props
  onSessionClick?: (sessionId: string) => void;
  activeSessionId?: string;
  // Open Agent Personality accordion
  onOpenPersonality?: () => void;
}

function SortableRepositoryGroup({
  repoKey,
  projectColor,
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
    // Solid background with project color (no glass effect)
    background: projectColor
      ? `${projectColor}10`
      : undefined,
    borderLeft: projectColor ? `3px solid ${projectColor}` : undefined,
    borderRadius: '0',
    marginBottom: '2px',
    padding: '4px',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-repository-group group relative"
    >
      {/* 🦆 Drag Handle for Repository Groups - ENABLED (important for project organization) */}
      <div
        className="absolute left-[6px] top-[10px] z-10"
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
  onCreateAgent: (projectPath?: string) => void; // Create AgentChat - optional project path to skip to agent selection
  // PiP props
  onTogglePip?: () => void;
  isPipOpen?: boolean;
  // Kanban tab props
  isKanbanTabActive?: boolean;
  onOpenKanbanTab?: () => void;
  inProgressTaskCount?: number; // Number of tasks in progress (for badge)
  // Quack sound props
  onToggleQuackSound?: () => void;
  quackSoundEnabled?: boolean;
  // Chat sessions
  chatSessions?: Map<string, ChatMessage[]>;
  lastReadTimestamps?: Map<string, number>; // 🔵 Read-once notification system
  chatLoadingMap?: Map<string, boolean>; // Loading state for task status indicators
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
  gitRefreshTrigger?: number; // Trigger to refresh git status after commit
  onOpenDashboard?: (projectPath: string, projectName: string) => void; // Open Project Dashboard tab
  onOpenClaudeAssets?: (projectPath: string) => void; // Open Claude Assets tab with project pre-selected
  onRemoveProject?: (projectPath: string) => void; // Remove project from sidebar
  persistedProjects?: Map<string, string>; // Projects that persist even with 0 agents (path -> name)
  onCreateTask?: (terminal: TerminalInfo) => void; // Create Kanban task for this agent
  // Session props
  onSessionClick?: (sessionId: string) => void;
  activeSessionId?: string;
  // Open Agent Personality accordion
  onOpenPersonality?: () => void;
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
  // Kanban tab props
  isKanbanTabActive = false,
  onOpenKanbanTab,
  inProgressTaskCount = 0,
  // Quack sound props
  onToggleQuackSound,
  quackSoundEnabled,
  // Chat sessions
  chatSessions,
  lastReadTimestamps,
  chatLoadingMap,
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
  gitRefreshTrigger,
  onOpenDashboard,
  onOpenClaudeAssets,
  onRemoveProject,
  persistedProjects,
  onCreateTask,
  onSessionClick,
  activeSessionId,
  onOpenPersonality,
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
  const [projectColors, setProjectColors] = useState<Record<string, string>>({});
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

  // Load saved repository order and colors on mount
  useEffect(() => {
    const loadOrderAndColors = async () => {
      try {
        const store = await Store.load('.quack-repo-order.dat');

        // Try new format first (with colors)
        const savedData = await store.get<ProjectStorageData | string[]>('repository-order');

        if (savedData) {
          // Check if it's old format (array) or new format (object)
          if (Array.isArray(savedData)) {
            // Old format - migrate to new format
            console.log('Migrating old repository order format to new format with colors');
            const migratedData: ProjectStorageData = {
              order: savedData,
              colors: {},
            };

            // Auto-assign colors to existing projects
            savedData.forEach((repoKey, index) => {
              migratedData.colors[repoKey] = DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];
            });

            // Save migrated data
            await store.set('repository-order', migratedData);
            await store.save();

            setRepositoryOrder(migratedData.order);
            setProjectColors(migratedData.colors);
          } else {
            // New format - use directly
            setRepositoryOrder(savedData.order);
            setProjectColors(savedData.colors);
          }
        }
      } catch (error) {
        console.error('Failed to load repository order:', error);
      }
    };
    loadOrderAndColors();
  }, []);

  // Save repository order and colors
  const saveRepositoryOrder = useCallback(async (order: string[], colors: Record<string, string>) => {
    try {
      const store = await Store.load('.quack-repo-order.dat');
      const data: ProjectStorageData = { order, colors };
      await store.set('repository-order', data);
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
      saveRepositoryOrder(newOrder, projectColors);
    } else {
      // If not in saved order, create new order from current groups
      const currentOrder = repositoryGroups.map(([name]) => `repo-${name}`);
      const activeIdx = currentOrder.indexOf(String(active.id));
      const overIdx = currentOrder.indexOf(String(over.id));

      if (activeIdx !== -1 && overIdx !== -1) {
        const newOrder = arrayMove(currentOrder, activeIdx, overIdx);
        setRepositoryOrder(newOrder);

        // Auto-assign colors to new projects not in the map
        const updatedColors = { ...projectColors };
        newOrder.forEach((repoKey, index) => {
          if (!updatedColors[repoKey]) {
            updatedColors[repoKey] = DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];
          }
        });
        setProjectColors(updatedColors);

        saveRepositoryOrder(newOrder, updatedColors);
      }
    }

    setActiveRepoId(null);
  };

  // No filtering at terminal level - we filter by project name instead
  const filteredTerminals = useMemo(() => {
    return terminals;
  }, [terminals]);

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
      const lastPart = extractProjectId(cwd);

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

    // Add persisted projects that have no terminals (empty projects)
    if (persistedProjects) {
      for (const [projectPath, projectName] of persistedProjects) {
        const dirName = extractProjectId(projectPath) || projectName;
        if (!repoMap.has(dirName)) {
          repoMap.set(dirName, {
            mainAgents: [],
            worktreeAgents: [],
            repoPath: projectPath,
          });
        }
      }
    }

    return Array.from(repoMap.entries());
  }, [filteredTerminals, persistedProjects]);

  // Apply custom ordering to repository groups, auto-assign colors, and filter by project name
  const orderedRepositoryGroups = useMemo(() => {
    // First filter by project name if query exists
    const filteredGroups = query
      ? repositoryGroups.filter(([name]) => fuzzyMatch(query, name))
      : repositoryGroups;

    if (repositoryOrder.length === 0) {
      return filteredGroups;
    }

    // Create a map for quick lookup
    const groupMap = new Map(filteredGroups.map(([name, group]) => [`repo-${name}`, [name, group] as [string, typeof group]]));

    // Sort based on saved order
    const ordered: typeof filteredGroups = [];
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
    const newRepos: string[] = [];
    for (const [name, group] of filteredGroups) {
      const repoKey = `repo-${name}`;
      if (!added.has(repoKey)) {
        ordered.push([name, group]);
        newRepos.push(repoKey);
      }
    }

    // Auto-assign colors to new projects
    if (newRepos.length > 0) {
      const updatedColors = { ...projectColors };
      const updatedOrder = [...repositoryOrder, ...newRepos];

      newRepos.forEach((repoKey, index) => {
        if (!updatedColors[repoKey]) {
          const colorIndex = (repositoryOrder.length + index) % DEFAULT_PROJECT_COLORS.length;
          updatedColors[repoKey] = DEFAULT_PROJECT_COLORS[colorIndex];
        }
      });

      // Update state and persist
      setProjectColors(updatedColors);
      setRepositoryOrder(updatedOrder);
      saveRepositoryOrder(updatedOrder, updatedColors);
    }

    return ordered;
  }, [repositoryGroups, repositoryOrder, projectColors, saveRepositoryOrder, query]);

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
  // When clicking an agent, just select it (tab switching is handled by App.tsx)
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
    <aside className="sidebar sidebar-codex">
      {/* Top area next to traffic lights */}
      <div className="sidebar-header-top" data-tauri-drag-region>
        <KeyboardShortcutTooltip label="New Project" shortcut="⌘N">
          <button
            type="button"
            className="new-project-btn-sidebar"
            onClick={() => onCreateAgent()}
            aria-label="New Project (⌘N)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>New project</span>
          </button>
        </KeyboardShortcutTooltip>
      </div>

      <div className="sidebar-header sidebar-header-codex" data-tauri-drag-region>
        <input
          className="explorer-search explorer-search-codex"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects"
        />
      </div>

      {/* Agent List - no label, directly the list */}
      <div className="sidebar-list" style={{ marginTop: '4px' }}>
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
                const projectColor = projectColors[repoKey];

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
                    projectColor={projectColor}
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
                    onRemoveProject={onRemoveProject}
                    onOpenDashboard={onOpenDashboard}
                    onOpenClaudeAssets={onOpenClaudeAssets}
                    isKanbanTabActive={isKanbanTabActive}
                    onOpenKanbanTab={onOpenKanbanTab}
                    chatLoadingMap={chatLoadingMap}
                    onSessionClick={onSessionClick}
                    activeSessionId={activeSessionId}
                    onOpenPersonality={onOpenPersonality}
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

        {/* Empty state - Onboarding CTA (only when no projects at all) */}
        {terminals.length === 0 && (!persistedProjects || persistedProjects.size === 0) && (
          <div className="empty-state">
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(242, 140, 82, 0.25) 0%, rgba(242, 140, 82, 0.05) 70%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  boxShadow: '0 0 40px rgba(242, 140, 82, 0.15)',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f28c52" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                Create your first project
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, maxWidth: 220, lineHeight: 1.5 }}>
                Set up a project and start working with AI agents.
              </p>
              <button
                type="button"
                onClick={() => onCreateAgent()}
                className="onboarding-cta-button"
                title="Create your first project"
                style={{
                  background: 'linear-gradient(135deg, #f28c52 0%, #e06b2a 100%)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  padding: '10px 28px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 20px rgba(242, 140, 82, 0.35), 0 0 0 1px rgba(242, 140, 82, 0.2)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 28px rgba(242, 140, 82, 0.5), 0 0 0 1px rgba(242, 140, 82, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(242, 140, 82, 0.35), 0 0 0 1px rgba(242, 140, 82, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Get Started
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
          onCreateTask={onCreateTask ? () => onCreateTask(contextMenu.terminal) : undefined}
        />
      )}

      {/* Footer Bar - Minimal with text labels */}
      <div className="sidebar-footer-bar">
        {/* Left side: Settings + Docs with labels */}
        <div className="sidebar-footer-left">
          {/* Settings */}
          {onOpenSettings && (
            <button
              type="button"
              className="sidebar-footer-link"
              onClick={onOpenSettings}
              title="Settings"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span>Settings</span>
            </button>
          )}

          {/* Docs */}
          <button
            type="button"
            className="sidebar-footer-link"
            onClick={() => open('https://quack.build/docs')}
            title="Opens in browser"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span>Docs</span>
          </button>
        </div>

        {/* Right side: Version Tag */}
        <span
          className={`sidebar-footer-version ${import.meta.env.DEV ? 'sidebar-footer-version-dev' : 'sidebar-footer-version-prod'}`}
          title={`Version ${appVersion}${import.meta.env.DEV ? ' (DEV)' : ''}`}
        >
          {appVersion.startsWith('v') ? appVersion : `v${appVersion}`}
          {import.meta.env.DEV && <span className="sidebar-footer-dev">DEV</span>}
          {updateAvailable && latestRelease && (
            <span className="sidebar-footer-update" title={`Update to ${latestRelease.tag_name}`}>
              •
            </span>
          )}
        </span>
      </div>

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
