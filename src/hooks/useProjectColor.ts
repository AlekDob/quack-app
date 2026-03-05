/**
 * useProjectColor Hook
 *
 * Returns the color for a project based on its path.
 * Loads colors from storage and provides a fallback color based on index.
 */

import { useState, useEffect } from 'react';
import { loadProjectColors, getProjectColor, DEFAULT_PROJECT_COLORS } from '../utils/projectColors';

// Cache for project colors (singleton across all instances)
let cachedColors: Record<string, string> | null = null;
let isLoading = false;
let loadPromise: Promise<Record<string, string>> | null = null;

/**
 * Convert project path to repo key (matches TerminalSidebar storage format)
 * Storage uses "repo-{name}" format, so we must match it
 */
function pathToRepoKey(projectPath: string): string {
  const segments = projectPath.split('/').filter(Boolean);
  const name = segments[segments.length - 1] || projectPath;
  return `repo-${name}`;
}

/**
 * Hook to get project color
 * @param projectPath - The project path (e.g., "/Users/alekdob/Desktop/Dev/Personal/quack-app")
 * @param projectIndex - Optional index for fallback color assignment (default: 0)
 */
export function useProjectColor(projectPath: string, projectIndex: number = 0): string {
  const [colors, setColors] = useState<Record<string, string>>(cachedColors || {});

  useEffect(() => {
    // If colors are already cached, use them
    if (cachedColors) {
      setColors(cachedColors);
      return;
    }

    // If already loading, wait for the promise
    if (isLoading && loadPromise) {
      loadPromise.then((loadedColors) => {
        setColors(loadedColors);
      });
      return;
    }

    // Start loading
    isLoading = true;
    loadPromise = loadProjectColors().then((loadedColors) => {
      cachedColors = loadedColors;
      isLoading = false;
      return loadedColors;
    });

    loadPromise.then((loadedColors) => {
      setColors(loadedColors);
    });
  }, []);

  const repoKey = pathToRepoKey(projectPath);
  return getProjectColor(repoKey, colors, projectIndex);
}

/**
 * Invalidate the color cache (call this when colors are changed)
 */
function invalidateProjectColorCache(): void {
  cachedColors = null;
  isLoading = false;
  loadPromise = null;
}

/**
 * Get project color synchronously (use cached value or fallback)
 * Useful for immediate rendering without hook
 */
function getProjectColorSync(projectPath: string, projectIndex: number = 0): string {
  const repoKey = pathToRepoKey(projectPath);
  return getProjectColor(repoKey, cachedColors || {}, projectIndex);
}
