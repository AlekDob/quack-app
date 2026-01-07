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
import type { KanbanTask, KanbanStatus, KanbanAssignedAgent, TaskCompletionResult } from '../types';
import {
  saveKanbanTasks,
  loadKanbanTasks,
} from '../services/kanbanStorage';
import {
  ensureWorktree,
  mergeAndCleanup,
  generateBranchName,
} from '../services/worktreeService';

// Notification for showing "Open Kanban" bar after background task creation
export interface KanbanNotification {
  taskId: string;
  taskTitle: string;
  taskType: 'shell' | 'agent' | 'watch';
}

interface KanbanState {
  // State
  tasks: KanbanTask[];
  selectedTaskId: string | null;
  isDrawerOpen: boolean;
  isKanbanViewActive: boolean;
  isLoading: boolean;
  // Notification state for "Open Kanban" bar
  pendingNotification: KanbanNotification | null;
  // Flag to trigger new task modal opening (from keyboard shortcut)
  isNewTaskModalRequested: boolean;
  // Task IDs currently being documented
  processingDocumentation: Set<string>;

  // Pagination state for Done column (infinite scroll)
  doneVisibleCount: number;
  donePageSize: number;
  isLoadingMoreDone: boolean;

  // Actions
  loadTasks: (options?: { silent?: boolean }) => Promise<void>;
  addTask: (task: Omit<KanbanTask, 'id' | 'createdAt'>) => Promise<KanbanTask>;
  updateTask: (id: string, updates: Partial<KanbanTask>) => Promise<void>;
  moveTask: (id: string, newStatus: KanbanStatus, onComplete?: (task: KanbanTask) => void) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  selectTask: (id: string | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleKanbanView: () => void;
  setKanbanViewActive: (active: boolean) => void;
  // Notification actions
  showNotification: (notification: KanbanNotification) => void;
  dismissNotification: () => void;
  // New task modal actions (for keyboard shortcut)
  requestNewTaskModal: () => void;
  clearNewTaskModalRequest: () => void;
  // Task completion documentation tracking
  markDocumentationProcessing: (taskId: string) => void;
  markDocumentationComplete: (taskId: string, result: TaskCompletionResult) => void;

  // Selectors
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
        // Initial state
        tasks: [],
        selectedTaskId: null,
        isDrawerOpen: false,
        isKanbanViewActive: false,
        isLoading: false,
        pendingNotification: null,
        isNewTaskModalRequested: false,
        processingDocumentation: new Set(),

        // Pagination for Done column - show 20 tasks initially, load 20 more each time
        doneVisibleCount: 20,
        donePageSize: 20,
        isLoadingMoreDone: false,

        // Load tasks from storage
        // Use { silent: true } for background polling to avoid showing loading indicator
        loadTasks: async (options) => {
          const silent = options?.silent ?? false;
          if (!silent) {
            set({ isLoading: true });
          }
          try {
            const tasks = await loadKanbanTasks();
            set({ tasks, isLoading: false });
          } catch (error) {
            console.error('[kanbanStore] Failed to load tasks:', error);
            if (!silent) {
              set({ isLoading: false });
            }
          }
        },

        // Add a new task
        addTask: async (taskData) => {
          const newTask: KanbanTask = {
            ...taskData,
            id: generateTaskId(),
            createdAt: Date.now(),
            type: taskData.type || 'agent', // Default to agent task
          };

          const tasks = [...get().tasks, newTask];
          set({ tasks });

          // Persist to storage
          await saveKanbanTasks(tasks);

          console.log('[kanbanStore] Added task:', newTask.id, newTask.title);
          return newTask;
        },

        // Update an existing task
        updateTask: async (id, updates) => {
          const tasks = get().tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          );
          set({ tasks });

          // Persist to storage
          await saveKanbanTasks(tasks);

          console.log('[kanbanStore] Updated task:', id);
        },

        // Move task to a new status column
        moveTask: async (id, newStatus, onComplete) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) {
            console.warn('[kanbanStore] Task not found:', id);
            return;
          }

          const updates: Partial<KanbanTask> = { status: newStatus };

          // Set timestamps based on status change
          if (newStatus === 'in_progress' && task.status === 'todo') {
            updates.startedAt = Date.now();

            // Create worktree when task starts (if useWorktree is enabled)
            if (task.useWorktree && !task.worktreePath) {
              try {
                console.log('[kanbanStore] Creating worktree for task:', task.id);
                const worktreePath = await ensureWorktree(task);
                const branchName = generateBranchName(task);
                updates.worktreePath = worktreePath;
                updates.branch = branchName;
                console.log('[kanbanStore] Worktree created:', { worktreePath, branchName });
              } catch (error) {
                console.error('[kanbanStore] Failed to create worktree:', error);
                // Continue without worktree - don't block task start
              }
            }
          } else if (newStatus === 'done' && task.status !== 'done') {
            updates.completedAt = Date.now();

            // Merge and cleanup worktree when task completes (if it has a worktree)
            if (task.useWorktree && task.worktreePath) {
              try {
                console.log('[kanbanStore] Merging worktree for task:', task.id);
                const mergeResult = await mergeAndCleanup(task, {
                  defaultTargetBranch: task.targetBranch || 'main',
                });
                if (mergeResult.success) {
                  console.log('[kanbanStore] Worktree merged successfully');
                  // Clear worktree path after successful merge
                  updates.worktreePath = undefined;
                } else if (mergeResult.hasConflicts) {
                  console.warn('[kanbanStore] Merge has conflicts:', mergeResult.conflictedFiles);
                  // Keep worktreePath so user can resolve conflicts
                } else {
                  console.error('[kanbanStore] Merge failed:', mergeResult.error);
                }
              } catch (error) {
                console.error('[kanbanStore] Failed to merge worktree:', error);
                // Don't block task completion
              }
            }
          }
          // Reset completedAt when task moves OUT of done status
          if (task.status === 'done' && newStatus !== 'done') {
            updates.completedAt = undefined;
          }

          const tasks = get().tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          );
          set({ tasks });

          // Persist to storage
          await saveKanbanTasks(tasks);

          console.log('[kanbanStore] Moved task:', id, 'to', newStatus);

          // Call completion callback if moving to done
          if (newStatus === 'done' && onComplete) {
            const updatedTask = tasks.find((t) => t.id === id);
            if (updatedTask) {
              onComplete(updatedTask);
            }
          }
        },

        // Delete a task
        deleteTask: async (id) => {
          const { selectedTaskId, isDrawerOpen } = get();

          // Close drawer if deleting the selected task
          const shouldCloseDrawer = selectedTaskId === id && isDrawerOpen;

          const tasks = get().tasks.filter((t) => t.id !== id);
          set({
            tasks,
            selectedTaskId: selectedTaskId === id ? null : selectedTaskId,
            isDrawerOpen: shouldCloseDrawer ? false : isDrawerOpen,
          });

          // Persist to storage
          await saveKanbanTasks(tasks);

          console.log('[kanbanStore] Deleted task:', id);
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

        // Request new task modal to open (triggered by keyboard shortcut)
        requestNewTaskModal: () => {
          set({ isNewTaskModalRequested: true });
        },

        // Clear the request after modal has been opened
        clearNewTaskModalRequest: () => {
          set({ isNewTaskModalRequested: false });
        },

        // Mark task as being documented
        markDocumentationProcessing: (taskId) => {
          const processingDocumentation = new Set(get().processingDocumentation);
          processingDocumentation.add(taskId);
          set({ processingDocumentation });
          console.log('[kanbanStore] Marking task for documentation:', taskId);
        },

        // Mark documentation as complete and update task
        markDocumentationComplete: async (taskId, result) => {
          const processingDocumentation = new Set(get().processingDocumentation);
          processingDocumentation.delete(taskId);

          const updates: Partial<KanbanTask> = {};
          if (result.memoryEntityId) {
            updates.memoryEntityId = result.memoryEntityId;
          }
          if (result.docFilePath) {
            updates.docFilePath = result.docFilePath;
          }

          if (Object.keys(updates).length > 0) {
            const tasks = get().tasks.map((t) =>
              t.id === taskId ? { ...t, ...updates } : t
            );
            set({ tasks, processingDocumentation });
            await saveKanbanTasks(tasks);
            console.log('[kanbanStore] Documentation complete for task:', taskId, updates);
          } else {
            set({ processingDocumentation });
          }
        },

        // Selector: Get tasks by status
        getTasksByStatus: (status) => {
          return get().tasks.filter((t) => t.status === status);
        },

        // Selector: Get tasks by project
        getTasksByProject: (projectPath) => {
          return get().tasks.filter((t) => t.projectPath === projectPath);
        },

        // Selector: Get the currently selected task
        getSelectedTask: () => {
          const { tasks, selectedTaskId } = get();
          if (!selectedTaskId) return null;
          return tasks.find((t) => t.id === selectedTaskId) ?? null;
        },

        // Selector: Check if task has documentation
        hasDocumentation: (taskId) => {
          const task = get().tasks.find((t) => t.id === taskId);
          return !!(task?.docFilePath || task?.memoryEntityId);
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

        // Selector: Get visible done tasks (paginated)
        getVisibleDoneTasks: () => {
          const { tasks, doneVisibleCount } = get();
          const doneTasks = tasks
            .filter((t) => t.status === 'done')
            .sort((a, b) => {
              // Sort by completedAt descending (most recent first)
              const aTime = a.completedAt || a.createdAt || 0;
              const bTime = b.completedAt || b.createdAt || 0;
              return bTime - aTime;
            });
          return doneTasks.slice(0, doneVisibleCount);
        },

        // Selector: Check if there are more done tasks to load
        hasMoreDoneTasks: () => {
          const { tasks, doneVisibleCount } = get();
          const totalDone = tasks.filter((t) => t.status === 'done').length;
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
