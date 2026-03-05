// Brain: code-intel-mcp-server
// File system walker for code intelligence

import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'target',
  '.next', '.nuxt', '__pycache__', '.venv', 'coverage',
  '.turbo', '.cache', '.worktrees',
]);

const MAX_FILE_SIZE = 1_000_000; // 1MB

/**
 * Walk a directory tree and return absolute paths of matching files.
 * @param {string} rootPath - Root directory to walk
 * @param {string[]} extensions - File extensions to include (e.g. ['.ts', '.tsx'])
 * @returns {string[]} Array of absolute file paths
 */
export function walkFiles(rootPath, extensions) {
  const extensionSet = new Set(extensions);
  const results = [];
  walkRecursive(rootPath, extensionSet, results);
  return results;
}

/**
 * Recursive directory walker with error handling per directory.
 */
function walkRecursive(dirPath, extensionSet, results) {
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    // Permission error or inaccessible directory — skip silently
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        walkRecursive(fullPath, extensionSet, results);
      }
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name);
    if (!extensionSet.has(ext)) continue;

    try {
      const stat = statSync(fullPath);
      if (stat.size <= MAX_FILE_SIZE) {
        results.push(fullPath);
      }
    } catch {
      // Skip files we can't stat
    }
  }
}
