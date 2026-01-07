import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseSemanticSearchTabReturn {
  openSemanticSearchTab: (projectPath?: string) => Tab;
  isSemanticSearchTab: (tab: Tab) => boolean;
}

/**
 * Hook to manage semantic search tabs
 * Keeps App.tsx clean by encapsulating semantic search tab logic
 */
export function useSemanticSearchTab(): UseSemanticSearchTabReturn {
  const openSemanticSearchTab = useCallback((projectPath?: string): Tab => {
    return {
      id: `semantic-search-${Date.now()}`,
      label: 'Code Search',
      type: 'semantic-search',
      closable: true,
      docsPath: projectPath, // Reuse docsPath to store projectPath
    };
  }, []);

  const isSemanticSearchTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'semantic-search';
  }, []);

  return {
    openSemanticSearchTab,
    isSemanticSearchTab,
  };
}
