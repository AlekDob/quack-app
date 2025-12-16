import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadMCPMemoryFromFile } from '../services/mcpMemoryService';
import {
  buildOutlineTree,
  flattenTree,
  getSupertagCounts,
  searchNodes,
  filterBySupertag,
  type OutlineTree,
  type OutlineNode,
} from '../services/outlineTreeBuilder';

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
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
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

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    setError(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outline tree');
      setTree(null);
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
    expandedNodes,
    setExpandedNodes,
  };
}
