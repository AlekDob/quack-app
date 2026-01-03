/**
 * useKanbanPolling Hook
 *
 * Provides automatic polling for Kanban tasks to detect changes made by
 * external sources (MCP server, other windows, etc.)
 *
 * Features:
 * - Polls every N seconds (default 3s)
 * - Pauses when document is hidden (tab not visible)
 * - Pauses when disabled via parameter
 * - Uses fingerprint comparison to avoid unnecessary reloads
 *
 * Usage:
 * ```tsx
 * // In KanbanTabView or KanbanPopoutView
 * useKanbanPolling({ enabled: true, interval: 3000 });
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { useKanbanStore } from '../stores/kanbanStore';

interface UseKanbanPollingOptions {
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 3000) */
  interval?: number;
}

/**
 * Hook for automatic Kanban task polling
 */
export function useKanbanPolling(options: UseKanbanPollingOptions = {}) {
  const { enabled = true, interval = 3000 } = options;

  const loadTasks = useKanbanStore((state) => state.loadTasks);
  const tasks = useKanbanStore((state) => state.tasks);

  // Track last fingerprint to avoid unnecessary reloads
  const lastFingerprintRef = useRef<string>('');
  // Track if we're currently loading to avoid overlapping requests
  const isPollingRef = useRef<boolean>(false);

  // Create fingerprint from tasks (id + status + updatedAt)
  const createFingerprint = useCallback((taskList: typeof tasks): string => {
    return taskList
      .map(t => `${t.id}:${t.status}:${t.completedAt || 0}`)
      .sort()
      .join('|');
  }, []);

  // Update fingerprint when tasks change
  useEffect(() => {
    lastFingerprintRef.current = createFingerprint(tasks);
  }, [tasks, createFingerprint]);

  // Polling logic
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const poll = async () => {
      // Skip if already polling or document is hidden
      if (isPollingRef.current || document.hidden) {
        return;
      }

      isPollingRef.current = true;

      try {
        // Load tasks silently (no loading indicator) for stealth polling
        await loadTasks({ silent: true });

        // Note: fingerprint comparison happens automatically via the tasks effect above
        // The store will only trigger re-renders if tasks actually changed
      } catch (error) {
        console.error('[useKanbanPolling] Failed to poll tasks:', error);
      } finally {
        isPollingRef.current = false;
      }
    };

    // Initial poll after a short delay (let the UI settle first)
    const initialTimeout = setTimeout(poll, 500);

    // Set up interval for continuous polling
    const intervalId = setInterval(poll, interval);

    // Handle visibility changes - poll immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[useKanbanPolling] Tab visible, polling...');
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, interval, loadTasks]);

  // Return nothing - this hook just sets up side effects
}

export default useKanbanPolling;
