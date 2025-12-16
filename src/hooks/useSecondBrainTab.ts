import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseSecondBrainTabReturn {
  openSecondBrainTab: () => Tab;
  isSecondBrainTab: (tab: Tab) => boolean;
}

/**
 * Hook for managing Second Brain tab operations
 * Creates a Tana-like outliner view integrated with MCP Memory
 */
export function useSecondBrainTab(): UseSecondBrainTabReturn {
  const openSecondBrainTab = useCallback((): Tab => {
    return {
      id: `second-brain-${Date.now()}`,
      label: 'Second Brain',
      type: 'second-brain',
      closable: true,
    };
  }, []);

  const isSecondBrainTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'second-brain';
  }, []);

  return { openSecondBrainTab, isSecondBrainTab };
}
