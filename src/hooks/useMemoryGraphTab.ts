import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseMemoryGraphTabReturn {
  openMemoryGraphTab: () => Tab;
  isMemoryGraphTab: (tab: Tab) => boolean;
}

/**
 * Hook to manage Knowledge Graph tabs
 * Follows same pattern as useDocsTab
 */
export function useMemoryGraphTab(): UseMemoryGraphTabReturn {
  const openMemoryGraphTab = useCallback((): Tab => {
    return {
      id: `memory-graph-${Date.now()}`,
      label: 'Knowledge Graph',
      type: 'memory-graph',
      closable: true,
    };
  }, []);

  const isMemoryGraphTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'memory-graph';
  }, []);

  return {
    openMemoryGraphTab,
    isMemoryGraphTab,
  };
}
