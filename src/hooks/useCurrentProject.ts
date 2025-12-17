/**
 * useCurrentProject Hook
 *
 * Detects the current project from the active terminal's working directory.
 * Used for project-scoped memories in Second Brain.
 *
 * @module hooks/useCurrentProject
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Project information returned by detect_project_root
 */
export interface ProjectInfo {
  /** Absolute path to project root */
  root_path: string;
  /** Project name (directory name) */
  name: string;
  /** Detected markers (e.g., ".git", "package.json", "CLAUDE.md") */
  markers: string[];
}

/**
 * Memory scope options
 */
export type MemoryScope = 'global' | 'project';

/**
 * Hook state
 */
interface UseCurrentProjectState {
  /** Detected project info (null if no project detected) */
  project: ProjectInfo | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Hook return type
 */
interface UseCurrentProjectReturn extends UseCurrentProjectState {
  /** Refresh project detection */
  refresh: (path?: string) => Promise<void>;
  /** Check if a project is detected */
  hasProject: boolean;
  /** Project name or "Global" */
  displayName: string;
  /** Generate entity name for project scope */
  getProjectEntityName: () => string | null;
}

/**
 * Event for current project changes
 */
export const PROJECT_CHANGED_EVENT = 'quack-project-changed';

/**
 * Dispatch project change event
 */
export const dispatchProjectChange = (project: ProjectInfo | null): void => {
  window.dispatchEvent(new CustomEvent(PROJECT_CHANGED_EVENT, { detail: project }));
};

/**
 * Current project detection hook
 *
 * Detects the project from a given path by looking for project markers
 * (.git, package.json, CLAUDE.md, etc.)
 */
export function useCurrentProject(initialPath?: string): UseCurrentProjectReturn {
  const [state, setState] = useState<UseCurrentProjectState>({
    project: null,
    isLoading: false,
    error: null,
  });

  /**
   * Detect project from path
   * If no path is provided, uses the app's current working directory (Rust side)
   */
  const refresh = useCallback(async (path?: string) => {
    // Use provided path, initial path, or empty string (Rust will use cwd)
    const targetPath = path || initialPath || '';

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      const result = await invoke<ProjectInfo | null>('detect_project_root', {
        startingPath: targetPath,
      });

      setState({
        project: result,
        isLoading: false,
        error: null,
      });

      // Dispatch event for other components
      dispatchProjectChange(result);

      console.log('[useCurrentProject] Detected:', result);
    } catch (error) {
      console.error('[useCurrentProject] Detection failed:', error);
      setState({
        project: null,
        isLoading: false,
        error: String(error),
      });
    }
  }, [initialPath]);

  /**
   * Check if project is detected
   */
  const hasProject = state.project !== null;

  /**
   * Display name (project name or "Global")
   */
  const displayName = state.project?.name || 'Global';

  /**
   * Generate entity name for project scope
   * Used when creating project entities in MCP memory
   */
  const getProjectEntityName = useCallback((): string | null => {
    if (!state.project) return null;
    // Normalize project name for entity: lowercase, replace spaces with underscores
    return state.project.name.toLowerCase().replace(/\s+/g, '_');
  }, [state.project]);

  // Initial detection - always run on mount
  // Rust will use current_dir() if no path provided
  useEffect(() => {
    refresh(initialPath);
  }, [initialPath, refresh]);

  return {
    ...state,
    refresh,
    hasProject,
    displayName,
    getProjectEntityName,
  };
}

export default useCurrentProject;
