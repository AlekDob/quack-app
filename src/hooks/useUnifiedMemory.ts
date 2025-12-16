/**
 * useUnifiedMemory Hook
 *
 * Combines Quack pattern-based memories with MCP AI memories
 * into a unified interface for the Memory Panel.
 *
 * @module hooks/useUnifiedMemory
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { QuackMemory, MemorySettings, MemorySource } from "../types/memory";
import { DEFAULT_MEMORY_SETTINGS } from "../types/memory";
import {
  loadMemoriesFromStorage,
  addMemory,
  updateMemory,
  deleteMemory,
  getMemorySettings,
  updateMemorySettings,
  MEMORY_UPDATED_EVENT,
} from "../services/memoryStorage";
import {
  mcpMemoryService,
  quackMemoryToUnifiedItem,
  type MCPKnowledgeGraph,
  type UnifiedMemoryItem,
} from "../services/mcpMemoryService";

// Re-export MCPKnowledgeGraph for use in App.tsx
export type { MCPKnowledgeGraph } from "../services/mcpMemoryService";
import {
  extractMemories,
  generateMemoryId,
} from "../services/memoryExtractor";
import { initializeEmbedder, isEmbedderReady } from "../services/memoryEmbedder";
import { initializeVectorStore, addVector } from "../services/memoryVectorStore";

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
 * Filter options for unified memory view
 */
export interface UnifiedMemoryFilters {
  source?: MemorySource;
  category?: string;
  searchQuery?: string;
}

/**
 * Hook state
 */
interface UseUnifiedMemoryState {
  /** Quack memories */
  quackMemories: QuackMemory[];
  /** MCP entities (cached) */
  mcpItems: UnifiedMemoryItem[];
  /** Combined unified items */
  unifiedItems: UnifiedMemoryItem[];
  /** Memory settings */
  settings: MemorySettings;
  /** Loading state */
  isLoading: boolean;
  /** MCP loading state */
  isMCPLoading: boolean;
  /** Embedder ready */
  isEmbedderReady: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Hook return type
 */
interface UseUnifiedMemoryReturn extends UseUnifiedMemoryState {
  /** Refresh all memories */
  refresh: () => Promise<void>;
  /** Refresh MCP memories (call after AI uses mcp__memory__read_graph) */
  refreshMCP: (graph: MCPKnowledgeGraph) => void;
  /** Filter items */
  filterItems: (filters: UnifiedMemoryFilters) => UnifiedMemoryItem[];
  /** Create a Quack memory manually */
  createQuackMemory: (content: string, category: QuackMemory["category"]) => Promise<void>;
  /** Extract Quack memories from text */
  extractQuackMemories: (text: string, sessionId?: string, projectPath?: string) => Promise<number>;
  /** Delete a memory (handles both sources) */
  deleteMemory: (id: string, source: MemorySource) => Promise<void>;
  /** Verify a Quack memory */
  verifyMemory: (id: string) => Promise<void>;
  /** Archive a Quack memory */
  archiveMemory: (id: string) => Promise<void>;
  /** Update settings */
  updateSettings: (settings: Partial<MemorySettings>) => Promise<void>;
  /** Statistics */
  stats: {
    total: number;
    quack: number;
    mcp: number;
    verified: number;
  };
}

/**
 * Unified Memory Hook
 *
 * Combines Quack and MCP memory sources for the Memory Panel.
 */
export const useUnifiedMemory = (): UseUnifiedMemoryReturn => {
  const [state, setState] = useState<UseUnifiedMemoryState>({
    quackMemories: [],
    mcpItems: [],
    unifiedItems: [],
    settings: DEFAULT_MEMORY_SETTINGS,
    isLoading: true,
    isMCPLoading: false,
    isEmbedderReady: false,
    error: null,
  });

  /**
   * Build unified items from both sources
   */
  const buildUnifiedItems = useCallback(
    (quackMemories: QuackMemory[], mcpItems: UnifiedMemoryItem[]): UnifiedMemoryItem[] => {
      // Convert Quack memories to unified format
      const quackUnified = quackMemories.map(quackMemoryToUnifiedItem);

      // Combine both sources
      return [...mcpItems, ...quackUnified];
    },
    []
  );

  /**
   * Initialize - load Quack memories and MCP data from file
   */
  const initialize = useCallback(async () => {
    try {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      // Load settings
      const settings = await getMemorySettings();

      // Load Quack memories
      const quackMemories = await loadMemoriesFromStorage();

      // Initialize MCP service and load from file
      await mcpMemoryService.initialize();

      // Get MCP items (now loaded from file)
      const mcpItems = mcpMemoryService.getUnifiedItems();

      // Build unified list
      const unifiedItems = buildUnifiedItems(quackMemories, mcpItems);

      setState((s) => ({
        ...s,
        quackMemories,
        mcpItems,
        unifiedItems,
        settings,
        isLoading: false,
        isEmbedderReady: false,
      }));

      console.log("[useUnifiedMemory] Initialized:", {
        quack: quackMemories.length,
        mcp: mcpItems.length,
        total: unifiedItems.length,
      });

      // Initialize embedder in background (non-blocking)
      if (settings.useSemanticSearch) {
        initializeEmbedder()
          .then(() => initializeVectorStore())
          .then(() => {
            setState((s) => ({ ...s, isEmbedderReady: isEmbedderReady() }));
          })
          .catch((err) => {
            console.warn("[useUnifiedMemory] Embedder init failed:", err);
          });
      }
    } catch (error) {
      console.error("[useUnifiedMemory] Initialize failed:", error);
      setState((s) => ({
        ...s,
        isLoading: false,
        error: "Failed to initialize memory system",
      }));
    }
  }, [buildUnifiedItems]);

  /**
   * Refresh all memories (including MCP from file)
   */
  const refresh = useCallback(async () => {
    try {
      const quackMemories = await loadMemoriesFromStorage();

      // Also refresh MCP from file to catch any new changes
      await mcpMemoryService.refreshFromFile();

      const mcpItems = mcpMemoryService.getUnifiedItems();
      const unifiedItems = buildUnifiedItems(quackMemories, mcpItems);

      setState((s) => ({
        ...s,
        quackMemories,
        mcpItems,
        unifiedItems,
      }));

      console.log("[useUnifiedMemory] Refreshed:", {
        quack: quackMemories.length,
        mcp: mcpItems.length,
      });
    } catch (error) {
      console.error("[useUnifiedMemory] Refresh failed:", error);
    }
  }, [buildUnifiedItems]);

  /**
   * Refresh MCP memories from graph data
   */
  const refreshMCP = useCallback(
    (graph: MCPKnowledgeGraph) => {
      mcpMemoryService.setKnowledgeGraph(graph);
      const mcpItems = mcpMemoryService.getUnifiedItems();

      setState((s) => ({
        ...s,
        mcpItems,
        unifiedItems: buildUnifiedItems(s.quackMemories, mcpItems),
      }));

      console.log("[useUnifiedMemory] MCP refreshed:", {
        entities: graph.entities.length,
        relations: graph.relations.length,
      });
    },
    [buildUnifiedItems]
  );

  /**
   * Filter items by criteria
   */
  const filterItems = useCallback(
    (filters: UnifiedMemoryFilters): UnifiedMemoryItem[] => {
      let items = state.unifiedItems;

      // Filter by source
      if (filters.source) {
        items = items.filter((item) => item.source === filters.source);
      }

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
    [state.unifiedItems]
  );

  /**
   * Create a Quack memory manually
   */
  const createQuackMemory = useCallback(
    async (content: string, category: QuackMemory["category"]) => {
      try {
        const memory: QuackMemory = {
          id: generateMemoryId(),
          content,
          category,
          confidence: "high",
          scope: "global",
          keywords: content
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 2),
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          accessCount: 0,
          userVerified: true,
          isArchived: false,
        };

        await addMemory(memory);

        if (isEmbedderReady()) {
          try {
            await addVector(memory);
          } catch (err) {
            console.warn("[useUnifiedMemory] Vector add failed:", err);
          }
        }

        await refresh();
        toast.success("Memory created");
      } catch (error) {
        console.error("[useUnifiedMemory] Create failed:", error);
        toast.error("Failed to create memory");
      }
    },
    [refresh]
  );

  /**
   * Extract Quack memories from text
   */
  const extractQuackMemories = useCallback(
    async (
      text: string,
      sessionId?: string,
      projectPath?: string
    ): Promise<number> => {
      try {
        const extracted = extractMemories({
          text,
          sessionId,
          projectPath,
          extractProjectMemories: !!projectPath,
        });

        if (extracted.length === 0) {
          return 0;
        }

        for (const memory of extracted) {
          await addMemory(memory);

          if (isEmbedderReady()) {
            try {
              await addVector(memory);
            } catch (err) {
              console.warn("[useUnifiedMemory] Vector add failed:", err);
            }
          }
        }

        await refresh();
        return extracted.length;
      } catch (error) {
        console.error("[useUnifiedMemory] Extract failed:", error);
        return 0;
      }
    },
    [refresh]
  );

  /**
   * Delete a memory (handles both sources)
   */
  const deleteMemoryFn = useCallback(
    async (id: string, source: MemorySource) => {
      try {
        if (source === "quack") {
          await deleteMemory(id);
          await refresh();
          toast.success("Memory deleted");
        } else {
          // For MCP memories, we need to use mcp__memory__delete_entities
          // This will be called by the AI agent
          toast.info(
            "Ask the AI to delete this MCP entity using 'delete entity [name]'"
          );
        }
      } catch (error) {
        console.error("[useUnifiedMemory] Delete failed:", error);
        toast.error("Failed to delete memory");
      }
    },
    [refresh]
  );

  /**
   * Verify a Quack memory
   */
  const verifyMemory = useCallback(
    async (id: string) => {
      try {
        await updateMemory(id, { userVerified: true, confidence: "high" });
        await refresh();
      } catch (error) {
        console.error("[useUnifiedMemory] Verify failed:", error);
        toast.error("Failed to verify memory");
      }
    },
    [refresh]
  );

  /**
   * Archive a Quack memory
   */
  const archiveMemory = useCallback(
    async (id: string) => {
      try {
        await updateMemory(id, { isArchived: true });
        await refresh();
        toast.success("Memory archived");
      } catch (error) {
        console.error("[useUnifiedMemory] Archive failed:", error);
        toast.error("Failed to archive memory");
      }
    },
    [refresh]
  );

  /**
   * Update settings
   */
  const updateSettingsFn = useCallback(
    async (settings: Partial<MemorySettings>) => {
      try {
        await updateMemorySettings(settings);
        setState((s) => ({
          ...s,
          settings: { ...s.settings, ...settings },
        }));
        toast.success("Settings updated");
      } catch (error) {
        console.error("[useUnifiedMemory] Settings update failed:", error);
        toast.error("Failed to update settings");
      }
    },
    []
  );

  /**
   * Calculate statistics
   */
  const stats = useMemo(() => {
    const quack = state.quackMemories.filter((m) => !m.isArchived).length;
    const mcp = state.mcpItems.length;
    const verified = state.quackMemories.filter((m) => m.userVerified).length;

    return {
      total: quack + mcp,
      quack,
      mcp,
      verified,
    };
  }, [state.quackMemories, state.mcpItems]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Listen for Quack memory updates
  useEffect(() => {
    const handleQuackUpdate = () => {
      console.log("[useUnifiedMemory] Quack memory update event");
      refresh();
    };

    window.addEventListener(MEMORY_UPDATED_EVENT, handleQuackUpdate);
    return () => {
      window.removeEventListener(MEMORY_UPDATED_EVENT, handleQuackUpdate);
    };
  }, [refresh]);

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
    refresh,
    refreshMCP,
    filterItems,
    createQuackMemory,
    extractQuackMemories,
    deleteMemory: deleteMemoryFn,
    verifyMemory,
    archiveMemory,
    updateSettings: updateSettingsFn,
    stats,
  };
};

export default useUnifiedMemory;
