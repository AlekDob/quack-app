/**
 * useOutlineTreeBrain Hook
 *
 * Brain-based version of useOutlineTree that loads data from SQLite
 * instead of MCP Memory file. Drop-in replacement for the original hook.
 *
 * @module hooks/useOutlineTreeBrain
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { brainService, BRAIN_UPDATED_EVENT, refreshKnowledgeGraph } from '../services/brainService';
import { brainGraphToOutlineTree } from '../services/brainTreeBuilder';
import {
  flattenTree,
  getSupertagCounts,
  searchNodes,
  filterBySupertag,
  type OutlineTree,
  type OutlineNode,
} from '../services/outlineTreeBuilder';

/** Scope view filter type */
export type ScopeViewFilter = 'all' | 'global' | 'project';

/** Sync status for memory operations */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface UseOutlineTreeBrainReturn {
  tree: OutlineTree | null;
  roots: OutlineNode[];
  isLoading: boolean;
  error: string | null;
  supertagCounts: Map<string, number>;
  totalNodes: number;
  refresh: () => Promise<void>;
  toggleExpand: (nodeId: string) => void;
  search: (query: string) => OutlineNode[];
  filterByTag: (tag: string) => OutlineNode[];
  filterByScope: (scope: ScopeViewFilter, projectId?: string) => OutlineNode[];
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Last successful sync timestamp */
  lastSyncTime: number | null;
  /** Current sync status */
  syncStatus: SyncStatus;
}

/**
 * Hook for managing the outline tree state
 * Loads Brain data and converts it to a tree structure
 *
 * This is a drop-in replacement for useOutlineTree that uses
 * the new SQLite-based Brain backend instead of MCP Memory file.
 */
export function useOutlineTreeBrain(): UseOutlineTreeBrainReturn {
  const [tree, setTree] = useState<OutlineTree | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSyncStatus('syncing');

    try {
      // Initialize Brain if not already done
      await brainService.initialize();

      // Load full graph from Brain and update cache for autocomplete
      const graph = await refreshKnowledgeGraph();

      if (graph && graph.entities.length > 0) {
        const newTree = brainGraphToOutlineTree(graph);
        setTree(newTree);

        // Initially expand all root nodes
        const initialExpanded = new Set<string>();
        for (const root of newTree.roots) {
          initialExpanded.add(root.id);
        }
        setExpandedNodes(initialExpanded);
      } else {
        setTree({
          roots: [],
          nodeMap: new Map(),
          totalNodes: 0,
        });
      }

      // Update sync status on success
      setLastSyncTime(Date.now());
      setSyncStatus('success');

      // Reset to idle after showing success
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      console.error('[useOutlineTreeBrain] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Brain data');
      setTree(null);
      setSyncStatus('error');

      // Reset to idle after showing error
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Listen for Brain updates
  useEffect(() => {
    const handleBrainUpdate = () => {
      console.log('[useOutlineTreeBrain] Brain updated event received, refreshing...');
      loadTree();
    };

    window.addEventListener(BRAIN_UPDATED_EVENT, handleBrainUpdate);
    // Also listen for legacy MCP_MEMORY_UPDATED for compatibility
    window.addEventListener('MCP_MEMORY_UPDATED', handleBrainUpdate);

    return () => {
      window.removeEventListener(BRAIN_UPDATED_EVENT, handleBrainUpdate);
      window.removeEventListener('MCP_MEMORY_UPDATED', handleBrainUpdate);
    };
  }, [loadTree]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const search = useCallback((query: string): OutlineNode[] => {
    if (!tree || !query.trim()) return [];
    return searchNodes(tree, query);
  }, [tree]);

  const filterByTag = useCallback((tag: string): OutlineNode[] => {
    if (!tree) return [];
    return filterBySupertag(tree, tag);
  }, [tree]);

  /**
   * Filter roots by scope (global, project, or all)
   */
  const filterByScope = useCallback((
    scope: ScopeViewFilter,
    projectId?: string
  ): OutlineNode[] => {
    if (!tree) return [];
    if (scope === 'all') return tree.roots;

    const flat = flattenTree(tree);

    if (scope === 'global') {
      // Return nodes without projectName
      return flat.filter(node => !node.projectName && node.parentId === null);
    } else if (scope === 'project' && projectId) {
      // Return nodes with matching projectName or projectId
      return flat.filter(node =>
        (node.projectName === projectId || node.id === projectId) &&
        node.parentId === null
      );
    }

    return tree.roots;
  }, [tree]);

  const supertagCounts = useMemo(() => {
    if (!tree) return new Map<string, number>();
    return getSupertagCounts(tree);
  }, [tree]);

  const roots = useMemo(() => {
    return tree?.roots || [];
  }, [tree]);

  const totalNodes = useMemo(() => {
    return tree?.totalNodes || 0;
  }, [tree]);

  return {
    tree,
    roots,
    isLoading,
    error,
    supertagCounts,
    totalNodes,
    refresh: loadTree,
    toggleExpand,
    search,
    filterByTag,
    filterByScope,
    expandedNodes,
    setExpandedNodes,
    lastSyncTime,
    syncStatus,
  };
}

export default useOutlineTreeBrain;
