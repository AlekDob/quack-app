/**
 * useSupertagConfig Hook
 *
 * React hook for accessing and managing supertag configurations.
 * Provides caching, auto-refresh on changes, and stable function references.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  SupertagConfig,
  SupertagProperty,
} from '../services/supertagConfigService';
import {
  loadSupertagConfigs,
  getSupertagConfig as getConfigFromService,
  getSupertagColor as getColorFromService,
  saveSupertagConfig,
  deleteSupertagConfig,
  isConfigCacheInitialized,
  getAllCachedConfigs,
  DEFAULT_SUPERTAG_COLORS,
} from '../services/supertagConfigService';

export interface UseSupertagConfigReturn {
  // All loaded configs
  configs: Map<string, SupertagConfig>;

  // Loading state
  isLoading: boolean;

  // Get config for specific tag (with default fallback)
  getConfig: (tagName: string) => SupertagConfig;

  // Get color for specific tag
  getColor: (tagName: string) => string;

  // Get properties for specific tag
  getProperties: (tagName: string) => SupertagProperty[];

  // Save a config
  saveConfig: (config: SupertagConfig) => Promise<boolean>;

  // Delete a config
  deleteConfig: (tagName: string) => Promise<boolean>;

  // Refresh configs from MCP memory
  refresh: () => Promise<void>;

  // Check if a tag has custom config
  hasCustomConfig: (tagName: string) => boolean;

  // Get all available tag names (custom + defaults)
  getAllTagNames: () => string[];
}

export function useSupertagConfig(): UseSupertagConfigReturn {
  const [configs, setConfigs] = useState<Map<string, SupertagConfig>>(new Map());
  const [isLoading, setIsLoading] = useState(!isConfigCacheInitialized());

  // Load configs on mount
  useEffect(() => {
    const loadConfigs = async () => {
      if (!isConfigCacheInitialized()) {
        setIsLoading(true);
        const loadedConfigs = await loadSupertagConfigs();
        setConfigs(loadedConfigs);
        setIsLoading(false);
      } else {
        setConfigs(getAllCachedConfigs());
        setIsLoading(false);
      }
    };

    loadConfigs();
  }, []);

  // Listen for config updates
  useEffect(() => {
    const handleConfigUpdate = () => {
      setConfigs(getAllCachedConfigs());
    };

    window.addEventListener('SUPERTAG_CONFIG_UPDATED', handleConfigUpdate);
    window.addEventListener('MCP_MEMORY_UPDATED', handleConfigUpdate);

    return () => {
      window.removeEventListener('SUPERTAG_CONFIG_UPDATED', handleConfigUpdate);
      window.removeEventListener('MCP_MEMORY_UPDATED', handleConfigUpdate);
    };
  }, []);

  // Get config for a specific tag
  const getConfig = useCallback((tagName: string): SupertagConfig => {
    return getConfigFromService(tagName);
  }, []);

  // Get color for a specific tag
  const getColor = useCallback((tagName: string): string => {
    return getColorFromService(tagName);
  }, []);

  // Get properties for a specific tag
  const getProperties = useCallback((tagName: string): SupertagProperty[] => {
    const config = getConfigFromService(tagName);
    return config.properties || [];
  }, []);

  // Save config
  const saveConfig = useCallback(async (config: SupertagConfig): Promise<boolean> => {
    const success = await saveSupertagConfig(config);
    if (success) {
      setConfigs(getAllCachedConfigs());
    }
    return success;
  }, []);

  // Delete config
  const deleteConfig = useCallback(async (tagName: string): Promise<boolean> => {
    const success = await deleteSupertagConfig(tagName);
    if (success) {
      setConfigs(getAllCachedConfigs());
    }
    return success;
  }, []);

  // Refresh configs
  const refresh = useCallback(async () => {
    setIsLoading(true);
    const loadedConfigs = await loadSupertagConfigs();
    setConfigs(loadedConfigs);
    setIsLoading(false);
  }, []);

  // Check if tag has custom config
  const hasCustomConfig = useCallback((tagName: string): boolean => {
    return configs.has(tagName.toLowerCase());
  }, [configs]);

  // Get all tag names (custom + defaults)
  const getAllTagNames = useCallback((): string[] => {
    const customTags = Array.from(configs.keys());
    const defaultTags = Object.keys(DEFAULT_SUPERTAG_COLORS);
    const allTags = new Set([...customTags, ...defaultTags]);
    return Array.from(allTags).sort();
  }, [configs]);

  return useMemo(() => ({
    configs,
    isLoading,
    getConfig,
    getColor,
    getProperties,
    saveConfig,
    deleteConfig,
    refresh,
    hasCustomConfig,
    getAllTagNames,
  }), [
    configs,
    isLoading,
    getConfig,
    getColor,
    getProperties,
    saveConfig,
    deleteConfig,
    refresh,
    hasCustomConfig,
    getAllTagNames,
  ]);
}
