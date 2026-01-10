/**
 * useClaudeAssets Hook
 * Manages Claude assets (.claude/ folder) across multiple projects
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  ClaudeProject,
  ClaudeAsset,
  ClaudeAssetType,
  AssetFilters,
  AssetOperationResult,
  GroupedSearchResults,
} from '../types/claudeAssets';

interface UseClaudeAssetsReturn {
  // State
  projects: ClaudeProject[];
  selectedProject: ClaudeProject | null;
  selectedAsset: ClaudeAsset | null;
  filteredAssets: ClaudeAsset[];
  globalSearchResults: GroupedSearchResults[];  // Cross-project search results
  isGlobalSearch: boolean;  // True when search is active (searching all projects)
  filters: AssetFilters;
  loading: boolean;
  error: string | null;

  // Actions
  loadProjectAssets: (projectPath: string) => Promise<ClaudeProject | null>;
  loadMultipleProjects: (projectPaths: string[]) => Promise<void>;
  selectProject: (projectPath: string | null) => void;
  selectAsset: (asset: ClaudeAsset | null) => void;
  setFilters: (filters: Partial<AssetFilters>) => void;
  copyAsset: (asset: ClaudeAsset, targetProjectPath: string, newName?: string) => Promise<AssetOperationResult>;
  moveAsset: (asset: ClaudeAsset, targetProjectPath: string) => Promise<AssetOperationResult>;
  deleteAsset: (asset: ClaudeAsset) => Promise<AssetOperationResult>;
  readAssetContent: (asset: ClaudeAsset) => Promise<string>;
  refreshProject: (projectPath: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DEFAULT_FILTERS: AssetFilters = {
  type: 'all',
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
};

export function useClaudeAssets(initialProjectPaths?: string[]): UseClaudeAssetsReturn {
  const [projects, setProjects] = useState<ClaudeProject[]>([]);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ClaudeAsset | null>(null);
  const [filters, setFiltersState] = useState<AssetFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get selected project object
  const selectedProject = projects.find(p => p.path === selectedProjectPath) || null;

  // Load assets for a single project
  const loadProjectAssets = useCallback(async (projectPath: string): Promise<ClaudeProject | null> => {
    try {
      const project = await invoke<ClaudeProject>('list_claude_assets', {
        projectPath,
      });
      return project;
    } catch (err) {
      console.error(`Failed to load assets for ${projectPath}:`, err);
      return null;
    }
  }, []);

  // Load assets for multiple projects
  const loadMultipleProjects = useCallback(async (projectPaths: string[]): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const loadedProjects = await Promise.all(
        projectPaths.map(path => loadProjectAssets(path))
      );

      const validProjects = loadedProjects.filter((p): p is ClaudeProject => p !== null);
      setProjects(validProjects);

      // Auto-select first project if none selected
      // Use functional update to avoid stale closure and dependency cycle
      setSelectedProjectPath(prev => {
        if (!prev && validProjects.length > 0) {
          return validProjects[0].path;
        }
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [loadProjectAssets]); // Removed selectedProjectPath - using functional update instead

  // Select a project
  const selectProject = useCallback((projectPath: string | null) => {
    setSelectedProjectPath(projectPath);
    setSelectedAsset(null);
  }, []);

  // Select an asset
  const selectAsset = useCallback((asset: ClaudeAsset | null) => {
    setSelectedAsset(asset);
  }, []);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<AssetFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Copy asset to another project
  const copyAsset = useCallback(async (
    asset: ClaudeAsset,
    targetProjectPath: string,
    newName?: string
  ): Promise<AssetOperationResult> => {
    try {
      // For MCP assets, use the asset name as the MCP server name
      const effectiveName = asset.type === 'mcp' ? asset.name : newName;

      const newPath = await invoke<string>('copy_claude_asset', {
        sourcePath: asset.path,
        destProject: targetProjectPath,
        assetType: asset.type,
        newName: effectiveName,
      });

      // Refresh target project
      const updatedProject = await loadProjectAssets(targetProjectPath);
      if (updatedProject) {
        setProjects(prev =>
          prev.map(p => p.path === targetProjectPath ? updatedProject : p)
        );
      }

      return {
        success: true,
        operation: 'copy',
        sourceAsset: asset,
        targetProject: targetProjectPath,
        newPath,
      };
    } catch (err) {
      return {
        success: false,
        operation: 'copy',
        sourceAsset: asset,
        targetProject: targetProjectPath,
        error: err instanceof Error ? err.message : 'Copy failed',
      };
    }
  }, [loadProjectAssets]);

  // Move asset to another project
  const moveAsset = useCallback(async (
    asset: ClaudeAsset,
    targetProjectPath: string
  ): Promise<AssetOperationResult> => {
    try {
      const newPath = await invoke<string>('move_claude_asset', {
        sourcePath: asset.path,
        destProject: targetProjectPath,
        assetType: asset.type,
      });

      // Refresh both source and target projects
      const [sourceProject, targetProject] = await Promise.all([
        loadProjectAssets(asset.projectPath),
        loadProjectAssets(targetProjectPath),
      ]);

      setProjects(prev => prev.map(p => {
        if (p.path === asset.projectPath && sourceProject) return sourceProject;
        if (p.path === targetProjectPath && targetProject) return targetProject;
        return p;
      }));

      // Clear selection if moved asset was selected
      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(null);
      }

      return {
        success: true,
        operation: 'move',
        sourceAsset: asset,
        targetProject: targetProjectPath,
        newPath,
      };
    } catch (err) {
      return {
        success: false,
        operation: 'move',
        sourceAsset: asset,
        targetProject: targetProjectPath,
        error: err instanceof Error ? err.message : 'Move failed',
      };
    }
  }, [loadProjectAssets, selectedAsset]);

  // Delete an asset
  const deleteAsset = useCallback(async (asset: ClaudeAsset): Promise<AssetOperationResult> => {
    try {
      await invoke('delete_claude_asset', {
        assetPath: asset.path,
        isDirectory: asset.isDirectory,
      });

      // Refresh the project
      const updatedProject = await loadProjectAssets(asset.projectPath);
      if (updatedProject) {
        setProjects(prev =>
          prev.map(p => p.path === asset.projectPath ? updatedProject : p)
        );
      }

      // Clear selection if deleted asset was selected
      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(null);
      }

      return {
        success: true,
        operation: 'delete',
        sourceAsset: asset,
      };
    } catch (err) {
      return {
        success: false,
        operation: 'delete',
        sourceAsset: asset,
        error: err instanceof Error ? err.message : 'Delete failed',
      };
    }
  }, [loadProjectAssets, selectedAsset]);

  // Read asset content
  const readAssetContent = useCallback(async (asset: ClaudeAsset): Promise<string> => {
    return invoke<string>('read_claude_asset', {
      assetPath: asset.path,
    });
  }, []);

  // Refresh a single project
  const refreshProject = useCallback(async (projectPath: string): Promise<void> => {
    const updatedProject = await loadProjectAssets(projectPath);
    if (updatedProject) {
      setProjects(prev =>
        prev.map(p => p.path === projectPath ? updatedProject : p)
      );
    }
  }, [loadProjectAssets]);

  // Refresh all projects
  const refreshAll = useCallback(async (): Promise<void> => {
    const projectPaths = projects.map(p => p.path);
    await loadMultipleProjects(projectPaths);
  }, [projects, loadMultipleProjects]);

  // Check if we're in global search mode (search query is active)
  const isGlobalSearch = filters.searchQuery.trim().length > 0;

  // Helper function to get all assets from a project with type filter
  const getProjectAssets = (project: ClaudeProject): ClaudeAsset[] => {
    if (filters.type === 'all') {
      return [
        ...project.assets.droids,
        ...project.assets.commands,
        ...project.assets.rules,
        ...project.assets.skills,
        ...project.assets.mcps,
        ...project.assets.hooks,
      ];
    }
    const typeMap: Record<ClaudeAssetType, ClaudeAsset[]> = {
      droid: project.assets.droids,
      command: project.assets.commands,
      rule: project.assets.rules,
      skill: project.assets.skills,
      mcp: project.assets.mcps,
      hook: project.assets.hooks,
    };
    return typeMap[filters.type] || [];
  };

  // Helper function to filter assets by search query
  const filterByQuery = (assets: ClaudeAsset[], query: string): ClaudeAsset[] => {
    const lowerQuery = query.toLowerCase();
    return assets.filter(a =>
      a.name.toLowerCase().includes(lowerQuery) ||
      a.metadata.description?.toLowerCase().includes(lowerQuery)
    );
  };

  // Helper function to sort assets
  const sortAssets = (assets: ClaudeAsset[]): ClaudeAsset[] => {
    return [...assets].sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'modified':
          comparison = a.modifiedAt - b.modifiedAt;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  // Global search results - search across ALL projects when query is active
  const globalSearchResults: GroupedSearchResults[] = (() => {
    if (!isGlobalSearch) return [];

    const query = filters.searchQuery.trim();
    const results: GroupedSearchResults[] = [];

    for (const project of projects) {
      const allAssets = getProjectAssets(project);
      const matchingAssets = filterByQuery(allAssets, query);

      if (matchingAssets.length > 0) {
        results.push({
          projectName: project.name,
          projectPath: project.path,
          assets: sortAssets(matchingAssets),
          totalCount: matchingAssets.length,
        });
      }
    }

    // Sort projects by number of results (most first)
    results.sort((a, b) => b.totalCount - a.totalCount);

    return results;
  })();

  // Filter and sort assets based on current filters (single project mode)
  const filteredAssets = (() => {
    if (!selectedProject) return [];

    const assets = getProjectAssets(selectedProject);

    // Apply search filter (only in single project mode)
    const filtered = filters.searchQuery
      ? filterByQuery(assets, filters.searchQuery)
      : assets;

    return sortAssets(filtered);
  })();

  // Load initial projects on mount
  useEffect(() => {
    if (initialProjectPaths && initialProjectPaths.length > 0) {
      loadMultipleProjects(initialProjectPaths);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    projects,
    selectedProject,
    selectedAsset,
    filteredAssets,
    globalSearchResults,
    isGlobalSearch,
    filters,
    loading,
    error,

    // Actions
    loadProjectAssets,
    loadMultipleProjects,
    selectProject,
    selectAsset,
    setFilters,
    copyAsset,
    moveAsset,
    deleteAsset,
    readAssetContent,
    refreshProject,
    refreshAll,
  };
}

export default useClaudeAssets;
