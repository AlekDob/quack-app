import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseFeatureMapTabReturn {
  openFeatureMapTab: (projectPath?: string) => Tab;
  isFeatureMapTab: (tab: Tab) => boolean;
}

/**
 * Hook to manage Feature Map tab
 * Follows same singleton pattern as useKanbanTab
 */
export function useFeatureMapTab(): UseFeatureMapTabReturn {
  const openFeatureMapTab = useCallback((projectPath?: string): Tab => {
    return {
      id: 'feature-map',
      label: 'Feature Map',
      type: 'feature-map',
      closable: true,
      initialProjectPath: projectPath,
    };
  }, []);

  const isFeatureMapTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'feature-map';
  }, []);

  return {
    openFeatureMapTab,
    isFeatureMapTab,
  };
}
