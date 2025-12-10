/**
 * Background Agent Store
 *
 * Zustand store for managing background tasks state.
 * Handles queue management, task lifecycle, and real-time updates.
 *
 * @module backgroundAgentStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  BackgroundTask,
  BackgroundTaskConfig,
  BackgroundTaskStatus,
  BackgroundTaskPriority,
  BackgroundTaskLogEntry,
  BackgroundTaskProgress,
  BackgroundTaskResult,
  BackgroundTaskQueueStats,
  BackgroundTaskFilters,
  WatchTrigger,
  DroidAutoTrigger,
} from '../types';

// Priority weights for sorting (higher = executed first)
const PRIORITY_WEIGHTS: Record<BackgroundTaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// Default max concurrent tasks
const DEFAULT_MAX_CONCURRENT = 5;

// Max logs to keep per task (to prevent memory bloat)
const MAX_LOGS_PER_TASK = 500;

interface BackgroundAgentState {
  // Core state
  tasks: BackgroundTask[];
  maxConcurrent: number;
  isPaused: boolean;
  lastUpdated: number;

  // Watch triggers and auto-triggers
  watchTriggers: WatchTrigger[];
  droidAutoTriggers: DroidAutoTrigger[];

  // UI state
  filters: BackgroundTaskFilters;
  expandedTaskIds: Set<string>;
  selectedTaskId: string | null;

  // Computed stats (cached)
  _statsCache: BackgroundTaskQueueStats | null;

  // Actions - Task lifecycle
  createTask: (config: BackgroundTaskConfig) => string;
  startTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
  completeTask: (taskId: string, result: BackgroundTaskResult) => void;
  failTask: (taskId: string, error: string) => void;
  retryTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;

  // Actions - Task updates
  updateTaskProgress: (taskId: string, progress: BackgroundTaskProgress) => void;
  addTaskLog: (taskId: string, log: Omit<BackgroundTaskLogEntry, 'id' | 'timestamp'>) => void;
  setTaskSessionId: (taskId: string, sessionId: string) => void;
  toggleTaskLogs: (taskId: string) => void;

  // Actions - Queue management
  setMaxConcurrent: (max: number) => void;
  pauseQueue: () => void;
  resumeQueue: () => void;
  reorderQueue: (taskId: string, newPosition: number) => void;
  updateTaskPriority: (taskId: string, priority: BackgroundTaskPriority) => void;

  // Actions - Watch triggers
  addWatchTrigger: (trigger: Omit<WatchTrigger, 'id'>) => string;
  updateWatchTrigger: (id: string, updates: Partial<WatchTrigger>) => void;
  removeWatchTrigger: (id: string) => void;
  toggleWatchTrigger: (id: string) => void;

  // Actions - Droid auto-triggers
  addDroidAutoTrigger: (trigger: Omit<DroidAutoTrigger, 'id'>) => void;
  updateDroidAutoTrigger: (droidId: string, updates: Partial<DroidAutoTrigger>) => void;
  removeDroidAutoTrigger: (droidId: string) => void;

  // Actions - UI
  setFilters: (filters: Partial<BackgroundTaskFilters>) => void;
  toggleTaskExpanded: (taskId: string) => void;
  setSelectedTask: (taskId: string | null) => void;
  expandAllTasks: () => void;
  collapseAllTasks: () => void;

  // Selectors
  getTask: (taskId: string) => BackgroundTask | undefined;
  getQueueStats: () => BackgroundTaskQueueStats;
  getFilteredTasks: () => BackgroundTask[];
  getQueuedTasks: () => BackgroundTask[];
  getRunningTasks: () => BackgroundTask[];
  getNextTaskToRun: () => BackgroundTask | undefined;
  canStartNewTask: () => boolean;
  getTasksByStatus: (status: BackgroundTaskStatus) => BackgroundTask[];
  getTasksByType: (type: string) => BackgroundTask[];
  getTasksForChat: (chatId: string) => BackgroundTask[];
}

// Generate unique ID
const generateId = () => `bg-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Calculate queue stats
const calculateStats = (tasks: BackgroundTask[]): BackgroundTaskQueueStats => ({
  totalTasks: tasks.length,
  queued: tasks.filter(t => t.status === 'queued').length,
  running: tasks.filter(t => t.status === 'running').length,
  paused: tasks.filter(t => t.status === 'paused').length,
  completed: tasks.filter(t => t.status === 'completed').length,
  failed: tasks.filter(t => t.status === 'failed').length,
  cancelled: tasks.filter(t => t.status === 'cancelled').length,
});

// Sort tasks by priority and creation time
const sortTasksByPriority = (tasks: BackgroundTask[]): BackgroundTask[] => {
  return [...tasks].sort((a, b) => {
    // First by priority (high > medium > low)
    const priorityDiff = PRIORITY_WEIGHTS[b.config.priority] - PRIORITY_WEIGHTS[a.config.priority];
    if (priorityDiff !== 0) return priorityDiff;
    // Then by creation time (older first)
    return a.createdAt - b.createdAt;
  });
};

// Update queue positions for queued tasks
const updateQueuePositions = (tasks: BackgroundTask[]): BackgroundTask[] => {
  const queuedTasks = tasks.filter(t => t.status === 'queued');
  const sorted = sortTasksByPriority(queuedTasks);

  return tasks.map(task => {
    if (task.status !== 'queued') {
      return { ...task, queuePosition: undefined };
    }
    const position = sorted.findIndex(t => t.id === task.id) + 1;
    return { ...task, queuePosition: position };
  });
};

export const useBackgroundAgentStore = create<BackgroundAgentState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        tasks: [],
        maxConcurrent: DEFAULT_MAX_CONCURRENT,
        isPaused: false,
        lastUpdated: Date.now(),
        watchTriggers: [],
        droidAutoTriggers: [],
        filters: {
          showCompleted: true,
          sortBy: 'created',
          sortOrder: 'desc',
        },
        expandedTaskIds: new Set(),
        selectedTaskId: null,
        _statsCache: null,

        // Task lifecycle actions
        createTask: (config) => {
          const id = generateId();
          const task: BackgroundTask = {
            id,
            config,
            status: 'queued',
            createdAt: Date.now(),
            logs: [],
            logsVisible: config.showLogsInRealtime ?? false,
            retryCount: 0,
          };

          set((state) => {
            const newTasks = updateQueuePositions([...state.tasks, task]);
            return {
              tasks: newTasks,
              lastUpdated: Date.now(),
              _statsCache: null,
            };
          });

          console.log(`[BackgroundAgent] Task created: ${id} - ${config.name}`);
          return id;
        },

        startTask: (taskId) => set((state) => {
          const task = state.tasks.find(t => t.id === taskId);
          if (!task || task.status !== 'queued') return state;

          const updatedTasks = state.tasks.map(t =>
            t.id === taskId
              ? { ...t, status: 'running' as const, startedAt: Date.now(), queuePosition: undefined }
              : t
          );

          console.log(`[BackgroundAgent] Task started: ${taskId}`);
          return {
            tasks: updateQueuePositions(updatedTasks),
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        pauseTask: (taskId) => set((state) => {
          const task = state.tasks.find(t => t.id === taskId);
          if (!task || task.status !== 'running') return state;

          const updatedTasks = state.tasks.map(t =>
            t.id === taskId
              ? { ...t, status: 'paused' as const, pausedAt: Date.now() }
              : t
          );

          console.log(`[BackgroundAgent] Task paused: ${taskId}`);
          return {
            tasks: updatedTasks,
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        resumeTask: (taskId) => set((state) => {
          const task = state.tasks.find(t => t.id === taskId);
          if (!task || task.status !== 'paused') return state;

          const updatedTasks = state.tasks.map(t =>
            t.id === taskId
              ? { ...t, status: 'running' as const, pausedAt: undefined }
              : t
          );

          console.log(`[BackgroundAgent] Task resumed: ${taskId}`);
          return {
            tasks: updatedTasks,
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        cancelTask: (taskId) => set((state) => {
          const task = state.tasks.find(t => t.id === taskId);
          if (!task || ['completed', 'failed', 'cancelled'].includes(task.status)) return state;

          const updatedTasks = state.tasks.map(t =>
            t.id === taskId
              ? { ...t, status: 'cancelled' as const, completedAt: Date.now() }
              : t
          );

          console.log(`[BackgroundAgent] Task cancelled: ${taskId}`);
          return {
            tasks: updateQueuePositions(updatedTasks),
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        completeTask: (taskId, result) => set((state) => {
          const task = state.tasks.find(t => t.id === taskId);
          if (!task) return state;

          const updatedTasks = state.tasks.map(t =>
            t.id === taskId
              ? { ...t, status: 'completed' as const, completedAt: Date.now(), result }
              : t
          );

          console.log(`[BackgroundAgent] Task completed: ${taskId} - Success: ${result.success}`);
          return {
            tasks: updateQueuePositions(updatedTasks),
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        failTask: (taskId, error) => set((state) => {
          const task = state.tasks.find(t => t.id === taskId);
          if (!task) return state;

          const result: BackgroundTaskResult = {
            success: false,
            error,
            duration_ms: task.startedAt ? Date.now() - task.startedAt : 0,
          };

          const updatedTasks = state.tasks.map(t =>
            t.id === taskId
              ? { ...t, status: 'failed' as const, completedAt: Date.now(), result }
              : t
          );

          console.error(`[BackgroundAgent] Task failed: ${taskId} - ${error}`);
          return {
            tasks: updateQueuePositions(updatedTasks),
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        retryTask: (taskId) => set((state) => {
          const task = state.tasks.find(t => t.id === taskId);
          if (!task || !['failed', 'cancelled'].includes(task.status)) return state;

          const maxRetries = task.config.maxRetries ?? 3;
          if (task.retryCount >= maxRetries) {
            console.warn(`[BackgroundAgent] Max retries reached for task: ${taskId}`);
            return state;
          }

          const updatedTasks = state.tasks.map(t =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'queued' as const,
                  retryCount: t.retryCount + 1,
                  startedAt: undefined,
                  completedAt: undefined,
                  result: undefined,
                }
              : t
          );

          console.log(`[BackgroundAgent] Task retry queued: ${taskId} (attempt ${task.retryCount + 1})`);
          return {
            tasks: updateQueuePositions(updatedTasks),
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        removeTask: (taskId) => set((state) => {
          const newTasks = state.tasks.filter(t => t.id !== taskId);
          const newExpandedIds = new Set(state.expandedTaskIds);
          newExpandedIds.delete(taskId);

          console.log(`[BackgroundAgent] Task removed: ${taskId}`);
          return {
            tasks: updateQueuePositions(newTasks),
            expandedTaskIds: newExpandedIds,
            selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        clearCompletedTasks: () => set((state) => {
          const activeTasks = state.tasks.filter(t =>
            !['completed', 'failed', 'cancelled'].includes(t.status)
          );

          console.log(`[BackgroundAgent] Cleared ${state.tasks.length - activeTasks.length} completed tasks`);
          return {
            tasks: activeTasks,
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        // Task update actions
        updateTaskProgress: (taskId, progress) => set((state) => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, progress } : t
          ),
          lastUpdated: Date.now(),
        })),

        addTaskLog: (taskId, log) => set((state) => {
          const logEntry: BackgroundTaskLogEntry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: Date.now(),
            ...log,
          };

          return {
            tasks: state.tasks.map(t => {
              if (t.id !== taskId) return t;
              // Keep only last MAX_LOGS_PER_TASK logs
              const newLogs = [...t.logs, logEntry].slice(-MAX_LOGS_PER_TASK);
              return { ...t, logs: newLogs };
            }),
            lastUpdated: Date.now(),
          };
        }),

        setTaskSessionId: (taskId, sessionId) => set((state) => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, sessionId } : t
          ),
        })),

        toggleTaskLogs: (taskId) => set((state) => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, logsVisible: !t.logsVisible } : t
          ),
        })),

        // Queue management actions
        setMaxConcurrent: (max) => set({
          maxConcurrent: Math.max(1, max),
          lastUpdated: Date.now(),
        }),

        pauseQueue: () => set({
          isPaused: true,
          lastUpdated: Date.now(),
        }),

        resumeQueue: () => set({
          isPaused: false,
          lastUpdated: Date.now(),
        }),

        reorderQueue: (taskId, newPosition) => set((state) => {
          const queuedTasks = state.tasks.filter(t => t.status === 'queued');
          const task = queuedTasks.find(t => t.id === taskId);
          if (!task) return state;

          const otherTasks = queuedTasks.filter(t => t.id !== taskId);
          const sorted = sortTasksByPriority(otherTasks);
          sorted.splice(newPosition - 1, 0, task);

          // Update queue positions
          const nonQueuedTasks = state.tasks.filter(t => t.status !== 'queued');
          const reorderedTasks = [
            ...nonQueuedTasks,
            ...sorted.map((t, idx) => ({ ...t, queuePosition: idx + 1 })),
          ];

          return {
            tasks: reorderedTasks,
            lastUpdated: Date.now(),
          };
        }),

        updateTaskPriority: (taskId, priority) => set((state) => {
          const updatedTasks = state.tasks.map(t =>
            t.id === taskId
              ? { ...t, config: { ...t.config, priority } }
              : t
          );

          return {
            tasks: updateQueuePositions(updatedTasks),
            lastUpdated: Date.now(),
            _statsCache: null,
          };
        }),

        // Watch trigger actions
        addWatchTrigger: (trigger) => {
          const id = `watch-${Date.now()}`;
          set((state) => ({
            watchTriggers: [...state.watchTriggers, { ...trigger, id }],
          }));
          return id;
        },

        updateWatchTrigger: (id, updates) => set((state) => ({
          watchTriggers: state.watchTriggers.map(t =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

        removeWatchTrigger: (id) => set((state) => ({
          watchTriggers: state.watchTriggers.filter(t => t.id !== id),
        })),

        toggleWatchTrigger: (id) => set((state) => ({
          watchTriggers: state.watchTriggers.map(t =>
            t.id === id ? { ...t, enabled: !t.enabled } : t
          ),
        })),

        // Droid auto-trigger actions
        addDroidAutoTrigger: (trigger) => set((state) => ({
          droidAutoTriggers: [...state.droidAutoTriggers, trigger as DroidAutoTrigger],
        })),

        updateDroidAutoTrigger: (droidId, updates) => set((state) => ({
          droidAutoTriggers: state.droidAutoTriggers.map(t =>
            t.droidId === droidId ? { ...t, ...updates } : t
          ),
        })),

        removeDroidAutoTrigger: (droidId) => set((state) => ({
          droidAutoTriggers: state.droidAutoTriggers.filter(t => t.droidId !== droidId),
        })),

        // UI actions
        setFilters: (filters) => set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

        toggleTaskExpanded: (taskId) => set((state) => {
          const newExpanded = new Set(state.expandedTaskIds);
          if (newExpanded.has(taskId)) {
            newExpanded.delete(taskId);
          } else {
            newExpanded.add(taskId);
          }
          return { expandedTaskIds: newExpanded };
        }),

        setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),

        expandAllTasks: () => set((state) => ({
          expandedTaskIds: new Set(state.tasks.map(t => t.id)),
        })),

        collapseAllTasks: () => set({ expandedTaskIds: new Set() }),

        // Selectors
        getTask: (taskId) => get().tasks.find(t => t.id === taskId),

        getQueueStats: () => {
          const state = get();
          if (state._statsCache) return state._statsCache;
          const stats = calculateStats(state.tasks);
          // Note: Can't update state in selector, cache is updated on task changes
          return stats;
        },

        getFilteredTasks: () => {
          const state = get();
          const { filters, tasks } = state;

          let filtered = [...tasks];

          // Filter by status
          if (filters.status?.length) {
            filtered = filtered.filter(t => filters.status!.includes(t.status));
          }

          // Filter by type
          if (filters.type?.length) {
            filtered = filtered.filter(t => filters.type!.includes(t.config.type));
          }

          // Filter by priority
          if (filters.priority?.length) {
            filtered = filtered.filter(t => filters.priority!.includes(t.config.priority));
          }

          // Filter completed tasks
          if (!filters.showCompleted) {
            filtered = filtered.filter(t =>
              !['completed', 'failed', 'cancelled'].includes(t.status)
            );
          }

          // Search query
          if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
              t.config.name.toLowerCase().includes(query) ||
              t.config.description?.toLowerCase().includes(query)
            );
          }

          // Sort
          const sortBy = filters.sortBy ?? 'created';
          const sortOrder = filters.sortOrder ?? 'desc';
          const multiplier = sortOrder === 'asc' ? 1 : -1;

          filtered.sort((a, b) => {
            switch (sortBy) {
              case 'priority':
                return (PRIORITY_WEIGHTS[b.config.priority] - PRIORITY_WEIGHTS[a.config.priority]) * multiplier;
              case 'status':
                return a.status.localeCompare(b.status) * multiplier;
              case 'name':
                return a.config.name.localeCompare(b.config.name) * multiplier;
              case 'created':
              default:
                return (a.createdAt - b.createdAt) * multiplier;
            }
          });

          return filtered;
        },

        getQueuedTasks: () => {
          return sortTasksByPriority(
            get().tasks.filter(t => t.status === 'queued')
          );
        },

        getRunningTasks: () => {
          return get().tasks.filter(t => t.status === 'running');
        },

        getNextTaskToRun: () => {
          const state = get();
          if (state.isPaused) return undefined;

          const queuedTasks = sortTasksByPriority(
            state.tasks.filter(t => t.status === 'queued')
          );

          // Find first task with satisfied dependencies
          return queuedTasks.find(task => {
            if (!task.dependsOn?.length) return true;
            return task.dependsOn.every(depId => {
              const depTask = state.tasks.find(t => t.id === depId);
              return depTask?.status === 'completed';
            });
          });
        },

        canStartNewTask: () => {
          const state = get();
          if (state.isPaused) return false;
          const runningCount = state.tasks.filter(t => t.status === 'running').length;
          return runningCount < state.maxConcurrent;
        },

        getTasksByStatus: (status) => {
          return get().tasks.filter(t => t.status === status);
        },

        getTasksByType: (type) => {
          return get().tasks.filter(t => t.config.type === type);
        },

        getTasksForChat: (chatId) => {
          return get().tasks.filter(t => t.chatId === chatId);
        },
      }),
      {
        name: 'background-agent-store',
        // Only persist certain fields
        partialize: (state) => ({
          tasks: state.tasks.map(task => ({
            ...task,
            // Don't persist logs to save storage space
            logs: task.status === 'running' ? task.logs : [],
          })),
          maxConcurrent: state.maxConcurrent,
          watchTriggers: state.watchTriggers,
          droidAutoTriggers: state.droidAutoTriggers,
          filters: state.filters,
        }),
      }
    ),
    { name: 'background-agent-store' }
  )
);
