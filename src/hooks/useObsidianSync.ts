/**
 * useObsidianSync Hook
 *
 * React hook for managing Obsidian-Brain bidirectional sync.
 * Provides reactive access to sync settings, watcher status, and sync operations.
 *
 * @module hooks/useObsidianSync
 */

import { useState, useEffect, useCallback } from 'react';
import * as syncService from '../services/obsidianSyncService';
import type { BrainSettings, SyncConflict, FileChangeEvent, SyncStatus } from '../types/brainSync';

/**
 * Hook return type
 */
interface UseObsidianSyncReturn {
  /** Current sync settings */
  settings: BrainSettings | null;
  /** Current sync status */
  syncStatus: SyncStatus | null;
  /** Whether vault watcher is active */
  isWatching: boolean;
  /** Unresolved conflicts */
  conflicts: SyncConflict[];
  /** Whether sync operation is in progress */
  isSyncing: boolean;
  /** Error message if operation failed */
  error: string | null;
  /** Update a single setting */
  updateSetting: (key: keyof BrainSettings, value: string | boolean) => Promise<void>;
  /** Start vault file watcher */
  startWatcher: () => Promise<void>;
  /** Stop vault file watcher */
  stopWatcher: () => Promise<void>;
  /** Export all entities to vault */
  syncAllToVault: () => Promise<void>;
  /** Import all files from vault */
  importAllFromVault: () => Promise<void>;
  /** Resolve a conflict */
  resolveConflict: (entityId: string, resolution: 'brain' | 'obsidian') => Promise<void>;
  /** Resolve all conflicts with same resolution */
  resolveAllConflicts: (resolution: 'brain' | 'obsidian') => Promise<void>;
  /** Open vault folder in file browser */
  openVaultFolder: () => Promise<void>;
  /** Refresh settings and status */
  refresh: () => Promise<void>;
}

/**
 * Hook for Obsidian sync management
 *
 * Provides reactive access to sync state and operations.
 * Automatically subscribes to file change events and updates state.
 *
 * @returns Sync state and operations
 *
 * @example
 * ```tsx
 * function SyncSettings() {
 *   const {
 *     settings,
 *     isWatching,
 *     isSyncing,
 *     conflicts,
 *     startWatcher,
 *     stopWatcher,
 *     syncAllToVault,
 *     updateSetting,
 *   } = useObsidianSync();
 *
 *   if (!settings) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>Obsidian Sync</h2>
 *
 *       <label>
 *         Vault Path:
 *         <input
 *           value={settings.vaultPath}
 *           onChange={e => updateSetting('vaultPath', e.target.value)}
 *         />
 *       </label>
 *
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={settings.syncEnabled}
 *           onChange={e => updateSetting('syncEnabled', e.target.checked)}
 *         />
 *         Enable Sync
 *       </label>
 *
 *       {settings.syncEnabled && (
 *         <div>
 *           <button onClick={isWatching ? stopWatcher : startWatcher}>
 *             {isWatching ? 'Stop Watching' : 'Start Watching'}
 *           </button>
 *
 *           <button onClick={syncAllToVault} disabled={isSyncing}>
 *             {isSyncing ? 'Syncing...' : 'Export to Vault'}
 *           </button>
 *         </div>
 *       )}
 *
 *       {conflicts.length > 0 && (
 *         <div>
 *           <h3>Conflicts ({conflicts.length})</h3>
 *           {conflicts.map(conflict => (
 *             <div key={conflict.entityId}>
 *               <p>{conflict.entityName}</p>
 *               <button onClick={() => resolveConflict(conflict.entityId, 'brain')}>
 *                 Keep Brain Version
 *               </button>
 *               <button onClick={() => resolveConflict(conflict.entityId, 'obsidian')}>
 *                 Keep Obsidian Version
 *               </button>
 *             </div>
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useObsidianSync(): UseObsidianSyncReturn {
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load settings from backend
   */
  const loadSettings = useCallback(async () => {
    try {
      setError(null);
      const s = await syncService.getSettings();
      setSettings(s);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errMsg);
      console.error('[useObsidianSync] Failed to load settings:', err);
    }
  }, []);

  /**
   * Check watcher status
   */
  const checkWatcherStatus = useCallback(async () => {
    try {
      setError(null);
      const watching = await syncService.isVaultWatching();
      setIsWatching(watching);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to check watcher status';
      setError(errMsg);
      console.error('[useObsidianSync] Failed to check watcher status:', err);
    }
  }, []);

  /**
   * Handle file change events from vault
   */
  const handleFileChange = useCallback(
    async (event: FileChangeEvent) => {
      console.log('[useObsidianSync] File change:', event);

      if (!settings?.autoSyncFromVault) {
        console.log('[useObsidianSync] Auto-sync from vault disabled, skipping');
        return;
      }

      try {
        if (event.eventType === 'deleted') {
          // TODO: Handle deletion - maybe mark entity as deleted?
          console.log('[useObsidianSync] File deleted:', event.path);
        } else {
          // Import modified/created file
          await syncService.importFromVault(event.path);
          console.log('[useObsidianSync] Imported from vault:', event.path);
        }
      } catch (err) {
        console.error('[useObsidianSync] Import error:', err);
      }
    },
    [settings]
  );

  /**
   * Load initial state on mount
   */
  useEffect(() => {
    loadSettings();
    checkWatcherStatus();
  }, [loadSettings, checkWatcherStatus]);

  /**
   * Auto-start watcher when sync is enabled and vault path is set
   */
  useEffect(() => {
    const autoStartWatcher = async () => {
      // Only auto-start if:
      // 1. Settings are loaded
      // 2. Sync is enabled
      // 3. Vault path is configured
      // 4. Watcher is not already running
      if (
        settings?.syncEnabled &&
        settings?.vaultPath &&
        settings?.autoSyncFromVault &&
        !isWatching
      ) {
        console.log('[useObsidianSync] Auto-starting vault watcher...');
        try {
          await syncService.startVaultWatcher();
          setIsWatching(true);
          console.log('[useObsidianSync] Vault watcher auto-started successfully');
        } catch (err) {
          console.error('[useObsidianSync] Failed to auto-start vault watcher:', err);
        }
      }
    };

    autoStartWatcher();
  }, [settings?.syncEnabled, settings?.vaultPath, settings?.autoSyncFromVault, isWatching]);

  /**
   * Subscribe to file changes
   */
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setup = async () => {
      try {
        unsubscribe = await syncService.subscribeToFileChanges(handleFileChange);
      } catch (err) {
        console.error('[useObsidianSync] Failed to subscribe to file changes:', err);
      }
    };

    setup();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [handleFileChange]);

  /**
   * Subscribe to sync events
   */
  useEffect(() => {
    const handleSyncStarted = () => {
      setIsSyncing(true);
    };

    const handleSyncCompleted = (e: Event) => {
      setIsSyncing(false);
      setError(null);

      const detail = (e as CustomEvent).detail;
      if (detail?.conflicts) {
        setConflicts(detail.conflicts);
      }

      // Update sync status
      setSyncStatus({
        lastSyncTime: Date.now(),
        entityCount: detail?.entitiesSynced || 0,
        conflictCount: detail?.conflicts?.length || 0,
        isGeneratingEmbeddings: false,
        embeddingProgress: 0,
      });
    };

    const handleSyncError = (e: Event) => {
      setIsSyncing(false);
      const detail = (e as CustomEvent).detail;
      const errMsg = detail?.error || 'Sync error occurred';
      setError(errMsg);
      console.error('[useObsidianSync] Sync error:', errMsg);
    };

    window.addEventListener(syncService.SYNC_EVENTS.SYNC_STARTED, handleSyncStarted);
    window.addEventListener(syncService.SYNC_EVENTS.SYNC_COMPLETED, handleSyncCompleted);
    window.addEventListener(syncService.SYNC_EVENTS.SYNC_ERROR, handleSyncError);

    return () => {
      window.removeEventListener(syncService.SYNC_EVENTS.SYNC_STARTED, handleSyncStarted);
      window.removeEventListener(syncService.SYNC_EVENTS.SYNC_COMPLETED, handleSyncCompleted);
      window.removeEventListener(syncService.SYNC_EVENTS.SYNC_ERROR, handleSyncError);
    };
  }, []);

  /**
   * Update a single setting
   */
  const updateSetting = useCallback(
    async (key: keyof BrainSettings, value: string | boolean) => {
      try {
        setError(null);
        await syncService.setSetting(key, value);
        await loadSettings();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to update setting';
        setError(errMsg);
        console.error('[useObsidianSync] Failed to update setting:', err);
        throw err;
      }
    },
    [loadSettings]
  );

  /**
   * Start vault watcher
   */
  const startWatcher = useCallback(async () => {
    try {
      setError(null);
      await syncService.startVaultWatcher();
      setIsWatching(true);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to start watcher';
      setError(errMsg);
      console.error('[useObsidianSync] Failed to start watcher:', err);
      throw err;
    }
  }, []);

  /**
   * Stop vault watcher
   */
  const stopWatcher = useCallback(async () => {
    try {
      setError(null);
      await syncService.stopVaultWatcher();
      setIsWatching(false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to stop watcher';
      setError(errMsg);
      console.error('[useObsidianSync] Failed to stop watcher:', err);
      throw err;
    }
  }, []);

  /**
   * Sync all entities to vault
   */
  const syncAllToVault = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const result = await syncService.syncAllToVault();

      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
      }

      // Update sync status
      setSyncStatus({
        lastSyncTime: Date.now(),
        entityCount: result.entitiesSynced,
        conflictCount: result.conflicts.length,
        isGeneratingEmbeddings: false,
        embeddingProgress: 0,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Sync to vault failed';
      setError(errMsg);
      console.error('[useObsidianSync] Sync to vault failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Import all files from vault
   */
  const importAllFromVault = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const result = await syncService.importAllFromVault();

      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
      }

      // Update sync status
      setSyncStatus({
        lastSyncTime: Date.now(),
        entityCount: result.entitiesSynced,
        conflictCount: result.conflicts.length,
        isGeneratingEmbeddings: false,
        embeddingProgress: 0,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Import from vault failed';
      setError(errMsg);
      console.error('[useObsidianSync] Import from vault failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Resolve a conflict
   */
  const resolveConflict = useCallback(
    async (entityId: string, resolution: 'brain' | 'obsidian') => {
      try {
        setError(null);
        await syncService.resolveConflict(entityId, resolution);
        setConflicts((prev) => prev.filter((c) => c.entityId !== entityId));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to resolve conflict';
        setError(errMsg);
        console.error('[useObsidianSync] Failed to resolve conflict:', err);
        throw err;
      }
    },
    []
  );

  /**
   * Resolve all conflicts with same resolution
   */
  const resolveAllConflicts = useCallback(
    async (resolution: 'brain' | 'obsidian') => {
      try {
        setError(null);

        // Resolve each conflict sequentially
        for (const conflict of conflicts) {
          await syncService.resolveConflict(conflict.entityId, resolution);
        }

        // Clear all conflicts
        setConflicts([]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to resolve all conflicts';
        setError(errMsg);
        console.error('[useObsidianSync] Failed to resolve all conflicts:', err);
        throw err;
      }
    },
    [conflicts]
  );

  /**
   * Open vault folder
   */
  const openVaultFolder = useCallback(async () => {
    try {
      setError(null);
      await syncService.openVaultFolder();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to open vault folder';
      setError(errMsg);
      console.error('[useObsidianSync] Failed to open vault folder:', err);
      throw err;
    }
  }, []);

  /**
   * Refresh all state
   */
  const refresh = useCallback(async () => {
    await loadSettings();
    await checkWatcherStatus();
  }, [loadSettings, checkWatcherStatus]);

  return {
    settings,
    syncStatus,
    isWatching,
    conflicts,
    isSyncing,
    error,
    updateSetting,
    startWatcher,
    stopWatcher,
    syncAllToVault,
    importAllFromVault,
    resolveConflict,
    resolveAllConflicts,
    openVaultFolder,
    refresh,
  };
}

/**
 * Hook for monitoring sync status
 *
 * Provides lightweight access to sync status without full hook functionality.
 * Useful for displaying sync status in UI without managing operations.
 *
 * @returns Current sync status
 *
 * @example
 * ```tsx
 * function SyncStatusBadge() {
 *   const { isSyncing, isWatching, lastSyncTime } = useSyncStatus();
 *
 *   return (
 *     <div>
 *       {isSyncing && <Spinner />}
 *       {isWatching && <Icon name="eye" />}
 *       {lastSyncTime && (
 *         <span>Last sync: {new Date(lastSyncTime).toLocaleTimeString()}</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSyncStatus() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  useEffect(() => {
    // Check watcher status on mount
    syncService.isVaultWatching().then(setIsWatching);

    // Listen for sync events
    const handleSyncStarted = () => setIsSyncing(true);
    const handleSyncCompleted = () => {
      setIsSyncing(false);
      setLastSyncTime(Date.now());
    };
    const handleSyncError = () => setIsSyncing(false);

    window.addEventListener(syncService.SYNC_EVENTS.SYNC_STARTED, handleSyncStarted);
    window.addEventListener(syncService.SYNC_EVENTS.SYNC_COMPLETED, handleSyncCompleted);
    window.addEventListener(syncService.SYNC_EVENTS.SYNC_ERROR, handleSyncError);

    return () => {
      window.removeEventListener(syncService.SYNC_EVENTS.SYNC_STARTED, handleSyncStarted);
      window.removeEventListener(syncService.SYNC_EVENTS.SYNC_COMPLETED, handleSyncCompleted);
      window.removeEventListener(syncService.SYNC_EVENTS.SYNC_ERROR, handleSyncError);
    };
  }, []);

  return {
    isSyncing,
    isWatching,
    lastSyncTime,
  };
}

export default useObsidianSync;
