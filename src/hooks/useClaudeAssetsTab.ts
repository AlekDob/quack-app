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
  openClaudeAssetsTab: () => void;
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

  // Open or focus the Claude Assets tab
  const openClaudeAssetsTab = useCallback(() => {
    // If tab already exists, just focus it
    if (existingTabId) {
      setActiveTabId(existingTabId);
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
  }, [existingTabId, setTabs, setActiveTabId]);

  return {
    openClaudeAssetsTab,
    isClaudeAssetsTabOpen,
  };
}

export default useClaudeAssetsTab;
