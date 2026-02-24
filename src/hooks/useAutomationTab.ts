import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseAutomationTabReturn {
  openAutomationTab: () => Tab;
  isAutomationTab: (tab: Tab) => boolean;
}

/**
 * Hook to manage Automation tab
 * Follows same pattern as useKanbanTab (singleton)
 */
export function useAutomationTab(): UseAutomationTabReturn {
  const openAutomationTab = useCallback((): Tab => {
    return {
      id: 'automation-board',
      label: 'Automation',
      type: 'automation',
      closable: true,
    };
  }, []);

  const isAutomationTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'automation';
  }, []);

  return {
    openAutomationTab,
    isAutomationTab,
  };
}
