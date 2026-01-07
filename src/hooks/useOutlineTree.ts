import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  loadMCPMemoryFromFile,
  filterEntitiesByScope,
  type MemoryScope,
} from '../services/mcpMemoryService';
import {
  buildOutlineTree,
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

interface UseOutlineTreeReturn {
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
  filterByScope: (scope: ScopeViewFilter, projectName?: string) => OutlineNode[];
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Last successful sync timestamp */
  lastSyncTime: number | null;
  /** Current sync status */
  syncStatus: SyncStatus;
}

/**
 * Hook for managing the outline tree state
 * Loads MCP Memory data and converts it to a tree structure
 */
export function useOutlineTree(): UseOutlineTreeReturn {
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
      const graph = await loadMCPMemoryFromFile();

      if (graph) {
        const newTree = buildOutlineTree(graph);
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
      setError(err instanceof Error ? err.message : 'Failed to load outline tree');
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

  // Listen for MCP Memory updates
  useEffect(() => {
    const handleMemoryUpdate = () => {
      loadTree();
    };

    window.addEventListener('MCP_MEMORY_UPDATED', handleMemoryUpdate);
    return () => {
      window.removeEventListener('MCP_MEMORY_UPDATED', handleMemoryUpdate);
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
    projectName?: string
  ): OutlineNode[] => {
    if (!tree) return [];
    if (scope === 'all') return tree.roots;

    // Get filtered entities from MCP service
    const filteredEntities = filterEntitiesByScope(
      scope === 'global' ? 'global' : 'project',
      projectName
    );

    // Create a set of entity names that pass the filter
    const filteredNames = new Set(filteredEntities.map(e => e.name));

    // Filter roots to only include those in the filtered set
    return tree.roots.filter(root => filteredNames.has(root.id));
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
