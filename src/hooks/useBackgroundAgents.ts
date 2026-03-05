/**
 * useBackgroundAgents Hook
 *
 * React hook for managing background tasks in UI components.
 * Provides convenient access to background agent store and service.
 *
 * @module useBackgroundAgents
 */

import { useCallback, useEffect, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useBackgroundAgentStore } from '../stores/backgroundAgentStore';
import {
  initBackgroundAgentService,
  cleanupBackgroundAgentService,
  createBackgroundTask,
  pauseTask,
  resumeTask,
  cancelTask,
  retryTask,
  runDroidInBackground,
  runCommandInBackground,
} from '../services/backgroundAgentService';
import type {
  BackgroundTask,
  BackgroundTaskConfig,
  BackgroundTaskPriority,
  BackgroundTaskStatus,
  BackgroundTaskType,
  BackgroundTaskFilters,
  BackgroundTaskResult,
} from '../types';

/**
 * Hook return type
 */
interface UseBackgroundAgentsReturn {
  // State
  tasks: BackgroundTask[];
  filteredTasks: BackgroundTask[];
  queueStats: ReturnType<typeof useBackgroundAgentStore.getState>['getQueueStats'];
  maxConcurrent: number;
  isPaused: boolean;
  filters: BackgroundTaskFilters;
  selectedTaskId: string | null;
  expandedTaskIds: Set<string>;

  // Task actions
  createTask: (config: BackgroundTaskConfig) => string;
  pauseTask: (taskId: string) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;

  // Quick task creators
  runDroid: (
    droidId: string,
    droidName: string,
    prompt: string,
    options?: {
      model?: string;
      workingDirectory?: string;
      priority?: BackgroundTaskPriority;
      chatId?: string;
    }
  ) => string;
  runCommand: (
    command: string,
    options?: {
      name?: string;
      args?: string[];
      workingDirectory?: string;
      env?: Record<string, string>;
      priority?: BackgroundTaskPriority;
      type?: 'build' | 'test' | 'analysis' | 'custom';
      chatId?: string;
    }
  ) => string;

  // Queue management
  setMaxConcurrent: (max: number) => void;
  pauseQueue: () => void;
  resumeQueue: () => void;
  updateTaskPriority: (taskId: string, priority: BackgroundTaskPriority) => void;

  // UI actions
  setFilters: (filters: Partial<BackgroundTaskFilters>) => void;
  toggleTaskExpanded: (taskId: string) => void;
  setSelectedTask: (taskId: string | null) => void;
  expandAllTasks: () => void;
  collapseAllTasks: () => void;
  toggleTaskLogs: (taskId: string) => void;

  // Selectors
  getTask: (taskId: string) => BackgroundTask | undefined;
  getTasksByStatus: (status: BackgroundTaskStatus) => BackgroundTask[];
  getTasksByType: (type: BackgroundTaskType) => BackgroundTask[];
  getTasksForChat: (chatId: string) => BackgroundTask[];
  getRunningTasks: () => BackgroundTask[];
  getQueuedTasks: () => BackgroundTask[];

  // Computed values
  hasActiveTasks: boolean;
  runningCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
}

/**
 * Hook for managing background agents
 */
export function useBackgroundAgents(): UseBackgroundAgentsReturn {
  // Get store state and actions
  const {
    tasks,
    maxConcurrent,
    isPaused,
    filters,
    selectedTaskId,
    expandedTaskIds,
    // Actions
    removeTask,
    clearCompletedTasks,
    setMaxConcurrent,
    pauseQueue,
    resumeQueue,
    updateTaskPriority,
    setFilters,
    toggleTaskExpanded,
    setSelectedTask,
    expandAllTasks,
    collapseAllTasks,
    toggleTaskLogs,
    // Selectors
    getTask,
    getQueueStats,
    getFilteredTasks,
    getQueuedTasks,
    getRunningTasks,
    getTasksByStatus,
    getTasksByType,
    getTasksForChat,
  } = useBackgroundAgentStore();

  // Get filtered tasks
  const filteredTasks = useMemo(() => getFilteredTasks(), [tasks, filters]);

  // Computed values
  const hasActiveTasks = useMemo(
    () => tasks.some(t => ['running', 'queued', 'paused'].includes(t.status)),
    [tasks]
  );

  const runningCount = useMemo(
    () => tasks.filter(t => t.status === 'running').length,
    [tasks]
  );

  const queuedCount = useMemo(
    () => tasks.filter(t => t.status === 'queued').length,
    [tasks]
  );

  const completedCount = useMemo(
    () => tasks.filter(t => t.status === 'completed').length,
    [tasks]
  );

  const failedCount = useMemo(
    () => tasks.filter(t => t.status === 'failed').length,
    [tasks]
  );

  // Memoized action wrappers
  const wrappedCreateTask = useCallback((config: BackgroundTaskConfig) => {
    return createBackgroundTask(config);
  }, []);

  const wrappedPauseTask = useCallback(async (taskId: string) => {
    await pauseTask(taskId);
  }, []);

  const wrappedResumeTask = useCallback(async (taskId: string) => {
    await resumeTask(taskId);
  }, []);

  const wrappedCancelTask = useCallback(async (taskId: string) => {
    await cancelTask(taskId);
  }, []);

  const wrappedRetryTask = useCallback((taskId: string) => {
    retryTask(taskId);
  }, []);

  const wrappedRunDroid = useCallback(
    (
      droidId: string,
      droidName: string,
      prompt: string,
      options?: {
        model?: string;
        workingDirectory?: string;
        priority?: BackgroundTaskPriority;
        chatId?: string;
      }
    ) => {
      return runDroidInBackground(droidId, droidName, prompt, options);
    },
    []
  );

  const wrappedRunCommand = useCallback(
    (
      command: string,
      options?: {
        name?: string;
        args?: string[];
        workingDirectory?: string;
        env?: Record<string, string>;
        priority?: BackgroundTaskPriority;
        type?: 'build' | 'test' | 'analysis' | 'custom';
        chatId?: string;
      }
    ) => {
      return runCommandInBackground(command, options);
    },
    []
  );

  return {
    // State
    tasks,
    filteredTasks,
    queueStats: getQueueStats,
    maxConcurrent,
    isPaused,
    filters,
    selectedTaskId,
    expandedTaskIds,

    // Task actions
    createTask: wrappedCreateTask,
    pauseTask: wrappedPauseTask,
    resumeTask: wrappedResumeTask,
    cancelTask: wrappedCancelTask,
    retryTask: wrappedRetryTask,
    removeTask,
    clearCompletedTasks,

    // Quick task creators
    runDroid: wrappedRunDroid,
    runCommand: wrappedRunCommand,

    // Queue management
    setMaxConcurrent,
    pauseQueue,
    resumeQueue,
    updateTaskPriority,

    // UI actions
    setFilters,
    toggleTaskExpanded,
    setSelectedTask,
    expandAllTasks,
    collapseAllTasks,
    toggleTaskLogs,

    // Selectors
    getTask,
    getTasksByStatus,
    getTasksByType,
    getTasksForChat,
    getRunningTasks,
    getQueuedTasks,

    // Computed values
    hasActiveTasks,
    runningCount,
    queuedCount,
    completedCount,
    failedCount,
  };
}

/**
 * Hook for initializing the background agent service
 * Should be called once at app startup (e.g., in App.tsx)
 */
export function useBackgroundAgentInit(): void {
  useEffect(() => {
    // Initialize service
    initBackgroundAgentService().catch(console.error);

    // Cleanup on unmount
    return () => {
      cleanupBackgroundAgentService();
    };
  }, []);
}

/**
 * Hook for listening to background task completion events
 * Useful for components that need to react to task completion
 */
export function useBackgroundTaskCompletion(
  onComplete: (taskId: string, result: BackgroundTaskResult) => void
): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<{ taskId: string; result: BackgroundTaskResult }>(
      'background-task-complete',
      (event) => {
        onComplete(event.payload.taskId, event.payload.result);
      }
    ).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [onComplete]);
}

/**
 * Hook for listening to background task result messages for chat
 * Used by chat components to display background task results
 */
export function useBackgroundTaskChatResults(
  chatId: string,
  onResult: (result: {
    taskId: string;
    taskName: string;
    success: boolean;
    output?: string;
    error?: string;
    duration_ms: number;
    usage?: { input_tokens: number; output_tokens: number };
    cost_usd?: number;
  }) => void
): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<{
      chatId: string;
      taskId: string;
      taskName: string;
      success: boolean;
      output?: string;
      error?: string;
      duration_ms: number;
      usage?: { input_tokens: number; output_tokens: number };
      cost_usd?: number;
    }>('background-task-result-to-chat', (event) => {
      if (event.payload.chatId === chatId) {
        onResult(event.payload);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [chatId, onResult]);
}

/**
 * Hook for getting task count badge (for sidebar)
 */
export function useBackgroundTaskBadge(): {
  count: number;
  hasRunning: boolean;
  hasFailed: boolean;
} {
  const { tasks } = useBackgroundAgentStore();

  return useMemo(() => {
    const running = tasks.filter(t => t.status === 'running').length;
    const queued = tasks.filter(t => t.status === 'queued').length;
    const failed = tasks.filter(t => t.status === 'failed').length;

    return {
      count: running + queued,
      hasRunning: running > 0,
      hasFailed: failed > 0,
    };
  }, [tasks]);
}

export default useBackgroundAgents;
