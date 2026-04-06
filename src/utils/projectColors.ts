/**
 * Project Colors Utility
 * Handles loading and saving project colors from storage
 */

import { Store } from '@tauri-apps/plugin-store';

// Storage format for project order and colors
export interface ProjectStorageData {
  order: string[];
  colors: Record<string, string>;
}

// Default color palette for auto-assignment
export const DEFAULT_PROJECT_COLORS = [
  '#FF6B35', // Orange (Quack primary) — fallback hex; accent uses var(--accent-color) at runtime
  '#4DA6FF', // Blue
  '#9B59B6', // Purple
  '#2ECC71', // Green
  '#E74C3C', // Red
  '#F39C12', // Yellow
  '#1ABC9C', // Teal
  '#E84393', // Pink
];

/**
 * Load project colors from storage
 */
export async function loadProjectColors(): Promise<Record<string, string>> {
  try {
    const store = await Store.load('.quack-repo-order.dat');
    const savedData = await store.get<ProjectStorageData | string[]>('repository-order');

    if (savedData && !Array.isArray(savedData)) {
      return savedData.colors || {};
    }

    return {};
  } catch (error) {
    console.warn('Failed to load project colors:', error);
    return {};
  }
}

/**
 * Get project color, with fallback to auto-assignment
 */
export function getProjectColor(
  repoKey: string,
  colors: Record<string, string>,
  index: number
): string {
  return colors[repoKey] || DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];
}
