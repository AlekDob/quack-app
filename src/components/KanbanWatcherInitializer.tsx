/**
 * KanbanWatcherInitializer Component
 *
 * Initializes Kanban tasks file watcher on app startup.
 * Watches the quack-kanban-tasks.json file for changes made by the MCP server
 * and triggers immediate UI updates via events (no polling delay).
 *
 * This component renders nothing - it's purely for side effects.
 *
 * @module components/KanbanWatcherInitializer
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import { join } from '@tauri-apps/api/path';

/**
 * Invisible component that initializes Kanban watcher
 *
 * Should be mounted once at the app root level.
 * Automatically starts watching the Kanban tasks file on mount.
 */
export default function KanbanWatcherInitializer(): null {
  const [watcherActive, setWatcherActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeWatcher = async () => {
      try {
        // Get the path to quack-kanban-tasks.json based on OS
        const home = await homeDir();
        let kanbanTasksPath: string;

        if (navigator.userAgent.includes('Mac')) {
          kanbanTasksPath = await join(home, 'Library', 'Application Support', 'com.quack.terminal', 'quack-kanban-tasks.json');
        } else if (navigator.userAgent.includes('Win')) {
          kanbanTasksPath = await join(home, 'AppData', 'Roaming', 'com.quack.terminal', 'quack-kanban-tasks.json');
        } else {
          // Linux
          kanbanTasksPath = await join(home, '.local', 'share', 'com.quack.terminal', 'quack-kanban-tasks.json');
        }

        console.log('[KanbanWatcherInitializer] Starting watcher for:', kanbanTasksPath);

        // Start the file watcher
        await invoke<void>('kanban_start_watcher', {
          filePath: kanbanTasksPath,
        });

        console.log('[KanbanWatcherInitializer] Watcher started successfully');
        setWatcherActive(true);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[KanbanWatcherInitializer] Failed to start watcher:', errorMsg);
        setError(errorMsg);
        setWatcherActive(false);
      }
    };

    initializeWatcher();

    // Cleanup: stop watcher on unmount
    return () => {
      invoke<void>('kanban_stop_watcher')
        .then(() => {
          console.log('[KanbanWatcherInitializer] Watcher stopped');
        })
        .catch((err) => {
          console.warn('[KanbanWatcherInitializer] Failed to stop watcher:', err);
        });
    };
  }, []); // Run only once on mount

  // Log watcher status for debugging
  useEffect(() => {
    console.log('[KanbanWatcherInitializer] Watcher status:', watcherActive ? 'ACTIVE' : 'INACTIVE');
  }, [watcherActive]);

  // Log errors
  useEffect(() => {
    if (error) {
      console.error('[KanbanWatcherInitializer] Error:', error);
    }
  }, [error]);

  // This component renders nothing
  return null;
}
