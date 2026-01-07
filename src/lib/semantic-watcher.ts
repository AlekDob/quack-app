/**
 * Semantic Search File Watcher Client
 *
 * TypeScript interface for the Rust semantic file watcher.
 * Monitors project directories and triggers reindexing on file changes.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * File operation types
 */
export type FileOperation = 'create' | 'modify' | 'delete';

/**
 * Semantic file change event payload
 */
export interface SemanticFileEvent {
  filePath: string;
  operation: FileOperation;
  projectPath: string;
}

/**
 * Watcher configuration
 */
export interface WatcherConfig {
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number;
  /** Glob patterns to include (e.g., ["**\/*.ts", "**\/*.rs"]) */
  includePatterns?: string[];
  /** Directories to exclude (default: [".git", "node_modules", "dist", "build", "target"]) */
  excludeDirs?: string[];
}

/**
 * Start watching a project directory for file changes
 */
export async function startSemanticWatcher(
  projectPath: string,
  config?: WatcherConfig
): Promise<void> {
  return invoke('start_semantic_watcher', {
    projectPath,
    config,
  });
}

/**
 * Stop watching a project directory
 */
export async function stopSemanticWatcher(projectPath: string): Promise<void> {
  return invoke('stop_semantic_watcher', { projectPath });
}

/**
 * Check if a project is being watched
 */
export async function isSemanticWatcherActive(projectPath: string): Promise<boolean> {
  return invoke('is_semantic_watcher_active', { projectPath });
}

/**
 * Get list of all watched projects
 */
export async function getWatchedSemanticProjects(): Promise<string[]> {
  return invoke('get_watched_semantic_projects');
}

/**
 * Stop all semantic watchers
 */
export async function stopAllSemanticWatchers(): Promise<void> {
  return invoke('stop_all_semantic_watchers');
}

/**
 * Listen for semantic file change events
 *
 * @param callback Function to call when files change
 * @returns Unlisten function to stop listening
 *
 * @example
 * ```ts
 * const unlisten = await onSemanticFileChange((event) => {
 *   console.log(`File ${event.operation}: ${event.filePath}`);
 *   // Trigger reindexing here
 * });
 *
 * // Later, to stop listening:
 * unlisten();
 * ```
 */
export async function onSemanticFileChange(
  callback: (event: SemanticFileEvent) => void
): Promise<UnlistenFn> {
  return listen<SemanticFileEvent>('semantic:file-changed', (event) => {
    callback(event.payload);
  });
}

/**
 * Start watching with common presets for different project types
 */
export const WatcherPresets = {
  /** TypeScript/JavaScript projects */
  typescript: {
    includePatterns: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs',
    ],
    excludeDirs: ['.git', 'node_modules', 'dist', 'build', '.next', '.vite'],
  } as WatcherConfig,

  /** Rust projects */
  rust: {
    includePatterns: ['**/*.rs', '**/Cargo.toml'],
    excludeDirs: ['.git', 'target', 'node_modules'],
  } as WatcherConfig,

  /** Python projects */
  python: {
    includePatterns: ['**/*.py', '**/requirements.txt', '**/pyproject.toml'],
    excludeDirs: ['.git', '__pycache__', '.venv', 'venv', 'node_modules'],
  } as WatcherConfig,

  /** All common code files */
  all: {
    includePatterns: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.rs',
      '**/*.py',
      '**/*.go',
      '**/*.java',
      '**/*.cpp',
      '**/*.c',
      '**/*.h',
      '**/*.md',
    ],
    excludeDirs: [
      '.git',
      'node_modules',
      'dist',
      'build',
      'target',
      '.next',
      '.vite',
      '__pycache__',
    ],
  } as WatcherConfig,
};

/**
 * Helper function to start watching with a preset configuration
 */
export async function startSemanticWatcherWithPreset(
  projectPath: string,
  preset: keyof typeof WatcherPresets
): Promise<void> {
  return startSemanticWatcher(projectPath, WatcherPresets[preset]);
}
