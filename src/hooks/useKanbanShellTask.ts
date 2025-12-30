/**
 * useKanbanShellTask Hook
 *
 * Manages shell task execution for Kanban cards.
 * Integrates with Tauri backend for process spawning and output streaming.
 * Stores output in memory only (not persisted).
 *
 * @module useKanbanShellTask
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useKanbanStore } from '../stores/kanbanStore';
import type { KanbanTask } from '../types';

interface ShellTaskOutput {
  taskId: string;
  output: string;
  isRunning: boolean;
  pid?: number;
  exitCode?: number;
  startedAt?: number;
}

interface ShellOutputEvent {
  taskId: string;
  output: string;
}

interface ShellExitEvent {
  taskId: string;
  exitCode: number;
}

interface UseKanbanShellTaskReturn {
  /** In-memory output storage keyed by task ID */
  outputs: Map<string, ShellTaskOutput>;
  /** Start a shell task */
  startShellTask: (taskId: string) => Promise<void>;
  /** Kill a running shell task */
  killShellTask: (taskId: string) => Promise<void>;
  /** Get output for a specific task */
  getTaskOutput: (taskId: string) => string;
  /** Check if a task is running */
  isTaskRunning: (taskId: string) => boolean;
  /** Clear output for a task */
  clearOutput: (taskId: string) => void;
}

/**
 * Hook for managing Kanban shell task execution
 */
export function useKanbanShellTask(): UseKanbanShellTaskReturn {
  const [outputs, setOutputs] = useState<Map<string, ShellTaskOutput>>(new Map());
  const unlistenRefs = useRef<Map<string, UnlistenFn[]>>(new Map());
  const { updateTask, moveTask } = useKanbanStore();

  // Setup global event listeners for shell output
  useEffect(() => {
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    const setupListeners = async () => {
      // Listen for shell output events
      unlistenOutput = await listen<ShellOutputEvent>('kanban-shell-output', (event) => {
        const { taskId, output } = event.payload;
        setOutputs((prev) => {
          const existing = prev.get(taskId);
          const newOutput = (existing?.output || '') + output;
          return new Map(prev).set(taskId, {
            ...existing,
            taskId,
            output: newOutput,
            isRunning: existing?.isRunning ?? true,
          });
        });
      });

      // Listen for shell exit events
      unlistenExit = await listen<ShellExitEvent>('kanban-shell-exit', (event) => {
        const { taskId, exitCode } = event.payload;
        setOutputs((prev) => {
          const existing = prev.get(taskId);
          return new Map(prev).set(taskId, {
            ...existing,
            taskId,
            output: existing?.output || '',
            isRunning: false,
            exitCode,
          });
        });

        // Auto-move to done when shell completes
        handleShellComplete(taskId, exitCode);
      });
    };

    setupListeners();

    return () => {
      unlistenOutput?.();
      unlistenExit?.();
    };
  }, []);

  /**
   * Handle shell task completion - auto-move to done
   */
  const handleShellComplete = useCallback(async (taskId: string, exitCode: number) => {
    try {
      // Update task with exit code and completion time
      await updateTask(taskId, {
        exitCode,
        completedAt: Date.now(),
        pid: undefined, // Clear PID
      });

      // Move to done column
      await moveTask(taskId, 'done');

      console.log(`[useKanbanShellTask] Task ${taskId} completed with exit code ${exitCode}`);
    } catch (error) {
      console.error('[useKanbanShellTask] Failed to complete task:', error);
    }
  }, [updateTask, moveTask]);

  /**
   * Start executing a shell task
   */
  const startShellTask = useCallback(async (taskId: string) => {
    const tasks = useKanbanStore.getState().tasks;
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.type !== 'shell') {
      console.warn('[useKanbanShellTask] Invalid task or not a shell task:', taskId);
      return;
    }

    if (!task.command) {
      console.warn('[useKanbanShellTask] Shell task has no command:', taskId);
      return;
    }

    console.log(`[useKanbanShellTask] Starting shell task: ${taskId}, command: ${task.command}`);

    // Initialize output state
    setOutputs((prev) => new Map(prev).set(taskId, {
      taskId,
      output: '',
      isRunning: true,
      startedAt: Date.now(),
    }));

    try {
      // Start the shell process via Tauri
      const pid = await invoke<number>('start_kanban_shell_task', {
        taskId,
        command: task.command,
        workingDirectory: task.projectPath,
      });

      // Update task with PID and started timestamp
      await updateTask(taskId, {
        pid,
        startedAt: Date.now(),
      });

      // Move to in_progress
      await moveTask(taskId, 'in_progress');

      setOutputs((prev) => {
        const existing = prev.get(taskId);
        return new Map(prev).set(taskId, {
          ...existing,
          taskId,
          output: existing?.output || '',
          isRunning: true,
          pid,
        });
      });

      console.log(`[useKanbanShellTask] Task ${taskId} started with PID: ${pid}`);
    } catch (error) {
      console.error('[useKanbanShellTask] Failed to start task:', error);

      setOutputs((prev) => {
        const existing = prev.get(taskId);
        return new Map(prev).set(taskId, {
          ...existing,
          taskId,
          output: (existing?.output || '') + `\nError: ${error}`,
          isRunning: false,
          exitCode: 1,
        });
      });

      // Update task as failed
      await updateTask(taskId, {
        exitCode: 1,
        completedAt: Date.now(),
      });
      await moveTask(taskId, 'done');
    }
  }, [updateTask, moveTask]);

  /**
   * Kill a running shell task
   */
  const killShellTask = useCallback(async (taskId: string) => {
    const outputState = outputs.get(taskId);
    if (!outputState?.pid) {
      console.warn('[useKanbanShellTask] No PID found for task:', taskId);
      return;
    }

    console.log(`[useKanbanShellTask] Killing task ${taskId} with PID: ${outputState.pid}`);

    try {
      await invoke('kill_kanban_shell_task', {
        taskId,
        pid: outputState.pid,
      });

      // Update output state
      setOutputs((prev) => {
        const existing = prev.get(taskId);
        return new Map(prev).set(taskId, {
          ...existing,
          taskId,
          output: (existing?.output || '') + '\n[Process killed by user]',
          isRunning: false,
          exitCode: -1,
        });
      });

      // Update task
      await updateTask(taskId, {
        exitCode: -1,
        pid: undefined,
        completedAt: Date.now(),
      });
      await moveTask(taskId, 'done');

      console.log(`[useKanbanShellTask] Task ${taskId} killed`);
    } catch (error) {
      console.error('[useKanbanShellTask] Failed to kill task:', error);
    }
  }, [outputs, updateTask, moveTask]);

  /**
   * Get output for a specific task
   */
  const getTaskOutput = useCallback((taskId: string): string => {
    return outputs.get(taskId)?.output || '';
  }, [outputs]);

  /**
   * Check if a task is running
   */
  const isTaskRunning = useCallback((taskId: string): boolean => {
    return outputs.get(taskId)?.isRunning ?? false;
  }, [outputs]);

  /**
   * Clear output for a task (when deleted)
   */
  const clearOutput = useCallback((taskId: string) => {
    setOutputs((prev) => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
  }, []);

  return {
    outputs,
    startShellTask,
    killShellTask,
    getTaskOutput,
    isTaskRunning,
    clearOutput,
  };
}

export default useKanbanShellTask;
