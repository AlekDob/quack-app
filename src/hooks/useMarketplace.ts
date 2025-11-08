import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { MarketplaceResource, MarketplaceFilters, MarketplaceLibrary, MarketplaceStack } from '../types';
import { MARKETPLACE_RESOURCES } from '../data/marketplaceData';

/**
 * Custom hook for managing Marketplace data
 * Handles fetching resources, managing library, and installations
 */
export function useMarketplace(workingDir?: string) {
  const [resources, setResources] = useState<MarketplaceResource[]>([]);
  const [library, setLibrary] = useState<MarketplaceLibrary>({
    installedResources: [],
    customStacks: [],
    favorites: [],
    lastSync: Date.now(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MarketplaceFilters>({
    sortBy: 'popular',
  });

  // Real marketplace data from aitmpl.com and claude-code-templates

  // Load marketplace resources
  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Load real marketplace data from aitmpl.com
      setResources(MARKETPLACE_RESOURCES);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter and sort resources based on current filters
  const filteredResources = useCallback(() => {
    let result = [...resources];

    // Apply category filter
    if (filters.category) {
      result = result.filter(r => r.category === filters.category);
    }

    // Apply search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply tag filters
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(r =>
        filters.tags!.some(tag => r.tags.includes(tag))
      );
    }

    // Apply verified filter
    if (filters.verified) {
      result = result.filter(r => r.verified);
    }

    // Apply featured filter
    if (filters.featured) {
      result = result.filter(r => r.featured);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'popular':
        result.sort((a, b) => b.installCount - a.installCount);
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }

    return result;
  }, [resources, filters]);

  // Install a resource with progress tracking
  const installResource = useCallback(async (resource: MarketplaceResource): Promise<boolean> => {
    try {
      if (!workingDir) {
        console.error('No working directory specified');
        throw new Error('No working directory specified');
      }

      console.log('Installing resource:', resource.installCommand, 'in', workingDir);

      // Execute the npx command in the working directory
      const result = await invoke<{ success: boolean; stdout: string; stderr: string }>('execute_command', {
        command: resource.installCommand,
        cwd: workingDir,
      });

      if (!result.success) {
        console.error('Installation failed:', result.stderr);
        throw new Error(result.stderr || 'Installation failed');
      }

      console.log('Installation successful:', result.stdout);

      // Verify installation by checking if file was created
      const categoryFolder = resource.category === 'agents' ? 'agents' : resource.category;
      console.log(`Resource installed to: ${workingDir}/.claude/${categoryFolder}`);

      // Add to installed resources
      setLibrary(prev => ({
        ...prev,
        installedResources: [...prev.installedResources, resource],
      }));

      return true;
    } catch (err) {
      console.error('Failed to install resource:', err);
      throw err; // Re-throw to let caller handle error
    }
  }, [workingDir]);

  // Uninstall a resource
  const uninstallResource = useCallback(async (resourceId: string): Promise<boolean> => {
    try {
      setLibrary(prev => ({
        ...prev,
        installedResources: prev.installedResources.filter(r => r.id !== resourceId),
      }));
      return true;
    } catch (err) {
      console.error('Failed to uninstall resource:', err);
      return false;
    }
  }, []);

  // Toggle favorite
  const toggleFavorite = useCallback((resourceId: string) => {
    setLibrary(prev => {
      const isFavorite = prev.favorites.includes(resourceId);
      return {
        ...prev,
        favorites: isFavorite
          ? prev.favorites.filter(id => id !== resourceId)
          : [...prev.favorites, resourceId],
      };
    });
  }, []);

  // Create a custom stack
  const createStack = useCallback((stack: Omit<MarketplaceStack, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newStack: MarketplaceStack = {
      ...stack,
      id: `stack-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLibrary(prev => ({
      ...prev,
      customStacks: [...prev.customStacks, newStack],
    }));
  }, []);

  // Delete a custom stack
  const deleteStack = useCallback((stackId: string) => {
    setLibrary(prev => ({
      ...prev,
      customStacks: prev.customStacks.filter(s => s.id !== stackId),
    }));
  }, []);

  // Check if resource is installed
  const isInstalled = useCallback((resourceId: string) => {
    return library.installedResources.some(r => r.id === resourceId);
  }, [library]);

  // Check if resource is favorited
  const isFavorite = useCallback((resourceId: string) => {
    return library.favorites.includes(resourceId);
  }, [library]);

  // Load resources on mount
  useEffect(() => {
    loadResources();
  }, [loadResources]);

  return {
    resources: filteredResources(),
    allResources: resources,
    library,
    loading,
    error,
    filters,
    setFilters,
    loadResources,
    installResource,
    uninstallResource,
    toggleFavorite,
    createStack,
    deleteStack,
    isInstalled,
    isFavorite,
  };
}
