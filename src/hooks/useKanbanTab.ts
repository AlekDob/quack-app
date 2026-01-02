import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseKanbanTabReturn {
  openKanbanTab: () => Tab;
  isKanbanTab: (tab: Tab) => boolean;
}

/**
 * Hook to manage Kanban Board tab
 * Follows same pattern as useMemoryGraphTab and useSecondBrainTab
 *
 * Only one Kanban tab should exist at a time (singleton pattern)
 */
export function useKanbanTab(): UseKanbanTabReturn {
  const openKanbanTab = useCallback((): Tab => {
    return {
      id: 'kanban-board', // Fixed ID - only one kanban tab allowed
      label: 'Kanban',
      type: 'kanban',
      closable: true,
    };
  }, []);

  const isKanbanTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'kanban';
  }, []);

  return {
    openKanbanTab,
    isKanbanTab,
  };
}
