/**
 * Example: Semantic File Watcher Integration
 *
 * This example shows how to integrate the semantic file watcher
 * with a code search indexing system.
 */

import { useEffect, useState } from 'react';
import {
  startSemanticWatcher,
  stopSemanticWatcher,
  onSemanticFileChange,
  WatcherPresets,
  type SemanticFileEvent,
} from '@/lib/semantic-watcher';

interface SemanticWatcherHookProps {
  projectPath: string;
  onFileChange?: (event: SemanticFileEvent) => void;
  enabled?: boolean;
}

/**
 * React hook for semantic file watching
 */
export function useSemanticWatcher({
  projectPath,
  onFileChange,
  enabled = true,
}: SemanticWatcherHookProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !projectPath) return;

    let unlisten: (() => void) | null = null;

    async function startWatcher() {
      try {
        // Start the watcher with TypeScript preset
        await startSemanticWatcher(projectPath, WatcherPresets.typescript);
        setIsWatching(true);
        setError(null);

        // Listen for file change events
        unlisten = await onSemanticFileChange((event) => {
          console.log('[SemanticWatcher] File changed:', event);

          // Call custom handler if provided
          if (onFileChange) {
            onFileChange(event);
          }

          // Default: trigger reindexing
          handleFileChange(event);
        });
      } catch (err) {
        console.error('[SemanticWatcher] Failed to start:', err);
        setError(err instanceof Error ? err.message : String(err));
        setIsWatching(false);
      }
    }

    startWatcher();

    // Cleanup on unmount
    return () => {
      if (unlisten) unlisten();
      stopSemanticWatcher(projectPath).catch(console.error);
      setIsWatching(false);
    };
  }, [projectPath, enabled, onFileChange]);

  return { isWatching, error };
}

/**
 * Handle file change events and trigger reindexing
 */
async function handleFileChange(event: SemanticFileEvent) {
  const { filePath, operation, projectPath } = event;

  switch (operation) {
    case 'create':
      console.log(`[Indexer] Indexing new file: ${filePath}`);
      // TODO: Call your indexing service
      // await indexFile(filePath, projectPath);
      break;

    case 'modify':
      console.log(`[Indexer] Reindexing modified file: ${filePath}`);
      // TODO: Update index for modified file
      // await reindexFile(filePath, projectPath);
      break;

    case 'delete':
      console.log(`[Indexer] Removing deleted file from index: ${filePath}`);
      // TODO: Remove from index
      // await removeFromIndex(filePath, projectPath);
      break;
  }
}

/**
 * Example component that uses the semantic watcher
 */
export function SemanticSearchView({ projectPath }: { projectPath: string }) {
  const [events, setEvents] = useState<SemanticFileEvent[]>([]);

  const { isWatching, error } = useSemanticWatcher({
    projectPath,
    enabled: true,
    onFileChange: (event) => {
      // Add to event log (keep last 20)
      setEvents((prev) => [...prev, event].slice(-20));
    },
  });

  return (
    <div className="semantic-watcher-panel">
      <div className="watcher-status">
        {isWatching ? (
          <span className="status-active">Watching {projectPath}</span>
        ) : error ? (
          <span className="status-error">Error: {error}</span>
        ) : (
          <span className="status-idle">Not watching</span>
        )}
      </div>

      <div className="event-log">
        <h3>Recent File Changes</h3>
        {events.length === 0 ? (
          <p>No changes detected yet</p>
        ) : (
          <ul>
            {events.map((event, i) => (
              <li key={i} className={`event-${event.operation}`}>
                <span className="operation">{event.operation}</span>
                <span className="path">{event.filePath}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Example: Start watcher when opening a project
 */
export async function onProjectOpen(projectPath: string) {
  try {
    // Auto-detect project type and use appropriate preset
    const preset = detectProjectType(projectPath);
    await startSemanticWatcher(projectPath, WatcherPresets[preset]);

    console.log(`[SemanticWatcher] Started watching ${projectPath} with ${preset} preset`);
  } catch (err) {
    console.error('[SemanticWatcher] Failed to start:', err);
  }
}

/**
 * Detect project type based on files
 */
function detectProjectType(projectPath: string): keyof typeof WatcherPresets {
  // TODO: Implement actual detection logic
  // Check for package.json, Cargo.toml, requirements.txt, etc.
  return 'all'; // Default to watching all file types
}
