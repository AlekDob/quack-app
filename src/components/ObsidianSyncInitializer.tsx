/**
 * ObsidianSyncInitializer Component
 *
 * Initializes Obsidian vault sync on app startup.
 * Uses the useObsidianSync hook to auto-start the watcher when sync is enabled.
 * This component renders nothing - it's purely for side effects.
 *
 * @module components/ObsidianSyncInitializer
 */

import { useEffect } from 'react';
import useObsidianSync from '../hooks/useObsidianSync';

/**
 * Invisible component that initializes Obsidian sync
 *
 * Should be mounted once at the app root level.
 * Automatically starts the vault watcher when:
 * - Sync is enabled
 * - Vault path is configured
 * - Auto-sync from vault is enabled
 */
export default function ObsidianSyncInitializer(): null {
  const {
    settings,
    isWatching,
    startWatcher,
    error,
  } = useObsidianSync();

  // Log sync status for debugging
  useEffect(() => {
    if (settings) {
      console.log('[ObsidianSyncInitializer] Settings loaded:', {
        syncEnabled: settings.syncEnabled,
        vaultPath: settings.vaultPath,
        autoSyncToVault: settings.autoSyncToVault,
        autoSyncFromVault: settings.autoSyncFromVault,
      });
    }
  }, [settings]);

  // Log watcher status changes
  useEffect(() => {
    console.log('[ObsidianSyncInitializer] Watcher status:', isWatching ? 'ACTIVE' : 'INACTIVE');
  }, [isWatching]);

  // Log errors
  useEffect(() => {
    if (error) {
      console.error('[ObsidianSyncInitializer] Error:', error);
    }
  }, [error]);

  // This component renders nothing
  return null;
}
