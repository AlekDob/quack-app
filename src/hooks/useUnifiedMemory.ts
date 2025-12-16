/**
 * useUnifiedMemory Hook
 *
 * MCP-only memory interface for the Memory Panel.
 * Uses direct Tauri commands to read/write to memory.jsonl
 *
 * @module hooks/useUnifiedMemory
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { MemoryCategory } from "../types/memory";
import {
  mcpMemoryService,
  createMCPEntity,
  deleteMCPEntity,
  generateEntityName,
  categoryToEntityType,
  type MCPKnowledgeGraph,
  type UnifiedMemoryItem,
} from "../services/mcpMemoryService";

// Re-export MCPKnowledgeGraph for use in App.tsx
export type { MCPKnowledgeGraph } from "../services/mcpMemoryService";

/**
 * Event name for MCP memory updates
 */
export const MCP_MEMORY_UPDATED_EVENT = "quack-mcp-memory-updated";

/**
 * Dispatch MCP memory update event
 */
export const dispatchMCPMemoryUpdate = (graph: MCPKnowledgeGraph): void => {
  mcpMemoryService.setKnowledgeGraph(graph);
  window.dispatchEvent(new CustomEvent(MCP_MEMORY_UPDATED_EVENT, { detail: graph }));
};

/**
 * Filter options for memory view
 */
export interface UnifiedMemoryFilters {
  category?: string;
  searchQuery?: string;
}

/**
 * Hook state
 */
interface UseUnifiedMemoryState {
  /** MCP entities (cached) */
  items: UnifiedMemoryItem[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Hook return type
 */
interface UseUnifiedMemoryReturn extends UseUnifiedMemoryState {
  /** For backward compatibility */
  unifiedItems: UnifiedMemoryItem[];
  /** Refresh memories from file */
  refresh: () => Promise<void>;
  /** Refresh MCP memories (call after AI uses mcp__memory__read_graph) */
  refreshMCP: (graph: MCPKnowledgeGraph) => void;
  /** Filter items */
  filterItems: (filters: UnifiedMemoryFilters) => UnifiedMemoryItem[];
  /** Create a memory (writes to MCP) */
  createMemory: (content: string, category: MemoryCategory) => Promise<void>;
  /** Delete a memory */
  deleteMemory: (id: string) => Promise<void>;
  /** Statistics */
  stats: {
    total: number;
    entities: number;
    relations: number;
  };
}

/**
 * MCP Memory Hook
 *
 * Single source of truth for all memories using MCP Memory.
 */
export const useUnifiedMemory = (): UseUnifiedMemoryReturn => {
  const [state, setState] = useState<UseUnifiedMemoryState>({
    items: [],
    isLoading: true,
    error: null,
  });

  /**
   * Initialize - load MCP data from file
   */
  const initialize = useCallback(async () => {
    try {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      // Initialize MCP service and load from file
      await mcpMemoryService.initialize();

      // Get MCP items
      const items = mcpMemoryService.getUnifiedItems();

      setState({
        items,
        isLoading: false,
        error: null,
      });

      console.log("[useUnifiedMemory] Initialized:", {
        items: items.length,
      });
    } catch (error) {
      console.error("[useUnifiedMemory] Initialize failed:", error);
      setState({
        items: [],
        isLoading: false,
        error: "Failed to initialize memory system",
      });
    }
  }, []);

  /**
   * Refresh memories from file
   */
  const refresh = useCallback(async () => {
    try {
      await mcpMemoryService.refreshFromFile();
      const items = mcpMemoryService.getUnifiedItems();

      setState((s) => ({
        ...s,
        items,
      }));

      console.log("[useUnifiedMemory] Refreshed:", {
        items: items.length,
      });
    } catch (error) {
      console.error("[useUnifiedMemory] Refresh failed:", error);
    }
  }, []);

  /**
   * Refresh MCP memories from graph data
   */
  const refreshMCP = useCallback((graph: MCPKnowledgeGraph) => {
    mcpMemoryService.setKnowledgeGraph(graph);
    const items = mcpMemoryService.getUnifiedItems();

    setState((s) => ({
      ...s,
      items,
    }));

    console.log("[useUnifiedMemory] MCP refreshed:", {
      entities: graph.entities.length,
      relations: graph.relations.length,
    });
  }, []);

  /**
   * Filter items by criteria
   */
  const filterItems = useCallback(
    (filters: UnifiedMemoryFilters): UnifiedMemoryItem[] => {
      let items = state.items;

      // Filter by category
      if (filters.category) {
        items = items.filter(
          (item) =>
            item.category.toLowerCase() === filters.category?.toLowerCase() ||
            item.entityType?.toLowerCase() === filters.category?.toLowerCase()
        );
      }

      // Filter by search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        items = items.filter(
          (item) =>
            item.content.toLowerCase().includes(query) ||
            item.entityName?.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        );
      }

      return items;
    },
    [state.items]
  );

  /**
   * Create a memory (writes directly to MCP memory.jsonl)
   */
  const createMemory = useCallback(
    async (content: string, category: MemoryCategory) => {
      try {
        const entityName = generateEntityName(content);
        const entityType = categoryToEntityType(category);

        const entity = await createMCPEntity({
          name: entityName,
          entityType,
          observations: [content],
        });

        if (entity) {
          toast.success("Memory created");
          // Refresh is already called inside createMCPEntity
          const items = mcpMemoryService.getUnifiedItems();
          setState((s) => ({ ...s, items }));
        }
      } catch (error) {
        console.error("[useUnifiedMemory] Create failed:", error);
        toast.error("Failed to create memory");
      }
    },
    []
  );

  /**
   * Delete a memory
   */
  const deleteMemoryFn = useCallback(async (id: string) => {
    try {
      // Extract entity name from id (format: "mcp-{entityName}")
      const entityName = id.startsWith("mcp-") ? id.slice(4) : id;

      const deleted = await deleteMCPEntity(entityName);

      if (deleted) {
        toast.success("Memory deleted");
        // Refresh is already called inside deleteMCPEntity
        const items = mcpMemoryService.getUnifiedItems();
        setState((s) => ({ ...s, items }));
      } else {
        toast.error("Memory not found");
      }
    } catch (error) {
      console.error("[useUnifiedMemory] Delete failed:", error);
      toast.error("Failed to delete memory");
    }
  }, []);

  /**
   * Calculate statistics
   */
  const stats = useMemo(() => {
    const graph = mcpMemoryService.getKnowledgeGraph();
    return {
      total: state.items.length,
      entities: graph?.entities.length || 0,
      relations: graph?.relations.length || 0,
    };
  }, [state.items]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Listen for MCP memory updates
  useEffect(() => {
    const handleMCPUpdate = (event: CustomEvent<MCPKnowledgeGraph>) => {
      console.log("[useUnifiedMemory] MCP memory update event");
      if (event.detail) {
        refreshMCP(event.detail);
      }
    };

    window.addEventListener(
      MCP_MEMORY_UPDATED_EVENT,
      handleMCPUpdate as EventListener
    );
    return () => {
      window.removeEventListener(
        MCP_MEMORY_UPDATED_EVENT,
        handleMCPUpdate as EventListener
      );
    };
  }, [refreshMCP]);

  return {
    ...state,
    unifiedItems: state.items, // Backward compatibility
    refresh,
    refreshMCP,
    filterItems,
    createMemory,
    deleteMemory: deleteMemoryFn,
    stats,
  };
};

export default useUnifiedMemory;
