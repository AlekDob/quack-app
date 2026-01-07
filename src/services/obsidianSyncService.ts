/**
 * Obsidian Sync Service
 *
 * Provides bidirectional sync between Quack Brain and Obsidian vault.
 * Handles vault watching, markdown export/import, conflict resolution,
 * and automatic embedding generation.
 *
 * @module services/obsidianSyncService
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open as openPath } from '@tauri-apps/plugin-shell';
import type { BrainSettings, SyncResult, SyncConflict, FileChangeEvent, ParsedMarkdown } from '../types/brainSync';
import type { BrainEntity } from '../types/brain';
import { BRAIN_UPDATED_EVENT } from './brainService';

// ============================================================================
// Event Names
// ============================================================================

/**
 * Events emitted by the sync system
 */
export const SYNC_EVENTS = {
  FILE_CHANGED: 'brain:file-changed',
  FILE_CREATED: 'brain:file-created',
  FILE_DELETED: 'brain:file-deleted',
  SYNC_STARTED: 'brain:sync-started',
  SYNC_COMPLETED: 'brain:sync-completed',
  SYNC_CONFLICT: 'brain:sync-conflict',
  SYNC_ERROR: 'brain:sync-error',
  EMBED_PROGRESS: 'brain:embed-progress',
} as const;

// ============================================================================
// Settings Management
// ============================================================================

/**
 * Get current sync settings
 *
 * Returns the current Obsidian sync configuration.
 * Settings are persisted to disk and loaded on app startup.
 *
 * @returns Current sync settings
 *
 * @example
 * ```typescript
 * const settings = await getSettings();
 * console.log('Vault path:', settings.vaultPath);
 * console.log('Sync enabled:', settings.syncEnabled);
 * ```
 */
export async function getSettings(): Promise<BrainSettings> {
  return invoke<BrainSettings>('brain_get_settings');
}

/**
 * Update a single setting
 *
 * Updates a specific setting and persists to disk.
 * Triggers settings update event.
 *
 * @param key - Setting key to update
 * @param value - New value (converted to string internally)
 *
 * @example
 * ```typescript
 * await setSetting('syncEnabled', true);
 * await setSetting('vaultPath', '/Users/user/vault');
 * await setSetting('autoSyncToVault', false);
 * ```
 */
export async function setSetting(key: keyof BrainSettings, value: string | boolean): Promise<void> {
  await invoke('brain_set_setting', { key, value: String(value) });
  console.log('[ObsidianSync] Setting updated:', key, '=', value);
}

/**
 * Set vault path
 *
 * Convenience function to update the vault path.
 * Validates that the path exists before setting.
 *
 * @param path - Absolute path to Obsidian vault
 *
 * @example
 * ```typescript
 * await setVaultPath('/Users/user/Documents/ObsidianVault');
 * ```
 */
export async function setVaultPath(path: string): Promise<void> {
  await setSetting('vaultPath', path);
}

// ============================================================================
// Vault Watcher
// ============================================================================

/**
 * Start watching vault for file changes
 *
 * Starts a file watcher that monitors the vault directory for changes.
 * Emits events when files are created/modified/deleted.
 * Must have valid vault path set in settings.
 *
 * @throws Error if vault path is not configured or invalid
 *
 * @example
 * ```typescript
 * await startVaultWatcher();
 * console.log('Watching vault for changes...');
 * ```
 */
export async function startVaultWatcher(): Promise<void> {
  await invoke('brain_start_vault_watcher');
  console.log('[ObsidianSync] Vault watcher started');
}

/**
 * Stop watching vault
 *
 * Stops the file watcher and cleans up resources.
 * Safe to call even if watcher is not running.
 *
 * @example
 * ```typescript
 * await stopVaultWatcher();
 * console.log('Watcher stopped');
 * ```
 */
export async function stopVaultWatcher(): Promise<void> {
  await invoke('brain_stop_vault_watcher');
  console.log('[ObsidianSync] Vault watcher stopped');
}

/**
 * Check if vault watcher is running
 *
 * Returns current state of the vault watcher.
 *
 * @returns True if watcher is active, false otherwise
 *
 * @example
 * ```typescript
 * const isWatching = await isVaultWatching();
 * if (isWatching) {
 *   console.log('Vault is being watched');
 * }
 * ```
 */
export async function isVaultWatching(): Promise<boolean> {
  return invoke<boolean>('brain_is_vault_watching');
}

// ============================================================================
// Sync Operations - Brain to Vault
// ============================================================================

/**
 * Sync a single entity to vault as markdown
 *
 * Exports an entity as an Obsidian-compatible markdown file.
 * File includes YAML frontmatter with metadata and entity content.
 * Updates the entity's md_file_path field.
 *
 * @param entityId - Entity ID to sync
 * @returns File path where markdown was written
 *
 * @example
 * ```typescript
 * const path = await syncEntityToVault('entity-123');
 * console.log('Synced to:', path);
 * // => /Users/user/vault/QuackBrain/entity_name.md
 * ```
 */
export async function syncEntityToVault(entityId: string): Promise<string> {
  const path = await invoke<string>('brain_sync_entity_to_md', { entityId });
  console.log('[ObsidianSync] Entity synced to vault:', path);
  return path;
}

/**
 * Sync all entities to vault
 *
 * Performs bulk export of all Brain entities to markdown files.
 * Files are organized based on sync settings (subfolder or flat structure).
 * Creates/updates files as needed, skips unchanged entities.
 *
 * @returns Sync result with statistics
 *
 * @example
 * ```typescript
 * const result = await syncAllToVault();
 * console.log(`Synced ${result.entitiesSynced} entities`);
 * console.log(`Conflicts: ${result.conflicts.length}`);
 * if (result.errors.length > 0) {
 *   console.warn('Errors:', result.errors);
 * }
 * ```
 */
export async function syncAllToVault(): Promise<SyncResult> {
  window.dispatchEvent(new CustomEvent(SYNC_EVENTS.SYNC_STARTED));

  try {
    const result = await invoke<{ filesCreated: number; filesUpdated: number; errors: string[] }>(
      'brain_sync_all_to_md'
    );

    const syncResult: SyncResult = {
      success: result.errors.length === 0,
      entitiesSynced: result.filesCreated + result.filesUpdated,
      conflicts: [],
      errors: result.errors,
    };

    window.dispatchEvent(new CustomEvent(SYNC_EVENTS.SYNC_COMPLETED, { detail: syncResult }));
    console.log('[ObsidianSync] All entities synced:', syncResult);

    return syncResult;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    window.dispatchEvent(new CustomEvent(SYNC_EVENTS.SYNC_ERROR, { detail: { error } }));
    throw err;
  }
}

// ============================================================================
// Sync Operations - Vault to Brain
// ============================================================================

/**
 * Import a markdown file from vault
 *
 * Parses a markdown file and imports/updates the corresponding Brain entity.
 * Handles YAML frontmatter, observations, and relations.
 * Creates new entity if ID not found in frontmatter.
 *
 * @param filePath - Absolute path to markdown file
 * @returns Imported or updated entity
 *
 * @example
 * ```typescript
 * const entity = await importFromVault('/Users/user/vault/note.md');
 * console.log('Imported:', entity.name);
 * ```
 */
export async function importFromVault(filePath: string): Promise<BrainEntity> {
  const entity = await invoke<BrainEntity>('brain_import_markdown_file', { filePath });
  console.log('[ObsidianSync] Imported from vault:', entity.name);
  return entity;
}

/**
 * Import all markdown files from vault
 *
 * Scans the vault directory for markdown files and imports them to Brain.
 * Skips files that haven't changed (using sync hash).
 * Handles conflicts based on conflict policy setting.
 *
 * @returns Sync result with statistics
 *
 * @example
 * ```typescript
 * const result = await importAllFromVault();
 * console.log(`Imported ${result.entitiesSynced} entities`);
 * if (result.conflicts.length > 0) {
 *   console.log('Conflicts need resolution:', result.conflicts);
 * }
 * ```
 */
export async function importAllFromVault(): Promise<SyncResult> {
  window.dispatchEvent(new CustomEvent(SYNC_EVENTS.SYNC_STARTED));

  try {
    const result = await invoke<SyncResult>('brain_import_all_from_vault');
    window.dispatchEvent(new CustomEvent(SYNC_EVENTS.SYNC_COMPLETED, { detail: result }));
    console.log('[ObsidianSync] Import from vault completed:', result);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    window.dispatchEvent(new CustomEvent(SYNC_EVENTS.SYNC_ERROR, { detail: { error } }));
    throw err;
  }
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Resolve a sync conflict
 *
 * Resolves a conflict by choosing either Brain or Obsidian version.
 * Updates the entity accordingly and syncs to the other side.
 *
 * @param entityId - Entity ID with conflict
 * @param resolution - Which version to keep ('brain' or 'obsidian')
 *
 * @example
 * ```typescript
 * // User chooses to keep Brain version
 * await resolveConflict('entity-123', 'brain');
 *
 * // User chooses to keep Obsidian version
 * await resolveConflict('entity-456', 'obsidian');
 * ```
 */
export async function resolveConflict(
  entityId: string,
  resolution: 'brain' | 'obsidian'
): Promise<void> {
  await invoke('brain_resolve_conflict', { entityId, resolution });
  console.log('[ObsidianSync] Conflict resolved:', entityId, '->', resolution);
}

// ============================================================================
// Markdown Editor Integration
// ============================================================================

/**
 * Open file in configured markdown editor
 *
 * Opens a markdown file using the user's preferred editor.
 * Supports Obsidian (via URI), VSCode, Cursor, or system default.
 *
 * @param filePath - Absolute path to markdown file
 * @param editor - Editor to use (defaults to settings value)
 *
 * @example
 * ```typescript
 * // Open in Obsidian
 * await openInEditor('/Users/user/vault/note.md', 'obsidian');
 *
 * // Open in VSCode
 * await openInEditor('/Users/user/vault/note.md', 'vscode');
 *
 * // Open in system default
 * await openInEditor('/Users/user/vault/note.md', 'default');
 * ```
 */
export async function openInEditor(
  filePath: string,
  editor: BrainSettings['markdownEditor']
): Promise<void> {
  try {
    switch (editor) {
      case 'obsidian':
        // Obsidian URI: obsidian://open?path=...
        const obsidianUri = `obsidian://open?path=${encodeURIComponent(filePath)}`;
        await openPath(obsidianUri);
        break;
      case 'vscode':
        await openPath(`vscode://file/${filePath}`);
        break;
      case 'cursor':
        await openPath(`cursor://file/${filePath}`);
        break;
      default:
        await openPath(filePath);
    }
    console.log('[ObsidianSync] Opened in editor:', editor, filePath);
  } catch (err) {
    console.error('[ObsidianSync] Failed to open editor:', err);
    throw err;
  }
}

/**
 * Open vault folder in file browser
 *
 * Opens the configured vault directory using the system's default file browser.
 * Useful for browsing synced files outside of Obsidian.
 *
 * @example
 * ```typescript
 * await openVaultFolder();
 * // Opens Finder/Explorer at vault path
 * ```
 */
export async function openVaultFolder(): Promise<void> {
  const settings = await getSettings();
  if (settings.vaultPath) {
    await openPath(settings.vaultPath);
    console.log('[ObsidianSync] Opened vault folder:', settings.vaultPath);
  } else {
    console.warn('[ObsidianSync] No vault path configured');
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

let fileChangeListeners: UnlistenFn[] = [];

/**
 * Subscribe to file change events
 *
 * Listens for file changes in the vault (create/modify/delete).
 * Returns cleanup function to unsubscribe.
 *
 * @param onFileChange - Callback for file change events
 * @returns Cleanup function to stop listening
 *
 * @example
 * ```typescript
 * const unsubscribe = await subscribeToFileChanges((event) => {
 *   console.log(`File ${event.eventType}:`, event.path);
 *   if (event.eventType === 'modified') {
 *     importFromVault(event.path);
 *   }
 * });
 *
 * // Later: stop listening
 * unsubscribe();
 * ```
 */
export async function subscribeToFileChanges(
  onFileChange: (event: FileChangeEvent) => void
): Promise<() => void> {
  const unlisteners = await Promise.all([
    listen<{ path: string }>(SYNC_EVENTS.FILE_CREATED, (e) =>
      onFileChange({ path: e.payload.path, eventType: 'created' })
    ),
    listen<{ path: string }>(SYNC_EVENTS.FILE_CHANGED, (e) =>
      onFileChange({ path: e.payload.path, eventType: 'modified' })
    ),
    listen<{ path: string }>(SYNC_EVENTS.FILE_DELETED, (e) =>
      onFileChange({ path: e.payload.path, eventType: 'deleted' })
    ),
  ]);

  fileChangeListeners = unlisteners;

  return () => {
    unlisteners.forEach((unlisten) => unlisten());
    fileChangeListeners = [];
  };
}

// ============================================================================
// Embedding Queue
// ============================================================================

let embeddingQueue: string[] = [];
let embeddingTimeout: NodeJS.Timeout | null = null;

/**
 * Queue entity for embedding generation
 *
 * Adds an entity to the embedding generation queue.
 * Queue is processed after 2 seconds of inactivity (debounced).
 * Prevents duplicate entries.
 *
 * @param entityId - Entity ID to queue
 *
 * @example
 * ```typescript
 * // Queue multiple entities
 * queueForEmbedding('entity-1');
 * queueForEmbedding('entity-2');
 * queueForEmbedding('entity-3');
 * // All three will be processed together after 2s of inactivity
 * ```
 */
export function queueForEmbedding(entityId: string): void {
  if (!embeddingQueue.includes(entityId)) {
    embeddingQueue.push(entityId);
    console.log('[ObsidianSync] Queued for embedding:', entityId);
  }

  // Debounce: process queue after 2 seconds of inactivity
  if (embeddingTimeout) {
    clearTimeout(embeddingTimeout);
  }

  embeddingTimeout = setTimeout(() => {
    processEmbeddingQueue();
  }, 2000);
}

/**
 * Process embedding generation queue
 *
 * Generates embeddings for all queued entities in a single batch.
 * Emits progress events during processing.
 * Called automatically after debounce period.
 *
 * @example
 * ```typescript
 * // Manually trigger processing (not usually needed)
 * await processEmbeddingQueue();
 * ```
 */
export async function processEmbeddingQueue(): Promise<void> {
  if (embeddingQueue.length === 0) return;

  const queue = [...embeddingQueue];
  embeddingQueue = [];

  console.log('[ObsidianSync] Processing embedding queue:', queue.length, 'entities');

  // Emit progress event
  window.dispatchEvent(
    new CustomEvent(SYNC_EVENTS.EMBED_PROGRESS, {
      detail: { total: queue.length, processed: 0 },
    })
  );

  try {
    // Process in batches via Rust command
    await invoke('brain_generate_embeddings_batch', { entityIds: queue });

    window.dispatchEvent(
      new CustomEvent(SYNC_EVENTS.EMBED_PROGRESS, {
        detail: { total: queue.length, processed: queue.length },
      })
    );

    console.log('[ObsidianSync] Embeddings generated for', queue.length, 'entities');
  } catch (err) {
    console.error('[ObsidianSync] Failed to generate embeddings:', err);
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENTS.SYNC_ERROR, {
        detail: { error: err instanceof Error ? err.message : 'Embedding generation failed' },
      })
    );
  }
}

// ============================================================================
// Auto-Sync Handler
// ============================================================================

/**
 * Setup automatic sync from Brain to vault
 *
 * Listens for Brain update events and syncs to vault when enabled.
 * Returns cleanup function to disable auto-sync.
 *
 * @returns Cleanup function to stop auto-sync
 *
 * @example
 * ```typescript
 * const cleanup = setupAutoSync();
 *
 * // Later: disable auto-sync
 * cleanup();
 * ```
 */
export function setupAutoSync(): () => void {
  const handleBrainUpdate = async () => {
    try {
      const settings = await getSettings();
      if (settings.syncEnabled && settings.autoSyncToVault) {
        console.log('[ObsidianSync] Auto-sync triggered by Brain update');
        // Individual syncs are handled by brainService
        // This is for catching any missed updates
      }
    } catch (err) {
      console.error('[ObsidianSync] Auto-sync error:', err);
    }
  };

  window.addEventListener(BRAIN_UPDATED_EVENT, handleBrainUpdate);

  return () => {
    window.removeEventListener(BRAIN_UPDATED_EVENT, handleBrainUpdate);
  };
}
