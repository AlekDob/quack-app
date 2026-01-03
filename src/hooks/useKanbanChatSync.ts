/**
 * useKanbanChatSync Hook
 *
 * Synchronizes Kanban state between main window and popout windows via Tauri events.
 * This enables the Kanban popout to show real-time status of tasks.
 *
 * Syncs two types of data:
 * 1. Chat state (loading, messages) - for Working/Ready indicators on cards
 * 2. Task changes signal - triggers popup to reload tasks from storage
 *
 * Main window: calls emitChatState() and emitTasksChanged()
 * Popup window: uses the returned state and onTasksChanged callback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatMessage } from '../types';

// Event payload type for chat state (LIGHTWEIGHT - only loading status, not full sessions)
interface ChatStatePayload {
  chatLoadingMap: Record<string, boolean>;
  // Note: chatSessions removed for performance - it changes too frequently during streaming
  timestamp: number;
}

// Event payload type for tasks changed signal
interface TasksChangedPayload {
  timestamp: number;
  changeType: 'create' | 'update' | 'delete' | 'move' | 'unknown';
  taskId?: string;
}

// Event names for cross-window sync
const CHAT_STATE_EVENT = 'kanban:chat-state-sync';
const TASKS_CHANGED_EVENT = 'kanban:tasks-changed';

interface UseKanbanChatSyncOptions {
  // Callback when tasks change (popup should call loadTasks())
  onTasksChanged?: (changeType: string, taskId?: string) => void;
}

interface UseKanbanChatSyncReturn {
  // State (for popup to read)
  chatLoadingMap: Map<string, boolean>;

  // Emitter for loading state only (for main window to call)
  // This is lightweight - only emits when loading status changes, not during streaming
  emitLoadingState: (loadingMap: Map<string, boolean>) => void;

  // Emitter for tasks changed signal (for main window to call)
  emitTasksChanged: (changeType?: 'create' | 'update' | 'delete' | 'move', taskId?: string) => void;
}

/**
 * Hook for synchronizing Kanban state across windows
 *
 * @param options.onTasksChanged - Callback when tasks change (popup should call loadTasks())
 */
export function useKanbanChatSync(options: UseKanbanChatSyncOptions = {}): UseKanbanChatSyncReturn {
  const { onTasksChanged } = options;

  const [chatLoadingMap, setChatLoadingMap] = useState<Map<string, boolean>>(new Map());

  // Debounce timers for emitting
  const emitLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitTasksTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track last emit to avoid duplicates
  const lastLoadingEmitRef = useRef<string>('');
  const lastTasksEmitRef = useRef<number>(0);
  // Store callback in ref to avoid re-creating listeners
  const onTasksChangedRef = useRef(onTasksChanged);
  onTasksChangedRef.current = onTasksChanged;

  // Emit loading state to all windows (called by main window)
  // LIGHTWEIGHT: Only emits when loading status actually changes
  const emitLoadingState = useCallback((loadingMap: Map<string, boolean>) => {
    // Create fingerprint of loading state
    const fingerprint = Array.from(loadingMap.entries())
      .filter(([, isLoading]) => isLoading)
      .map(([id]) => id)
      .sort()
      .join(',');

    // Skip if nothing changed
    if (fingerprint === lastLoadingEmitRef.current) {
      return;
    }
    lastLoadingEmitRef.current = fingerprint;

    // Debounce to avoid rapid emissions
    if (emitLoadingTimeoutRef.current) {
      clearTimeout(emitLoadingTimeoutRef.current);
    }

    emitLoadingTimeoutRef.current = setTimeout(() => {
      const payload: ChatStatePayload = {
        chatLoadingMap: Object.fromEntries(loadingMap),
        timestamp: Date.now(),
      };

      console.log('[useKanbanChatSync] EMITTING loading state:', fingerprint || '(empty)');
      emit(CHAT_STATE_EVENT, payload).catch(err => {
        console.error('[useKanbanChatSync] Failed to emit loading state:', err);
      });
    }, 100); // 100ms debounce
  }, []);

  // Emit tasks changed signal to all windows (called by main window)
  const emitTasksChanged = useCallback((
    changeType: 'create' | 'update' | 'delete' | 'move' = 'update',
    taskId?: string
  ) => {
    // Debounce to batch rapid changes
    if (emitTasksTimeoutRef.current) {
      clearTimeout(emitTasksTimeoutRef.current);
    }

    emitTasksTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      // Don't emit more than once per 200ms (tasks change less frequently than chat)
      if (now - lastTasksEmitRef.current < 200) {
        return;
      }
      lastTasksEmitRef.current = now;

      const payload: TasksChangedPayload = {
        timestamp: now,
        changeType,
        taskId,
      };

      emit(TASKS_CHANGED_EVENT, payload).catch(err => {
        console.error('[useKanbanChatSync] Failed to emit tasks changed:', err);
      });

      console.log(`[useKanbanChatSync] Emitted tasks-changed: ${changeType}`, taskId || '');
    }, 100); // 100ms debounce for tasks
  }, []);

  // Listen for chat state updates (ONLY in popup window, not main window)
  // We detect if we're in a popup by checking the window label
  useEffect(() => {
    let unlistenChat: UnlistenFn | null = null;
    let unlistenTasks: UnlistenFn | null = null;
    let isPopupWindow = false;

    const setupListeners = async () => {
      try {
        // Check if this is a popup window (not the main window)
        // Main window should NOT listen to avoid infinite loops
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const currentWindow = getCurrentWindow();
        isPopupWindow = currentWindow.label !== 'main';

        if (!isPopupWindow) {
          // Main window: don't set up listeners, only emit
          console.log('[useKanbanChatSync] Main window - skipping listeners (emit only)');
          return;
        }

        // Popup window: set up listeners to receive state from main
        // Loading state listener (lightweight - only loading status, not full chat)
        unlistenChat = await listen<ChatStatePayload>(CHAT_STATE_EVENT, (event) => {
          const { chatLoadingMap: loadingObj } = event.payload;
          const newMap = new Map(Object.entries(loadingObj));
          console.log('[useKanbanChatSync] RECEIVED loading state:', Object.keys(loadingObj).filter(k => loadingObj[k]).join(',') || '(empty)');
          setChatLoadingMap(newMap);
        });

        // Tasks changed listener
        unlistenTasks = await listen<TasksChangedPayload>(TASKS_CHANGED_EVENT, (event) => {
          const { changeType, taskId } = event.payload;

          // Call the callback to reload tasks
          if (onTasksChangedRef.current) {
            onTasksChangedRef.current(changeType, taskId);
          }
        });

        console.log('[useKanbanChatSync] Popup window - listening for sync events');
      } catch (err) {
        console.error('[useKanbanChatSync] Failed to setup listeners:', err);
      }
    };

    setupListeners();

    return () => {
      if (unlistenChat) unlistenChat();
      if (unlistenTasks) unlistenTasks();
      if (emitLoadingTimeoutRef.current) clearTimeout(emitLoadingTimeoutRef.current);
      if (emitTasksTimeoutRef.current) clearTimeout(emitTasksTimeoutRef.current);
    };
  }, []);

  return {
    chatLoadingMap,
    emitLoadingState,
    emitTasksChanged,
  };
}
