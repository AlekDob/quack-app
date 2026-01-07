import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

export interface UseProjectDashboardTabReturn {
  openProjectDashboardTab: (projectPath: string, projectName: string) => Tab;
  isProjectDashboardTab: (tab: Tab) => boolean;
}

/**
 * Hook to manage project dashboard tabs
 * Creates tabs for viewing project overview with git status, tasks, and agents
 */
export function useProjectDashboardTab(): UseProjectDashboardTabReturn {
  const openProjectDashboardTab = useCallback((projectPath: string, projectName: string): Tab => {
    const tabId = `project-dashboard-${projectPath.replace(/\//g, '-')}`;
    return {
      id: tabId,
      label: projectName,
      type: 'project-dashboard' as const,
      closable: true,
      filePath: projectPath,
    };
  }, []);

  const isProjectDashboardTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'project-dashboard';
  }, []);

  return { openProjectDashboardTab, isProjectDashboardTab };
}
