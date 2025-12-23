/**
 * useClaudeAssetsTab Hook
 * Manages the Claude Assets Manager tab creation and navigation
 *
 * NOTE: This hook receives tabs state from App.tsx (not UIContext)
 * because App.tsx manages its own tab state independently.
 */

import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseClaudeAssetsTabParams {
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
}

interface UseClaudeAssetsTabReturn {
  openClaudeAssetsTab: () => void;
  isClaudeAssetsTabOpen: boolean;
}

export function useClaudeAssetsTab({
  tabs,
  setTabs,
  setActiveTabId,
}: UseClaudeAssetsTabParams): UseClaudeAssetsTabReturn {
  // Check if Claude Assets tab is already open
  const existingTab = tabs.find(t => t.type === 'claude-assets');
  const isClaudeAssetsTabOpen = !!existingTab;

  // Open or focus the Claude Assets tab
  const openClaudeAssetsTab = useCallback(() => {
    // If tab already exists, just focus it
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    // Create new tab
    const newTab: Tab = {
      id: `claude-assets-${Date.now()}`,
      label: 'Claude Assets',
      type: 'claude-assets',
      closable: true,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [existingTab, setTabs, setActiveTabId]);

  return {
    openClaudeAssetsTab,
    isClaudeAssetsTabOpen,
  };
}

export default useClaudeAssetsTab;
