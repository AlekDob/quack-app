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
import type { KanbanTask, KanbanStatus, KanbanAssignedAgent } from '../types';
import {
  saveKanbanTasks,
  loadKanbanTasks,
} from '../services/kanbanStorage';

interface KanbanState {
  // State
  tasks: KanbanTask[];
  selectedTaskId: string | null;
  isDrawerOpen: boolean;
  isKanbanViewActive: boolean;
  isLoading: boolean;

  // Actions
  loadTasks: () => Promise<void>;
  addTask: (task: Omit<KanbanTask, 'id' | 'createdAt'>) => Promise<KanbanTask>;
  updateTask: (id: string, updates: Partial<KanbanTask>) => Promise<void>;
  moveTask: (id: string, newStatus: KanbanStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  selectTask: (id: string | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleKanbanView: () => void;
  setKanbanViewActive: (active: boolean) => void;

  // Selectors
  getTasksByStatus: (status: KanbanStatus) => KanbanTask[];
  getTasksByProject: (projectPath: string) => KanbanTask[];
  getSelectedTask: () => KanbanTask | null;
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

        // Load tasks from storage
        loadTasks: async () => {
          set({ isLoading: true });
          try {
            const tasks = await loadKanbanTasks();
            set({ tasks, isLoading: false });
          } catch (error) {
            console.error('[kanbanStore] Failed to load tasks:', error);
            set({ isLoading: false });
          }
        },

        // Add a new task
        addTask: async (taskData) => {
          const newTask: KanbanTask = {
            ...taskData,
            id: generateTaskId(),
            createdAt: Date.now(),
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
        moveTask: async (id, newStatus) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) {
            console.warn('[kanbanStore] Task not found:', id);
            return;
          }

          const updates: Partial<KanbanTask> = { status: newStatus };

          // Set timestamps based on status change
          if (newStatus === 'in_progress' && task.status === 'todo') {
            updates.startedAt = Date.now();
          } else if (newStatus === 'done' && task.status !== 'done') {
            updates.completedAt = Date.now();
          }

          const tasks = get().tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          );
          set({ tasks });

          // Persist to storage
          await saveKanbanTasks(tasks);

          console.log('[kanbanStore] Moved task:', id, 'to', newStatus);
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
