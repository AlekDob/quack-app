/**
 * Kanban Store
 *
 * Zustand store for managing Kanban board state.
 * Handles task CRUD, drag-drop status changes, drawer state, and view toggle.
 *
 * @module kanbanStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { KanbanTask, KanbanStatus, KanbanAssignedAgent, TaskCompletionResult, KanbanTaskInitialValues, AgentSession } from '../types';
import { sessionToKanbanTask } from '../utils/sessionKanbanAdapter';
import { useSessionStore } from './sessionStore';
// NOTE: kanbanStorage is deprecated - sessions are now the source of truth
// import {
//   saveKanbanTasks,
//   loadKanbanTasks,
// } from '../services/kanbanStorage';
import {
  ensureWorktree,
  mergeAndCleanup,
  generateBranchName,
} from '../services/worktreeService';

/**
 * Write lock to prevent race conditions between local writes and file watcher reloads.
 * When a write operation is in progress, the polling hook should skip reloads.
 */
export const kanbanWriteLock = {
  /** Timestamp of last write operation */
  lastWriteAt: 0,
  /** Debounce period in ms - ignore file watcher events for this duration after a write */
  DEBOUNCE_MS: 500,

  /** Mark that a write operation just happened */
  markWrite() {
    this.lastWriteAt = Date.now();
    console.log('[kanbanWriteLock] Write marked at', this.lastWriteAt);
  },

  /** Check if we should skip a reload (within debounce period of last write) */
  shouldSkipReload(): boolean {
    const elapsed = Date.now() - this.lastWriteAt;
    const skip = elapsed < this.DEBOUNCE_MS;
    if (skip) {
      console.log(`[kanbanWriteLock] Skipping reload (${elapsed}ms since last write, debounce: ${this.DEBOUNCE_MS}ms)`);
    }
    return skip;
  }
};

// Notification for showing "Open Kanban" bar after background task creation
export interface KanbanNotification {
  taskId: string;
  taskTitle: string;
  taskType: 'shell' | 'agent' | 'watch';
}

interface KanbanState {
  // 🦆 SESSIONS-FIRST: tasks removed - read from sessionStore instead
  // State
  // tasks: KanbanTask[]; // DEPRECATED - using sessionStore
  
  // Agent info map for rendering (agentId → {name, avatar, color})
  agentInfoMap: Map<string, { name?: string; avatar?: string; color?: string }>;
  
  selectedTaskId: string | null; // Now references session.id
  isDrawerOpen: boolean;
  isKanbanViewActive: boolean;
  isLoading: boolean;
  // Notification state for "Open Kanban" bar
  pendingNotification: KanbanNotification | null;
  // Flag to trigger new task modal opening (from keyboard shortcut or context menu)
  isNewTaskModalRequested: boolean;
  // Initial values for new task modal (from context menu "Create Task")
  pendingTaskInitialValues: KanbanTaskInitialValues | null;
  // Agent drop request from sidebar drag (cross-boundary dnd-kit drag)
  agentDropRequest: { agentId: string; timestamp: number } | null;
  // Which column the sidebar drag is hovering over (null = not dragging or not over any column)
  sidebarDragHoverColumn: KanbanStatus | null;
  // Agent info for the card being dragged from sidebar
  sidebarDragAgentInfo: { name: string; color: string } | null;
  // Task IDs currently being documented (session IDs)
  processingDocumentation: Set<string>;

  // Pagination state for Done column (infinite scroll)
  doneVisibleCount: number;
  donePageSize: number;
  isLoadingMoreDone: boolean;

  // Agent filter for Kanban view
  filterAgentId: string | null;

  // Actions
  loadTasks: (options?: { silent?: boolean }) => Promise<void>; // Now loads from sessionStore
  addTask: (task: Omit<KanbanTask, 'id' | 'createdAt'>) => Promise<KanbanTask>; // Creates session
  updateTask: (id: string, updates: Partial<KanbanTask>) => Promise<void>; // Updates session
  moveTask: (id: string, newStatus: KanbanStatus, onComplete?: (task: KanbanTask) => void) => Promise<void>; // Updates session status
  deleteTask: (id: string) => Promise<void>; // Deletes session
  selectTask: (id: string | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleKanbanView: () => void;
  setKanbanViewActive: (active: boolean) => void;
  // Notification actions
  showNotification: (notification: KanbanNotification) => void;
  dismissNotification: () => void;
  // New task modal actions (for keyboard shortcut or context menu)
  requestNewTaskModal: (initialValues?: KanbanTaskInitialValues) => void;
  clearNewTaskModalRequest: () => void;
  clearPendingTaskInitialValues: () => void;
  // Task completion documentation tracking
  markDocumentationProcessing: (taskId: string) => void;
  markDocumentationComplete: (taskId: string, result: TaskCompletionResult) => void;
  // Agent drop from sidebar boundary crossing
  requestAgentDrop: (agentId: string) => void;
  clearAgentDropRequest: () => void;
  setSidebarDragHoverColumn: (column: KanbanStatus | null) => void;
  setSidebarDragAgentInfo: (info: { name: string; color: string } | null) => void;
  // Agent filter actions
  setAgentFilter: (agentId: string | null) => void;
  // Agent info management
  updateAgentInfo: (agentId: string, info: { name?: string; avatar?: string; color?: string }) => void;

  // Selectors - now read from sessionStore
  getAllTasks: () => KanbanTask[];
  getTasksByStatus: (status: KanbanStatus) => KanbanTask[];
  getTasksByProject: (projectPath: string) => KanbanTask[];
  getSelectedTask: () => KanbanTask | null;
  hasDocumentation: (taskId: string) => boolean;

  // Pagination actions for Done column
  loadMoreDone: () => void;
  resetDonePagination: () => void;
  getVisibleDoneTasks: () => KanbanTask[];
  hasMoreDoneTasks: () => boolean;
}

/**
 * Generate unique ID for tasks
 */
const generateTaskId = (): string => {
  return `kanban-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const useKanbanStore = create<KanbanState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state - 🦆 SESSIONS-FIRST: no local tasks array
        agentInfoMap: new Map(),
        selectedTaskId: null,
        isDrawerOpen: false,
        isKanbanViewActive: false,
        isLoading: false,
        pendingNotification: null,
        isNewTaskModalRequested: false,
        pendingTaskInitialValues: null,
        agentDropRequest: null,
        sidebarDragHoverColumn: null,
        sidebarDragAgentInfo: null,
        processingDocumentation: new Set(),

        // Pagination for Done column - show 20 tasks initially, load 20 more each time
        doneVisibleCount: 20,
        donePageSize: 20,
        isLoadingMoreDone: false,

        // Agent filter
        filterAgentId: null,

        // 🦆 SESSIONS-FIRST: Load tasks from sessionStore (no-op for compatibility)
        // Sessions are loaded by sessionStore.loadSessions()
        loadTasks: async (options) => {
          const silent = options?.silent ?? false;
          if (!silent) {
            set({ isLoading: true });
          }
          try {
            // Sessions are managed by sessionStore - nothing to load here
            // This method kept for API compatibility
            console.log('[kanbanStore] loadTasks called (sessions-first: no-op)');
            set({ isLoading: false });
          } catch (error) {
            console.error('[kanbanStore] Failed to load tasks:', error);
            if (!silent) {
              set({ isLoading: false });
            }
          }
        },

        // 🦆 SESSIONS-FIRST: Add a new task = create a new session
        addTask: async (taskData) => {
          const sessionStore = useSessionStore.getState();

          // Create session from task data
          const newSession: Omit<AgentSession, 'id'> = {
            claudeSessionId: taskData.sessionId,
            title: taskData.title,
            agentId: taskData.terminalId || taskData.assignedAgent?.id || 'unknown',
            projectPath: taskData.projectPath,
            projectName: taskData.projectName,
            status: taskData.status || 'todo',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
            inputTokens: taskData.inputTokens,
            outputTokens: taskData.outputTokens,
            cacheCreationTokens: taskData.cacheCreationTokens,
            cacheReadTokens: taskData.cacheReadTokens,
            totalCost: taskData.totalCost,
            // Initial prompt and attachments from Kanban task creation
            initialPrompt: taskData.prompt || undefined,
            initialAttachments: taskData.attachments?.length ? taskData.attachments : undefined,
          };

          const createdSession = await sessionStore.createSession(newSession);
          
          // Update agent info map
          if (taskData.assignedAgent) {
            const agentInfoMap = new Map(get().agentInfoMap);
            agentInfoMap.set(createdSession.agentId, {
              name: taskData.assignedAgent.name,
              avatar: taskData.assignedAgent.avatar,
              color: taskData.assignedAgent.color,
            });
            set({ agentInfoMap });
          }

          const newTask = sessionToKanbanTask(createdSession, get().agentInfoMap.get(createdSession.agentId));
          console.log('[kanbanStore] Added task (session):', newTask.id, newTask.title);
          return newTask;
        },

        // 🦆 SESSIONS-FIRST: Update an existing task = update session
        updateTask: async (id, updates) => {
          const sessionStore = useSessionStore.getState();
          const session = sessionStore.sessions.find(s => s.id === id);
          
          if (!session) {
            console.warn('[kanbanStore] Session not found for update:', id);
            return;
          }

          // Map KanbanTask updates to AgentSession updates
          const sessionUpdates: Partial<AgentSession> = {
            title: updates.title,
            status: updates.status,
            completedAt: updates.completedAt,
            inputTokens: updates.inputTokens,
            outputTokens: updates.outputTokens,
            cacheCreationTokens: updates.cacheCreationTokens,
            cacheReadTokens: updates.cacheReadTokens,
            totalCost: updates.totalCost,
            updatedAt: Date.now(),
          };

          await sessionStore.updateSession(id, sessionUpdates);
          console.log('[kanbanStore] Updated task (session):', id);
        },

        // 🦆 SESSIONS-FIRST: Move task to a new status column = update session status
        moveTask: async (id, newStatus, onComplete) => {
          const sessionStore = useSessionStore.getState();
          const session = sessionStore.sessions.find(s => s.id === id);
          
          if (!session) {
            console.warn('[kanbanStore] Session not found:', id);
            return;
          }

          const updates: Partial<AgentSession> = { status: newStatus, updatedAt: Date.now() };

          // Set timestamps based on status change
          if (newStatus === 'done' && session.status !== 'done') {
            updates.completedAt = Date.now();
          }
          // Reset completedAt when task moves OUT of done status
          if (session.status === 'done' && newStatus !== 'done') {
            updates.completedAt = undefined;
          }

          await sessionStore.updateSession(id, updates);
          console.log('[kanbanStore] Moved task (session):', id, 'to', newStatus);

          // Call completion callback if moving to done
          if (newStatus === 'done' && onComplete) {
            const updatedSession = sessionStore.sessions.find(s => s.id === id);
            if (updatedSession) {
              const task = sessionToKanbanTask(updatedSession, get().agentInfoMap.get(updatedSession.agentId));
              onComplete(task);
            }
          }
          
          // NOTE: Worktree management removed - sessions don't use worktrees
          // Worktrees are managed at the agent level, not session level
        },

        // 🦆 SESSIONS-FIRST: Delete a task = delete session
        deleteTask: async (id) => {
          const { selectedTaskId, isDrawerOpen } = get();
          const sessionStore = useSessionStore.getState();

          // Close drawer if deleting the selected task
          const shouldCloseDrawer = selectedTaskId === id && isDrawerOpen;

          await sessionStore.deleteSession(id);
          
          set({
            selectedTaskId: selectedTaskId === id ? null : selectedTaskId,
            isDrawerOpen: shouldCloseDrawer ? false : isDrawerOpen,
          });

          console.log('[kanbanStore] Deleted task (session):', id);
        },

        // Select a task (for drawer display)
        selectTask: (id) => {
          set({ selectedTaskId: id });
          if (id) {
            console.log('[kanbanStore] Selected task:', id);
          }
        },

        // Open the chat drawer
        openDrawer: () => {
          set({ isDrawerOpen: true });
        },

        // Close the chat drawer
        closeDrawer: () => {
          set({ isDrawerOpen: false });
        },

        // Toggle between agent list and kanban view
        toggleKanbanView: () => {
          set((state) => ({ isKanbanViewActive: !state.isKanbanViewActive }));
        },

        // Set kanban view active state directly
        setKanbanViewActive: (active) => {
          set({ isKanbanViewActive: active });
        },

        // Show notification bar (after /background command)
        showNotification: (notification) => {
          set({ pendingNotification: notification });
        },

        // Dismiss notification bar
        dismissNotification: () => {
          set({ pendingNotification: null });
        },

        // Request new task modal to open (triggered by keyboard shortcut or context menu)
        requestNewTaskModal: (initialValues?: KanbanTaskInitialValues) => {
          set({
            isNewTaskModalRequested: true,
            pendingTaskInitialValues: initialValues || null,
          });
        },

        // Clear the request after modal has been opened
        clearNewTaskModalRequest: () => {
          set({ isNewTaskModalRequested: false });
        },

        // Clear pending initial values after they've been consumed
        clearPendingTaskInitialValues: () => {
          set({ pendingTaskInitialValues: null });
        },

        // Request agent drop from sidebar boundary crossing
        requestAgentDrop: (agentId: string) => {
          set({ agentDropRequest: { agentId, timestamp: Date.now() } });
        },

        // Clear agent drop request after it's been consumed
        clearAgentDropRequest: () => {
          set({ agentDropRequest: null });
        },

        // Set which Kanban column the sidebar drag is hovering over
        setSidebarDragHoverColumn: (column: KanbanStatus | null) => {
          set({ sidebarDragHoverColumn: column });
        },

        // Set agent info for the card being dragged from sidebar
        setSidebarDragAgentInfo: (info: { name: string; color: string } | null) => {
          set({ sidebarDragAgentInfo: info });
        },

        // Set agent filter for Kanban view
        setAgentFilter: (agentId) => {
          set({ filterAgentId: agentId });
          console.log('[kanbanStore] Agent filter set to:', agentId);
        },

        // Mark task as being documented
        markDocumentationProcessing: (taskId) => {
          const processingDocumentation = new Set(get().processingDocumentation);
          processingDocumentation.add(taskId);
          set({ processingDocumentation });
          console.log('[kanbanStore] Marking task for documentation:', taskId);
        },

        // Mark documentation as complete and update task
        // NOTE: Sessions don't track docFilePath/memoryEntityId yet
        markDocumentationComplete: async (taskId, result) => {
          const processingDocumentation = new Set(get().processingDocumentation);
          processingDocumentation.delete(taskId);

          // TODO: Add documentation tracking to AgentSession type
          // For now, just clear the processing flag
          set({ processingDocumentation });
          console.log('[kanbanStore] Documentation complete for session:', taskId, '(not persisted - AgentSession needs docFilePath/memoryEntityId fields)');
        },

        // 🦆 SESSIONS-FIRST: Selector: Get ALL tasks (reads from sessionStore)
        getAllTasks: () => {
          const { agentInfoMap } = get();
          const sessionStore = useSessionStore.getState();
          return sessionStore.sessions.map((session) =>
            sessionToKanbanTask(session, agentInfoMap.get(session.agentId))
          );
        },

        // 🦆 SESSIONS-FIRST: Selector: Get tasks by status (reads from sessionStore)
        getTasksByStatus: (status) => {
          const { filterAgentId, agentInfoMap } = get();
          const sessionStore = useSessionStore.getState();
          
          let filteredSessions = sessionStore.sessions.filter((s) => s.status === status);

          // Apply agent filter if set
          if (filterAgentId) {
            filteredSessions = filteredSessions.filter((s) => s.agentId === filterAgentId);
          }

          // Convert sessions to tasks
          return filteredSessions.map((session) => 
            sessionToKanbanTask(session, agentInfoMap.get(session.agentId))
          );
        },

        // 🦆 SESSIONS-FIRST: Selector: Get tasks by project
        getTasksByProject: (projectPath) => {
          const sessionStore = useSessionStore.getState();
          const { agentInfoMap } = get();
          
          const filteredSessions = sessionStore.sessions.filter((s) => s.projectPath === projectPath);
          
          return filteredSessions.map((session) =>
            sessionToKanbanTask(session, agentInfoMap.get(session.agentId))
          );
        },

        // 🦆 SESSIONS-FIRST: Selector: Get the currently selected task
        getSelectedTask: () => {
          const { selectedTaskId, agentInfoMap } = get();
          if (!selectedTaskId) return null;
          
          const sessionStore = useSessionStore.getState();
          const session = sessionStore.sessions.find((s) => s.id === selectedTaskId);
          
          if (!session) return null;
          return sessionToKanbanTask(session, agentInfoMap.get(session.agentId));
        },

        // Selector: Check if task has documentation
        // NOTE: Sessions don't track docFilePath/memoryEntityId yet
        // This would need to be added to AgentSession type
        hasDocumentation: (taskId) => {
          // TODO: Add documentation tracking to AgentSession
          return false;
        },
        
        // New action: Update agent info for rendering
        updateAgentInfo: (agentId, info) => {
          const agentInfoMap = new Map(get().agentInfoMap);
          agentInfoMap.set(agentId, info);
          set({ agentInfoMap });
        },

        // Pagination: Load more done tasks
        loadMoreDone: () => {
          const { doneVisibleCount, donePageSize, isLoadingMoreDone } = get();
          if (isLoadingMoreDone) return;

          set({ isLoadingMoreDone: true });

          // Simulate small delay for smooth UX
          setTimeout(() => {
            set({
              doneVisibleCount: doneVisibleCount + donePageSize,
              isLoadingMoreDone: false,
            });
          }, 150);
        },

        // Pagination: Reset to initial count (when switching views)
        resetDonePagination: () => {
          set({ doneVisibleCount: 20, isLoadingMoreDone: false });
        },

        // 🦆 SESSIONS-FIRST: Selector: Get visible done tasks (paginated)
        getVisibleDoneTasks: () => {
          const { doneVisibleCount, agentInfoMap } = get();
          const sessionStore = useSessionStore.getState();
          
          const doneSessions = sessionStore.sessions
            .filter((s) => s.status === 'done')
            .sort((a, b) => {
              // Sort by completedAt descending (most recent first)
              const aTime = a.completedAt || a.createdAt || 0;
              const bTime = b.completedAt || b.createdAt || 0;
              return bTime - aTime;
            });
          
          const visibleSessions = doneSessions.slice(0, doneVisibleCount);
          
          return visibleSessions.map((session) =>
            sessionToKanbanTask(session, agentInfoMap.get(session.agentId))
          );
        },

        // 🦆 SESSIONS-FIRST: Selector: Check if there are more done tasks to load
        hasMoreDoneTasks: () => {
          const { doneVisibleCount } = get();
          const sessionStore = useSessionStore.getState();
          const totalDone = sessionStore.sessions.filter((s) => s.status === 'done').length;
          return totalDone > doneVisibleCount;
        },
      }),
      {
        name: 'kanban-storage',
        // Only persist view state, not tasks (tasks are in separate file)
        partialize: (state) => ({
          isKanbanViewActive: state.isKanbanViewActive,
        }),
      }
    ),
    { name: 'kanban-store' }
  )
);
