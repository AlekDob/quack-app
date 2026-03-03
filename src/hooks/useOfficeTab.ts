import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseOfficeTabReturn {
  openOfficeTab: () => Tab;
  isOfficeTab: (tab: Tab) => boolean;
}

/**
 * Hook to manage Office tab
 * Follows same pattern as useAutomationTab (singleton)
 */
export function useOfficeTab(): UseOfficeTabReturn {
  const openOfficeTab = useCallback((): Tab => {
    return {
      id: 'office-view',
      label: 'Office',
      type: 'office',
      closable: true,
    };
  }, []);

  const isOfficeTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'office';
  }, []);

  return {
    openOfficeTab,
    isOfficeTab,
  };
}
