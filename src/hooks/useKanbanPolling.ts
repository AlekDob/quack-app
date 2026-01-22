/**
 * useKanbanPolling Hook
 *
 * Event-driven + fallback polling system for Kanban tasks.
 * Detects changes made by MCP server via file watcher events (primary)
 * and periodic polling (fallback for reliability).
 *
 * Features:
 * - EVENT-DRIVEN: Listens to kanban:tasks-changed events (immediate updates)
 * - FALLBACK POLLING: Polls every 30s (safety net, not primary mechanism)
 * - Pauses when document is hidden (tab not visible)
 * - Uses fingerprint comparison to avoid unnecessary reloads
 *
 * Usage:
 * ```tsx
 * // In KanbanTabView or KanbanPopoutView
 * useKanbanPolling({ enabled: true, interval: 30000 });
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useKanbanStore, kanbanWriteLock } from '../stores/kanbanStore';
import { useSessionStore, sessionWriteLock } from '../stores/sessionStore';

interface UseKanbanPollingOptions {
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
  /** Fallback polling interval in milliseconds (default: 30000 = 30s) */
  interval?: number;
}

/**
 * Hook for event-driven Kanban task updates with fallback polling
 */
export function useKanbanPolling(options: UseKanbanPollingOptions = {}) {
  const { enabled = true, interval = 30000 } = options; // 30s fallback (not 3s!)

  // 🦆 SESSIONS-FIRST: Load sessions directly (kanbanStore.loadTasks is a no-op)
  const loadSessions = useSessionStore((state) => state.loadSessions);
  // 🦆 SESSIONS-FIRST: Get tasks via getter instead of direct state access
  const getTasksByStatus = useKanbanStore((state) => state.getTasksByStatus);

  // Track last fingerprint to avoid unnecessary reloads
  const lastFingerprintRef = useRef<string>('');
  // Track if we're currently loading to avoid overlapping requests
  const isPollingRef = useRef<boolean>(false);

  // Create fingerprint from tasks (id + status + completedAt)
  const createFingerprint = useCallback((): string => {
    const allTasks = [
      ...getTasksByStatus('todo'),
      ...getTasksByStatus('in_progress'),
      ...getTasksByStatus('done'),
    ];
    return allTasks
      .map(t => `${t.id}:${t.status}:${t.completedAt || 0}`)
      .sort()
      .join('|');
  }, [getTasksByStatus]);

  // Update fingerprint periodically (sessions are the source of truth now)
  useEffect(() => {
    lastFingerprintRef.current = createFingerprint();
  }, [createFingerprint]);

  // === PRIMARY: Event Listener (immediate updates) ===
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let unlisten: (() => void) | null = null;

    // Setup event listener for kanban:tasks-changed
    const setupListener = async () => {
      try {
        unlisten = await listen<{ path: string; event_type: string }>('kanban:tasks-changed', (event) => {
          console.log('[useKanbanPolling] Received kanban:tasks-changed event:', event.payload);

          // Skip if already loading
          if (isPollingRef.current) {
            console.log('[useKanbanPolling] Already reloading, skipping event');
            return;
          }

          // Skip if a local write just happened (prevents race condition)
          // Check both kanban and session write locks since they write to the same file
          if (sessionWriteLock.shouldSkipReload() || kanbanWriteLock.shouldSkipReload()) {
            console.log('[useKanbanPolling] Skipping reload due to recent local write');
            return;
          }

          // Reload sessions immediately (sessions are the source of truth for Kanban V2)
          isPollingRef.current = true;
          loadSessions({ silent: true })
            .catch((error) => {
              console.error('[useKanbanPolling] Failed to reload sessions from event:', error);
            })
            .finally(() => {
              isPollingRef.current = false;
            });
        });

        console.log('[useKanbanPolling] Event listener registered for kanban:tasks-changed (sessions reload)');
      } catch (error) {
        console.error('[useKanbanPolling] Failed to setup event listener:', error);
      }
    };

    setupListener();

    // Cleanup listener on unmount
    return () => {
      if (unlisten) {
        unlisten();
        console.log('[useKanbanPolling] Event listener cleaned up');
      }
    };
  }, [enabled, loadSessions]);

  // === FALLBACK: Polling (30s safety net) ===
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const poll = async () => {
      // Skip if already polling or document is hidden
      if (isPollingRef.current || document.hidden) {
        return;
      }

      // Skip if a local write just happened (prevents race condition)
      if (sessionWriteLock.shouldSkipReload() || kanbanWriteLock.shouldSkipReload()) {
        return;
      }

      isPollingRef.current = true;

      try {
        // Load sessions silently (no loading indicator) for stealth polling
        await loadSessions({ silent: true });

        // Note: fingerprint comparison happens automatically via the tasks effect above
        // The store will only trigger re-renders if sessions actually changed
      } catch (error) {
        console.error('[useKanbanPolling] Failed to poll sessions:', error);
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
        console.log('[useKanbanPolling] Tab visible, polling (fallback)...');
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    console.log(`[useKanbanPolling] Fallback polling enabled (interval: ${interval}ms = ${interval / 1000}s)`);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, interval, loadSessions]);

  // Return nothing - this hook just sets up side effects
}

export default useKanbanPolling;
