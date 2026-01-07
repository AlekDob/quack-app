/**
 * Brain Sync - Type Definitions
 *
 * TypeScript types for Obsidian-Brain bidirectional synchronization.
 * Handles markdown export/import and vault watching.
 *
 * @module types/brainSync
 */

/**
 * Brain sync settings
 *
 * Configuration for Obsidian-Brain synchronization.
 * Stored in app settings and persisted to disk.
 */
export interface BrainSettings {
  /** Absolute path to Obsidian vault */
  vaultPath: string;

  /** Enable/disable sync system */
  syncEnabled: boolean;

  /** How to organize markdown files */
  syncStructure: 'subfolder' | 'flat';

  /** Auto-sync from Brain to vault on entity updates */
  autoSyncToVault: boolean;

  /** Auto-sync from vault to Brain on file changes */
  autoSyncFromVault: boolean;

  /** How to handle conflicts between Brain and vault */
  conflictPolicy: 'ask' | 'brain_wins' | 'obsidian_wins';

  /** Generate embeddings automatically on sync */
  autoEmbed: boolean;

  /** Preferred markdown editor for opening files */
  markdownEditor: 'obsidian' | 'vscode' | 'cursor' | 'default';
}

/**
 * Sync operation result
 *
 * Statistics from a sync operation (export or import).
 */
export interface SyncResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Number of entities synced */
  entitiesSynced: number;

  /** Conflicts detected during sync */
  conflicts: SyncConflict[];

  /** Error messages */
  errors: string[];
}

/**
 * Sync conflict
 *
 * Represents a conflict between Brain and vault versions.
 * User must decide which version to keep.
 */
export interface SyncConflict {
  /** Entity ID in Brain */
  entityId: string;

  /** Entity name */
  entityName: string;

  /** Content in Brain */
  brainContent: string;

  /** Content in vault */
  vaultContent: string;

  /** Brain update timestamp (Unix ms) */
  brainUpdatedAt: number;

  /** Vault file update timestamp (Unix ms) */
  vaultUpdatedAt: number;
}

/**
 * File change event from vault watcher
 *
 * Emitted when a file in the vault is created/modified/deleted.
 */
export interface FileChangeEvent {
  /** Absolute path to changed file */
  path: string;

  /** Type of change */
  eventType: 'created' | 'modified' | 'deleted';
}

/**
 * Parsed markdown entity
 *
 * Result of parsing a markdown file from the vault.
 * Contains entity data extracted from YAML frontmatter and content.
 */
export interface ParsedMarkdown {
  /** Entity ID (from frontmatter, null if new) */
  id: string | null;

  /** Entity name */
  name: string;

  /** Entity type */
  entityType: string;

  /** Project ID (from frontmatter or relations) */
  projectId: string | null;

  /** Observations parsed from content */
  observations: string[];

  /** Hash of content for change detection */
  syncHash: string;

  /** Tags extracted from content */
  tags: string[];
}

/**
 * Sync status
 *
 * Current state of the sync system.
 * Used to display status in settings UI.
 */
export interface SyncStatus {
  /** Last sync timestamp (Unix ms, null if never synced) */
  lastSyncTime: number | null;

  /** Total number of entities in Brain */
  entityCount: number;

  /** Number of unresolved conflicts */
  conflictCount: number;

  /** Whether embeddings are currently being generated */
  isGeneratingEmbeddings: boolean;

  /** Embedding generation progress (0-100) */
  embeddingProgress: number;
}
