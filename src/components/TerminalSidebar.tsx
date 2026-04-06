import { useState, useMemo, useEffect, useCallback, useRef, type MouseEvent } from "react";
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
import { formatShortcut } from "../utils/platform";
import type { TerminalInfo, AgentChat, ChatMessage, GitPullResult, AgentInfo, ProjectGroup } from "../types";
import { useGroupStore } from "../stores/groupStore";
import { useUIStore } from "../stores/uiStore";
import GroupCreationModal from "./GroupCreationModal";
import SidebarViewToggle from "./SidebarViewToggle";
import TaskHubView from "./TaskHubView";

// Storage format for project order, colors, and favorites
interface ProjectStorageData {
  order: string[];
  colors: Record<string, string>;
  favorites?: string[]; // Array of favorited repoKeys (e.g. "repo-quack-app")
}

// Default color palette for auto-assignment
const DEFAULT_PROJECT_COLORS = [
  '#FF6B35', // Orange (Quack primary) — fallback hex; accent uses var(--accent-color) at runtime
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
  insideGroup?: boolean;
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
  onOpenBrain?: (projectPath: string) => void; // Open Brain window for this project
  gitRefreshTrigger?: number;
  onCreateAgent?: (projectPath?: string) => void; // Create new agent, optionally with pre-selected project path
  onRemoveProject?: (projectPath: string) => void; // Remove project from sidebar
  onOpenDashboard?: (projectPath: string, projectName: string) => void; // Open Project Dashboard tab
  onOpenClaudeAssets?: (projectPath: string) => void; // Open Claude Assets tab with project pre-selected
  // Kanban tab props
  isKanbanViewActive?: boolean;
  onOpenKanbanTab?: () => void;
  // Chat loading state for task status indicators
  chatLoadingMap?: Map<string, boolean>;
  // Session props
  onSessionClick?: (sessionId: string) => void;
  activeSessionId?: string;
  /** Called when the active session is marked as done (to navigate back to agent view) */
  onActiveSessionDone?: () => void;
  // Open Agent Personality accordion
  onOpenPersonality?: () => void;
  // Saved Commands (per-project)
  onOpenSavedCommands?: (projectPath: string) => void;
  // Favorite/star
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onProjectColorChange?: (color: string) => void;
}

function SortableRepositoryGroup({
  repoKey,
  projectColor,
  insideGroup,
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
    // No background — border-left + subtle bottom separator
    // Inside a group: skip project borders — the group's dashed border is enough
    background: 'transparent',
    borderLeft: insideGroup ? 'none' : (projectColor ? `2px solid ${projectColor}` : undefined),
    borderBottom: insideGroup ? 'none' : (projectColor ? `2px solid ${projectColor}30` : '2px solid rgba(255,255,255,0.04)'),
    borderRadius: '0',
    marginBottom: '0',
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
        <RepositoryGroup {...props} projectColor={projectColor} />
      </div>
    </div>
  );
}

// Sortable wrapper for group sections (makes entire groups draggable)
interface SortableGroupRenderProps {
  dragHandleProps: Record<string, unknown>;
  isDragging: boolean;
}

function SortableGroupSection({
  sectionId,
  children,
}: {
  sectionId: string;
  children: (props: SortableGroupRenderProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    willChange: isDragging ? 'transform' : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging })}
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
  onOpenBrain?: (projectPath: string) => void; // Open Brain window for this project
  gitRefreshTrigger?: number; // Trigger to refresh git status after commit
  onOpenDashboard?: (projectPath: string, projectName: string) => void; // Open Project Dashboard tab
  onOpenClaudeAssets?: (projectPath: string) => void; // Open Claude Assets tab with project pre-selected
  onRemoveProject?: (projectPath: string) => void; // Remove project from sidebar
  persistedProjects?: Map<string, string>; // Projects that persist even with 0 agents (path -> name)
  onCreateTask?: (terminal: TerminalInfo) => void; // Create Kanban task for this agent
  // Session props
  onSessionClick?: (sessionId: string) => void;
  activeSessionId?: string;
  /** Called when the active session is marked as done (to navigate back to agent view) */
  onActiveSessionDone?: () => void;
  // Open Agent Personality accordion
  onOpenPersonality?: () => void;
  // Saved Commands
  onOpenSavedCommands?: () => void; // Global (footer button)
  onOpenProjectSavedCommands?: (projectPath: string) => void; // Per-project (repo action row)
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
  onOpenBrain,
  gitRefreshTrigger,
  onOpenDashboard,
  onOpenClaudeAssets,
  onRemoveProject,
  persistedProjects,
  onCreateTask,
  onSessionClick,
  activeSessionId,
  onActiveSessionDone,
  onOpenPersonality,
  onOpenSavedCommands,
  onOpenProjectSavedCommands,
}: TerminalSidebarProps) {
  void _onColorChange;
  void _onDeleteAgentChat; // Will be used in context menu (Phase 4)
  void _onUpdateAgentChat; // Will be used in rename functionality (Phase 4)
  void _onReorder; // Drag & drop reordering functionality (currently disabled)
  void onAdd; // Used by "+" button in toolbar (kept for future use)
  const [query, setQuery] = useState("");
  const [appVersion, setAppVersion] = useState('v0.0.0');

  // Sidebar view toggle (projects vs task hub)
  const sidebarView = useUIStore((s) => s.sidebarView);
  const setSidebarView = useUIStore((s) => s.setSidebarView);

  // Fetch app version on mount
  useEffect(() => {
    getCurrentVersion().then(version => setAppVersion(`v${version}`));
  }, []);

  // Check for updates
  const { updateAvailable, latestRelease } = useUpdateChecker();

  // Project groups (cross-project linking)
  const groups = useGroupStore((s) => s.groups);
  const loadGroups = useGroupStore((s) => s.loadGroups);
  const deleteGroup = useGroupStore((s) => s.deleteGroup);
  const updateGroup = useGroupStore((s) => s.updateGroup);
  const [collapsedGroupSections, setCollapsedGroupSections] = useState<Set<string>>(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupContextMenu, setGroupContextMenu] = useState<{
    position: { x: number; y: number };
    groupId: string;
    groupName: string;
  } | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const toggleGroupSection = useCallback((groupId: string) => {
    setCollapsedGroupSections((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleGroupContextMenu = useCallback((e: MouseEvent, groupId: string, groupName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setGroupContextMenu({ position: { x: e.clientX, y: e.clientY }, groupId, groupName });
  }, []);

  const handleDisbandGroup = useCallback(async (groupId: string) => {
    try {
      await deleteGroup(groupId);
      setGroupContextMenu(null);
      console.log(`[TerminalSidebar] Disbanded group: ${groupId}`);
    } catch (error) {
      console.error('[TerminalSidebar] Failed to disband group:', error);
    }
  }, [deleteGroup]);

  const handleRemoveFromGroup = useCallback(async (groupId: string, projectPath: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const remaining = group.projects.filter((p) => p.path !== projectPath);
    if (remaining.length < 2) {
      // Less than 2 projects — disband the group entirely
      await handleDisbandGroup(groupId);
    } else {
      try {
        await updateGroup(groupId, { projects: remaining });
        setGroupContextMenu(null);
        console.log(`[TerminalSidebar] Removed project from group: ${projectPath}`);
      } catch (error) {
        console.error('[TerminalSidebar] Failed to remove project from group:', error);
      }
    }
  }, [groups, handleDisbandGroup, updateGroup]);

  // === ADD PROJECT TO GROUP ===
  const handleAddToGroup = useCallback(async (groupId: string, projectPath: string, projectLabel: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    try {
      const updated = [...group.projects, { path: projectPath, label: projectLabel, role: 'member' }];
      await updateGroup(groupId, { projects: updated });
      setGroupContextMenu(null);
    } catch (error) {
      console.error('[TerminalSidebar] Failed to add project to group:', error);
    }
  }, [groups, updateGroup]);

  const handleStartRenameGroup = useCallback((groupId: string, currentName: string) => {
    setRenamingGroupId(groupId);
    setRenameValue(currentName);
    setGroupContextMenu(null);
    // Focus the input after render
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, []);

  const handleConfirmRenameGroup = useCallback(async () => {
    if (!renamingGroupId) return;
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== groups.find((g) => g.id === renamingGroupId)?.name) {
      try {
        await updateGroup(renamingGroupId, { name: trimmed });
      } catch (error) {
        console.error('[TerminalSidebar] Failed to rename group:', error);
      }
    }
    setRenamingGroupId(null);
    setRenameValue('');
  }, [renamingGroupId, renameValue, groups, updateGroup]);

  // Metro style is now the only option (removed useMetroStyle state)
  const [repositoryOrder, setRepositoryOrder] = useState<string[]>([]);
  const [projectColors, setProjectColors] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const favoritesRef = useRef<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
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
            if (savedData.favorites) {
              const loadedFavs = new Set(savedData.favorites);
              favoritesRef.current = loadedFavs;
              setFavorites(loadedFavs);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load repository order:', error);
      }
    };
    loadOrderAndColors();
  }, []);

  // Save repository order, colors, and favorites
  const saveRepositoryOrder = useCallback(async (order: string[], colors: Record<string, string>, favs: Set<string>) => {
    try {
      const store = await Store.load('.quack-repo-order.dat');
      const data: ProjectStorageData = { order, colors, favorites: Array.from(favs) };
      await store.set('repository-order', data);
      await store.save();
    } catch (error) {
      console.error('Failed to save repository order:', error);
    }
  }, []);

  // Toggle a project's favorite status (uses ref to avoid stale closure on rapid clicks)
  const toggleFavorite = useCallback((repoKey: string) => {
    const next = new Set(favoritesRef.current);
    if (next.has(repoKey)) {
      next.delete(repoKey);
    } else {
      next.add(repoKey);
    }
    favoritesRef.current = next;
    setFavorites(next);
    saveRepositoryOrder(repositoryOrder, projectColors, next);
  }, [repositoryOrder, projectColors, saveRepositoryOrder]);

  // Handle project color change from inline picker
  const handleProjectColorChange = useCallback((repoKey: string, color: string) => {
    const updated = { ...projectColors, [repoKey]: color };
    setProjectColors(updated);
    saveRepositoryOrder(repositoryOrder, updated, favoritesRef.current);
  }, [projectColors, repositoryOrder, saveRepositoryOrder]);

  // Handle repository drag start
  const handleRepoDragStart = (event: DragStartEvent) => {
    setActiveRepoId(String(event.active.id));
    // Add class to disable animations for performance
    document.body.classList.add('dragging-active');
  };

  // Handle repository drag end — works on section-level IDs
  const handleRepoDragEnd = (event: DragEndEvent) => {
    // Remove dragging class to re-enable animations
    document.body.classList.remove('dragging-active');

    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveRepoId(null);
      return;
    }

    // Build current section IDs from sidebarSections
    const currentSectionIds = sidebarSections.map((s) =>
      s.type === 'group' ? `group-${s.group.id}` : `repo-${s.project[0]}`
    );

    const activeIdx = currentSectionIds.indexOf(String(active.id));
    const overIdx = currentSectionIds.indexOf(String(over.id));

    if (activeIdx !== -1 && overIdx !== -1) {
      // Reorder sections
      const newSectionOrder = arrayMove(sidebarSections, activeIdx, overIdx);

      // Flatten sections back to repo-* order for persistence
      const newRepoOrder: string[] = [];
      for (const section of newSectionOrder) {
        if (section.type === 'standalone') {
          newRepoOrder.push(`repo-${section.project[0]}`);
        } else {
          for (const [name] of section.projects) {
            newRepoOrder.push(`repo-${name}`);
          }
        }
      }

      setRepositoryOrder(newRepoOrder);

      // Auto-assign colors to any new projects
      const updatedColors = { ...projectColors };
      newRepoOrder.forEach((repoKey, index) => {
        if (!updatedColors[repoKey]) {
          updatedColors[repoKey] = DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];
        }
      });
      setProjectColors(updatedColors);

      saveRepositoryOrder(newRepoOrder, updatedColors, favorites);
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

    let ordered: typeof filteredGroups;

    if (repositoryOrder.length === 0) {
      ordered = filteredGroups;
    } else {
      // Create a map for quick lookup
      const groupMap = new Map(filteredGroups.map(([name, group]) => [`repo-${name}`, [name, group] as [string, typeof group]]));

      // Sort based on saved order
      ordered = [];
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
        saveRepositoryOrder(updatedOrder, updatedColors, favorites);
      }
    }

    return ordered;
  }, [repositoryGroups, repositoryOrder, projectColors, saveRepositoryOrder, query]);

  // Organize projects into group sections vs standalone
  type RepoEntry = typeof orderedRepositoryGroups[number];
  interface GroupedSection { type: 'group'; group: ProjectGroup; projects: RepoEntry[] }
  interface StandaloneSection { type: 'standalone'; project: RepoEntry }
  type SidebarSection = GroupedSection | StandaloneSection;

  const sidebarSections = useMemo((): SidebarSection[] => {
    if (groups.length === 0) {
      // No groups — all standalone
      return orderedRepositoryGroups.map((p) => ({ type: 'standalone', project: p }));
    }

    // Map repoPath → group
    const pathToGroup = new Map<string, ProjectGroup>();
    for (const g of groups) {
      for (const member of g.projects) {
        pathToGroup.set(member.path, g);
      }
    }

    // Collect by group id, preserving the order of first appearance
    const groupBuckets = new Map<string, { group: ProjectGroup; projects: RepoEntry[] }>();
    const sections: SidebarSection[] = [];
    const emittedGroups = new Set<string>();

    for (const entry of orderedRepositoryGroups) {
      const [, data] = entry;
      const group = pathToGroup.get(data.repoPath);
      if (group) {
        if (!groupBuckets.has(group.id)) {
          groupBuckets.set(group.id, { group, projects: [] });
        }
        groupBuckets.get(group.id)!.projects.push(entry);
        // Emit the group section at the position of its first member
        if (!emittedGroups.has(group.id)) {
          emittedGroups.add(group.id);
          // Push a placeholder; we'll fill projects at the end
          sections.push({ type: 'group', group, projects: groupBuckets.get(group.id)!.projects });
        }
      } else {
        sections.push({ type: 'standalone', project: entry });
      }
    }

    return sections;
  }, [orderedRepositoryGroups, groups]);

  // Apply favorites filter when toggled on
  const filteredSidebarSections = useMemo((): SidebarSection[] => {
    if (!showFavoritesOnly || favorites.size === 0) return sidebarSections;
    return sidebarSections.reduce<SidebarSection[]>((acc, section) => {
      if (section.type === 'standalone') {
        if (favorites.has(`repo-${section.project[0]}`)) {
          acc.push(section);
        }
      } else {
        // Group: filter to only favorited projects within
        const favProjects = section.projects.filter(([name]) => favorites.has(`repo-${name}`));
        if (favProjects.length > 0) {
          acc.push({ ...section, projects: favProjects });
        }
      }
      return acc;
    }, []);
  }, [sidebarSections, showFavoritesOnly, favorites]);

  // Compute section-level IDs for the top-level SortableContext
  const sectionIds = useMemo(() => {
    return filteredSidebarSections.map((s) =>
      s.type === 'group' ? `group-${s.group.id}` : `repo-${s.project[0]}`
    );
  }, [filteredSidebarSections]);

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
        <KeyboardShortcutTooltip label="New Project" shortcut={formatShortcut("⌘N")}>
          <button
            type="button"
            className="new-project-btn-sidebar"
            onClick={() => onCreateAgent()}
            aria-label={`New Project (${formatShortcut("⌘N")})`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>New project</span>
          </button>
        </KeyboardShortcutTooltip>

        {/* Create Group button — only show when 2+ projects exist */}
        {orderedRepositoryGroups.length >= 2 && (
          <KeyboardShortcutTooltip label="Create Group">
            <button
              type="button"
              className="new-project-btn-sidebar action-icon"
              onClick={() => setShowGroupModal(true)}
              aria-label="Create Group"
              style={{ marginLeft: '4px', padding: '0 6px', height: '22px', minWidth: 'unset', boxSizing: 'border-box' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            </button>
          </KeyboardShortcutTooltip>
        )}

        <SidebarViewToggle activeView={sidebarView} onChange={setSidebarView} />

        {/* Favorites filter toggle */}
        {favorites.size > 0 && (
          <KeyboardShortcutTooltip label={showFavoritesOnly ? "Show all" : "Favorites"}>
            <button
              type="button"
              className="action-icon"
              onClick={() => setShowFavoritesOnly((prev) => !prev)}
              aria-label={showFavoritesOnly ? "Show all projects" : "Show favorites only"}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '22px',
                marginLeft: '4px',
                background: showFavoritesOnly ? 'var(--accent-surface)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: showFavoritesOnly ? 'var(--accent-color)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill={showFavoritesOnly ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          </KeyboardShortcutTooltip>
        )}
      </div>

      <div className="sidebar-header sidebar-header-codex" data-tauri-drag-region>
        <input
          className="explorer-search explorer-search-codex"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={sidebarView === 'taskhub' ? "Search tasks" : "Search projects"}
        />
      </div>

      {/* Agent List - no label, directly the list */}
      <div className="sidebar-list" style={{ marginTop: '4px' }}>
        {/* Task Hub: flat priority-sorted session list */}
        {sidebarView === 'taskhub' && (
          <TaskHubView
            terminals={terminals}
            onSessionClick={onSessionClick}
            activeSessionId={activeSessionId}
            onActiveSessionDone={onActiveSessionDone}
            chatSessions={chatSessions}
            lastReadTimestamps={lastReadTimestamps}
            searchQuery={query}
          />
        )}

        {/* Projects view: metro-style repository groups */}
        {sidebarView === 'projects' && (
            <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleRepoDragStart}
            onDragEnd={handleRepoDragEnd}
          >
            <SortableContext
              items={sectionIds}
              strategy={verticalListSortingStrategy}
            >
              {filteredSidebarSections.map((section) => {
                if (section.type === 'standalone') {
                  const [repoName, repoData] = section.project;
                  const repoKey = `repo-${repoName}`;
                  return (
                    <SortableRepositoryGroup
                      key={repoKey}
                      repoKey={repoKey}
                      repoPath={repoData.repoPath}
                      repoName={repoName}
                      mainAgents={repoData.mainAgents}
                      worktreeAgents={repoData.worktreeAgents}
                      isCollapsed={collapsedGroups.has(repoKey)}
                      activeId={activeId}
                      projectColor={projectColors[repoKey]}
                      chatSessions={chatSessions}
                      lastReadTimestamps={lastReadTimestamps}
                      onToggle={() => onToggleGroup(repoKey)}
                      onSelect={handleSelectTerminal}
                      onClose={onClose}
                      onContextMenu={handleContextMenu}
                      onGitOperation={handleGitOperation}
                      onOpenGitPanel={onOpenGitPanel}
                      onOpenTerminalWindow={onOpenTerminalWindow}
                      onOpenBrain={onOpenBrain}
                      gitRefreshTrigger={gitRefreshTrigger}
                      onCreateAgent={onCreateAgent}
                      onRemoveProject={onRemoveProject}
                      onOpenDashboard={onOpenDashboard}
                      onOpenClaudeAssets={onOpenClaudeAssets}
                      isKanbanViewActive={isKanbanTabActive}
                      onOpenKanbanTab={onOpenKanbanTab}
                      chatLoadingMap={chatLoadingMap}
                      onSessionClick={onSessionClick}
                      activeSessionId={activeSessionId}
                      onActiveSessionDone={onActiveSessionDone}
                      onOpenPersonality={onOpenPersonality}
                      onOpenSavedCommands={onOpenProjectSavedCommands}
                      isFavorite={favorites.has(repoKey)}
                      onToggleFavorite={() => toggleFavorite(repoKey)}
                      onProjectColorChange={(color: string) => handleProjectColorChange(repoKey, color)}
                    />
                  );
                }

                // Group section — collapsible wrapper around multiple projects
                const { group: grp, projects } = section;
                const isGroupCollapsed = collapsedGroupSections.has(grp.id);
                const groupColor = grp.color || 'var(--accent-color)';

                return (
                  <SortableGroupSection key={`grp-${grp.id}`} sectionId={`group-${grp.id}`}>
                  {({ dragHandleProps, isDragging: isGroupDragging }) => (
                  <div className="sidebar-group-section group" style={{ marginBottom: '4px' }}>
                    {/* Group Header */}
                    <div
                      className="sidebar-group-header"
                      onContextMenu={(e) => handleGroupContextMenu(e, grp.id, grp.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        width: '100%',
                        padding: '5px 6px',
                        background: `${groupColor}12`,
                        border: 'none',
                        borderRadius: isGroupCollapsed ? '6px' : '6px 6px 0 0',
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.75)',
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        position: 'relative',
                      }}
                      onClick={() => toggleGroupSection(grp.id)}
                    >
                      {/* Mini drag handle — inline in group header */}
                      <div
                        {...dragHandleProps}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          cursor: isGroupDragging ? 'grabbing' : 'grab',
                          opacity: 0,
                          transition: 'opacity 0.15s ease',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 1px',
                        }}
                        className="group-hover:!opacity-50"
                      >
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="rgba(255,255,255,0.6)" style={{ pointerEvents: 'none' }}>
                          <circle cx="2" cy="3" r="1.2" />
                          <circle cx="6" cy="3" r="1.2" />
                          <circle cx="2" cy="7" r="1.2" />
                          <circle cx="6" cy="7" r="1.2" />
                          <circle cx="2" cy="11" r="1.2" />
                          <circle cx="6" cy="11" r="1.2" />
                        </svg>
                      </div>
                      {/* Chevron */}
                      <svg
                        width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke={groupColor} strokeWidth="2.5"
                        style={{
                          transform: isGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                          flexShrink: 0,
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      {/* Group color dot */}
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: groupColor, flexShrink: 0,
                      }} />
                      {renamingGroupId === grp.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRenameGroup();
                            if (e.key === 'Escape') { setRenamingGroupId(null); setRenameValue(''); }
                          }}
                          onBlur={handleConfirmRenameGroup}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            flex: 1, background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '3px', padding: '1px 4px',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '10px', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={{ flex: 1, textAlign: 'left' }}>{grp.name}</span>
                      )}
                      <span style={{
                        fontSize: '8px', opacity: 0.35, letterSpacing: '0.08em',
                        fontWeight: 500,
                      }}>
                        GROUP · {projects.length}
                      </span>
                      {/* Hover action icons */}
                      <span
                        className="group-header-actions"
                        style={{
                          display: 'flex',
                          gap: '2px',
                          opacity: 0,
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        {/* Disband group */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDisbandGroup(grp.id); }}
                          title="Disband group"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px', borderRadius: '3px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    </div>

                    {/* Group Projects (collapsible) — dashed border shows belonging */}
                    {!isGroupCollapsed && (
                    <div style={{
                      borderLeft: `2px dashed ${groupColor}`,
                      borderRight: `2px dashed ${groupColor}`,
                      borderBottom: `2px dashed ${groupColor}`,
                      borderTop: 'none',
                      borderRadius: '0 0 6px 6px',
                      padding: '4px 2px 2px 2px',
                      marginBottom: '2px',
                    }}>
                    {projects.map(([repoName, repoData]) => {
                      const repoKey = `repo-${repoName}`;
                      return (
                        <SortableRepositoryGroup
                          key={repoKey}
                          repoKey={repoKey}
                          insideGroup
                          repoPath={repoData.repoPath}
                          repoName={repoName}
                          mainAgents={repoData.mainAgents}
                          worktreeAgents={repoData.worktreeAgents}
                          isCollapsed={collapsedGroups.has(repoKey)}
                          activeId={activeId}
                          projectColor={projectColors[repoKey]}
                          chatSessions={chatSessions}
                          lastReadTimestamps={lastReadTimestamps}
                          onToggle={() => onToggleGroup(repoKey)}
                          onSelect={handleSelectTerminal}
                          onClose={onClose}
                          onContextMenu={handleContextMenu}
                          onGitOperation={handleGitOperation}
                          onOpenGitPanel={onOpenGitPanel}
                          onOpenTerminalWindow={onOpenTerminalWindow}
                          onOpenBrain={onOpenBrain}
                          gitRefreshTrigger={gitRefreshTrigger}
                          onCreateAgent={onCreateAgent}
                          onRemoveProject={onRemoveProject}
                          onOpenDashboard={onOpenDashboard}
                          onOpenClaudeAssets={onOpenClaudeAssets}
                          isKanbanViewActive={isKanbanTabActive}
                          onOpenKanbanTab={onOpenKanbanTab}
                          chatLoadingMap={chatLoadingMap}
                          onSessionClick={onSessionClick}
                          activeSessionId={activeSessionId}
                          onActiveSessionDone={onActiveSessionDone}
                          onOpenPersonality={onOpenPersonality}
                          onOpenSavedCommands={onOpenProjectSavedCommands}
                          isFavorite={favorites.has(repoKey)}
                          onToggleFavorite={() => toggleFavorite(repoKey)}
                          onProjectColorChange={(color: string) => handleProjectColorChange(repoKey, color)}
                        />
                      );
                    })}
                    </div>
                    )}
                  </div>
                  )}
                  </SortableGroupSection>
                );
              })}
            </SortableContext>

            {/* Drag Overlay - Ghost Preview for repositories and groups */}
            <DragOverlay dropAnimation={null}>
              {activeRepoId ? (() => {
                // Check if dragging a group section
                if (activeRepoId.startsWith('group-')) {
                  const groupId = activeRepoId.replace('group-', '');
                  const groupSection = sidebarSections.find(
                    (s) => s.type === 'group' && s.group.id === groupId
                  );
                  if (!groupSection || groupSection.type !== 'group') return null;
                  const groupColor = groupSection.group.color || 'var(--accent-color)';
                  return (
                    <div
                      style={{
                        padding: '10px 12px',
                        background: `${groupColor}25`,
                        border: `2px dashed ${groupColor}`,
                        borderRadius: '6px',
                        boxShadow: `0 8px 24px ${groupColor}40, 0 0 40px ${groupColor}30`,
                        pointerEvents: 'none',
                        opacity: 0.8,
                      }}
                    >
                      <span className="font-semibold text-sm text-white/90">{groupSection.group.name}</span>
                      <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>
                        {groupSection.projects.length} projects
                      </span>
                    </div>
                  );
                }

                // Standalone project
                const activeRepo = orderedRepositoryGroups.find(([name]) => `repo-${name}` === activeRepoId);
                if (!activeRepo) return null;

                const [repoName] = activeRepo;
                return (
                  <div
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(var(--accent-rgb), 0.15)',
                      border: '2px dashed var(--accent-color)',
                      borderRadius: '6px',
                      boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.25), 0 0 40px rgba(var(--accent-rgb), 0.2)',
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
        )}

        {/* Empty state - Onboarding CTA (only when no projects at all) */}
        {terminals.length === 0 && (!persistedProjects || persistedProjects.size === 0) && (
          <div className="empty-state">
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.25) 0%, rgba(var(--accent-rgb), 0.05) 70%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  boxShadow: '0 0 40px rgba(var(--accent-rgb), 0.15)',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth={1.5}>
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
                  background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-gradient-end) 100%)',
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
                  boxShadow: '0 4px 20px rgba(var(--accent-rgb), 0.35), 0 0 0 1px rgba(var(--accent-rgb), 0.2)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 28px rgba(var(--accent-rgb), 0.5), 0 0 0 1px rgba(var(--accent-rgb), 0.4)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--accent-rgb), 0.35), 0 0 0 1px rgba(var(--accent-rgb), 0.2)';
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

      {/* Group context menu */}
      {groupContextMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999,
          }}
          onClick={() => setGroupContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setGroupContextMenu(null); }}
        >
          <div
            style={{
              position: 'absolute',
              top: groupContextMenu.position.y,
              left: groupContextMenu.position.x,
              background: 'rgba(30, 30, 30, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '4px',
              minWidth: '180px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Group name label */}
            <div style={{
              padding: '6px 10px',
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.4)',
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '2px',
            }}>
              {groupContextMenu.groupName}
            </div>

            {/* Rename group */}
            <button
              onClick={() => handleStartRenameGroup(groupContextMenu.groupId, groupContextMenu.groupName)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px', background: 'none',
                border: 'none', cursor: 'pointer', borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                <path d="M17 3a2.85 2.85 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              Rename group
            </button>

            {/* Group color picker */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 10px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" fill="rgba(255,255,255,0.4)" />
              </svg>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {DEFAULT_PROJECT_COLORS.map((color) => {
                  const grp = groups.find((g) => g.id === groupContextMenu.groupId);
                  const isActive = grp?.color === color;
                  return (
                    <button
                      key={color}
                      onClick={async () => {
                        await updateGroup(groupContextMenu.groupId, { color });
                        setGroupContextMenu(null);
                      }}
                      style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: color, border: isActive
                          ? '2px solid rgba(255,255,255,0.9)'
                          : '1.5px solid rgba(255,255,255,0.15)',
                        cursor: 'pointer', padding: 0,
                        transition: 'transform 0.1s ease, border-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                      title={color}
                    />
                  );
                })}
              </div>
            </div>

            {/* Separator */}
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)', margin: '2px 0' }} />

            {/* Remove individual projects */}
            {(() => {
              const grp = groups.find((g) => g.id === groupContextMenu.groupId);
              if (!grp) return null;
              return grp.projects.map((p) => {
                const projectName = p.label || p.path.replace(/^[\\/]{2}\?[\\/]/, '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p.path;
                return (
                  <button
                    key={p.path}
                    onClick={() => handleRemoveFromGroup(groupContextMenu.groupId, p.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      width: '100%', padding: '7px 10px', background: 'none',
                      border: 'none', cursor: 'pointer', borderRadius: '4px',
                      color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Remove {projectName}
                  </button>
                );
              });
            })()}

            {/* Add project to group — shows projects not already in this group */}
            {(() => {
              const grp = groups.find((g) => g.id === groupContextMenu.groupId);
              if (!grp) return null;
              const groupPaths = new Set(grp.projects.map((p) => p.path));
              const available = orderedRepositoryGroups.filter(
                ([, data]) => !groupPaths.has(data.repoPath),
              );
              if (available.length === 0) return null;
              return (
                <>
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)', margin: '2px 0' }} />
                  {available.map(([name, data]) => (
                    <button
                      key={data.repoPath}
                      onClick={() => handleAddToGroup(groupContextMenu.groupId, data.repoPath, name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '7px 10px', background: 'none',
                        border: 'none', cursor: 'pointer', borderRadius: '4px',
                        color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add {name}
                    </button>
                  ))}
                </>
              );
            })()}

            {/* Separator */}
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)', margin: '2px 0' }} />

            {/* Disband group */}
            <button
              onClick={() => handleDisbandGroup(groupContextMenu.groupId)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '7px 10px', background: 'none',
                border: 'none', cursor: 'pointer', borderRadius: '4px',
                color: '#E74C3C', fontSize: '12px', textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(231, 76, 60, 0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="#E74C3C" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Disband group
            </button>
          </div>
        </div>
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

          {/* Discord */}
          <button
            type="button"
            className="sidebar-footer-link sidebar-footer-discord"
            onClick={() => open('https://discord.gg/bQd39uDhnc')}
            title="Opens in browser"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            <span>Discord</span>
          </button>
        </div>

        {/* Right side: Version Tag */}
        <span
          className={`sidebar-footer-version ${import.meta.env.DEV ? 'sidebar-footer-version-dev' : 'sidebar-footer-version-prod'}`}
          title={`Version ${appVersion}${import.meta.env.DEV ? ' (DEV)' : ''}`}
        >
          {appVersion.replace(/^v/, '')}
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

      {/* Group Creation Modal */}
      <GroupCreationModal
        isOpen={showGroupModal}
        onClose={() => { setShowGroupModal(false); loadGroups(); }}
        activeProjects={orderedRepositoryGroups.map(([name, data]) => ({
          path: data.repoPath,
          name,
          color: projectColors[`repo-${name}`],
        }))}
      />
    </aside>
  );
}
