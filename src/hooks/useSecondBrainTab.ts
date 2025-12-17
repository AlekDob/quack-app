import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface OpenSecondBrainOptions {
  nodeId?: string;
  nodeLabel?: string;
}

interface UseSecondBrainTabReturn {
  openSecondBrainTab: (options?: OpenSecondBrainOptions) => Tab;
  isSecondBrainTab: (tab: Tab) => boolean;
}

/**
 * Hook for managing Second Brain tab operations
 * Creates a Tana-like outliner view integrated with MCP Memory
 */
export function useSecondBrainTab(): UseSecondBrainTabReturn {
  const openSecondBrainTab = useCallback((options?: OpenSecondBrainOptions): Tab => {
    const label = options?.nodeLabel
      ? `${options.nodeLabel.slice(0, 20)}${options.nodeLabel.length > 20 ? '...' : ''}`
      : 'Second Brain';

    return {
      id: `second-brain-${Date.now()}`,
      label,
      type: 'second-brain',
      closable: true,
      initialNodeId: options?.nodeId,
    };
  }, []);

  const isSecondBrainTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'second-brain';
  }, []);

  return { openSecondBrainTab, isSecondBrainTab };
}
