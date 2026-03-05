/**
 * useClaudeAssetsTab Hook
 * Manages the Claude Assets Manager tab creation and navigation
 *
 * NOTE: This hook receives tabs state from App.tsx (not UIContext)
 * because App.tsx manages its own tab state independently.
 */

import { useCallback, useMemo } from 'react';
import type { Tab } from '../components/TabBar';

interface UseClaudeAssetsTabParams {
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
}

interface UseClaudeAssetsTabReturn {
  openClaudeAssetsTab: (initialProjectPath?: string) => void;
  isClaudeAssetsTabOpen: boolean;
}

export function useClaudeAssetsTab({
  tabs,
  setTabs,
  setActiveTabId,
}: UseClaudeAssetsTabParams): UseClaudeAssetsTabReturn {
  // Memoize the existing tab ID to avoid object reference changes
  // causing infinite dependency loops in useCallback
  const existingTabId = useMemo(
    () => tabs.find(t => t.type === 'claude-assets')?.id,
    [tabs]
  );
  const isClaudeAssetsTabOpen = !!existingTabId;

  // Open or focus the Claude Assets tab, optionally with a pre-selected project
  const openClaudeAssetsTab = useCallback((initialProjectPath?: string) => {
    // If tab already exists, update its initialProjectPath and focus it
    if (existingTabId) {
      // Update the existing tab's initialProjectPath
      setTabs(prev => prev.map(tab =>
        tab.id === existingTabId
          ? { ...tab, initialProjectPath }
          : tab
      ));
      setActiveTabId(existingTabId);
      return;
    }

    // Create new tab with optional initialProjectPath
    const newTab: Tab = {
      id: `claude-assets-${Date.now()}`,
      label: 'Project Assets',
      type: 'claude-assets',
      closable: true,
      initialProjectPath,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [existingTabId, setTabs, setActiveTabId]);

  return {
    openClaudeAssetsTab,
    isClaudeAssetsTabOpen,
  };
}

