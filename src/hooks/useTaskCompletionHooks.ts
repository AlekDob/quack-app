/**
 * useTaskCompletionHooks Hook
 *
 * React 19 hook for integrating task completion processing into the Kanban UI.
 * Handles background task completion with toast notifications and file opening.
 *
 * Background processing - doesn't block UI during documentation generation.
 * Uses sonner toast for completion notifications with "Open" action.
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { open } from '@tauri-apps/plugin-shell';
import type {
  TaskCompletionResult,
  TaskCompletionOptions,
  KanbanTask,
  ChatMessage
} from '../types';

interface TaskCompletionState {
  isProcessing: Map<string, boolean>;
  results: Map<string, TaskCompletionResult>;
  pendingDocumentations: Set<string>;
}

interface UseTaskCompletionHooksReturn {
  /** Trigger task completion processing */
  processTaskCompletion: (
    taskId: string,
    task: KanbanTask,
    messages: ChatMessage[],
    options: TaskCompletionOptions
  ) => Promise<void>;

  /** Map of taskId -> processing state */
  isProcessing: Map<string, boolean>;

  /** Map of taskId -> completion results */
  completionResults: Map<string, TaskCompletionResult>;

  /** Set of taskIds being documented in background */
  pendingDocumentations: Set<string>;

  /** Clear result for a task */
  clearResult: (taskId: string) => void;
}

export function useTaskCompletionHooks(): UseTaskCompletionHooksReturn {
  const [state, setState] = useState<TaskCompletionState>({
    isProcessing: new Map(),
    results: new Map(),
    pendingDocumentations: new Set(),
  });

  // Track abort controllers for cancellation (future enhancement)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  /**
   * Open documentation file in default editor
   */
  const openDocFile = useCallback(async (filePath: string) => {
    try {
      await open(filePath);
      console.log('[useTaskCompletionHooks] Opened doc file:', filePath);
    } catch (err) {
      console.error('[useTaskCompletionHooks] Failed to open doc file:', err);
      toast.error('Failed to open documentation file', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  /**
   * Process task completion in background
   */
  const processTaskCompletion = useCallback(async (
    taskId: string,
    task: KanbanTask,
    messages: ChatMessage[],
    options: TaskCompletionOptions
  ) => {
    console.log('[useTaskCompletionHooks] Processing task completion:', taskId, options);

    // Mark as processing
    setState(prev => ({
      ...prev,
      isProcessing: new Map(prev.isProcessing).set(taskId, true),
      pendingDocumentations: new Set(prev.pendingDocumentations).add(taskId),
    }));

    try {
      // Import the completion service dynamically to avoid circular deps
      const { onTaskComplete } = await import('../services/taskCompletionHooks');

      // Process in background (non-blocking)
      const result = await onTaskComplete({
        task,
        chatMessages: messages,
        options,
      });

      console.log('[useTaskCompletionHooks] Task completion result:', result);

      // Update state with result
      setState(prev => ({
        ...prev,
        isProcessing: new Map(prev.isProcessing).set(taskId, false),
        results: new Map(prev.results).set(taskId, result),
        pendingDocumentations: (() => {
          const next = new Set(prev.pendingDocumentations);
          next.delete(taskId);
          return next;
        })(),
      }));

      // Show success toast with "Open" action
      if (result.docFilePath && !result.skipped) {
        toast.success('Task documented', {
          description: 'Documentation saved to project',
          action: {
            label: 'Open',
            onClick: () => openDocFile(result.docFilePath!),
          },
          duration: 5000,
        });
      } else if (result.skipped) {
        toast.info('Task marked as done', {
          description: 'Documentation skipped',
          duration: 3000,
        });
      }

      // Handle errors
      if (result.error) {
        toast.error('Failed to document task', {
          description: result.error,
          duration: 5000,
        });
      }
    } catch (err) {
      console.error('[useTaskCompletionHooks] Task completion failed:', err);

      // Update state with error
      const errorResult: TaskCompletionResult = {
        error: err instanceof Error ? err.message : String(err),
      };

      setState(prev => ({
        ...prev,
        isProcessing: new Map(prev.isProcessing).set(taskId, false),
        results: new Map(prev.results).set(taskId, errorResult),
        pendingDocumentations: (() => {
          const next = new Set(prev.pendingDocumentations);
          next.delete(taskId);
          return next;
        })(),
      }));

      // Show error toast
      toast.error('Failed to process task completion', {
        description: err instanceof Error ? err.message : String(err),
        duration: 5000,
      });
    } finally {
      // Clean up abort controller
      abortControllersRef.current.delete(taskId);
    }
  }, [openDocFile]);

  /**
   * Clear result for a task (e.g., when task is deleted)
   */
  const clearResult = useCallback((taskId: string) => {
    setState(prev => {
      const nextResults = new Map(prev.results);
      nextResults.delete(taskId);
      return {
        ...prev,
        results: nextResults,
      };
    });
  }, []);

  return {
    processTaskCompletion,
    isProcessing: state.isProcessing,
    completionResults: state.results,
    pendingDocumentations: state.pendingDocumentations,
    clearResult,
  };
}
