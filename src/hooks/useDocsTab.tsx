import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseDocsTabReturn {
  openDocsTab: (path?: string) => Tab;
  isDocsTab: (tab: Tab) => boolean;
}

/**
 * Hook to manage documentation tabs
 * Keeps App.tsx clean by encapsulating docs tab logic
 */
export function useDocsTab(): UseDocsTabReturn {
  const openDocsTab = useCallback((path: string = 'guide/01-getting-started/introduction'): Tab => {
    return {
      id: `docs-${Date.now()}`,
      label: 'Guide',
      type: 'docs',
      closable: true,
      docsPath: path,
    };
  }, []);

  const isDocsTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'docs';
  }, []);

  return {
    openDocsTab,
    isDocsTab,
  };
}
