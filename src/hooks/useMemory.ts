/**
 * useMemory Hook
 *
 * React hook for managing Quack Memory system.
 * Provides access to memory operations and state.
 *
 * @module hooks/useMemory
 */

import { useState, useEffect, useCallback } from "react";
import type {
  QuackMemory,
  MemorySettings,
  MemorySearchResult,
} from "../types/memory";
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
  searchMemories,
  getRecentMemories,
  getMostAccessedMemories,
} from "../services/memorySearch";
import type { MemorySearchOptions } from "../services/memorySearch";
import {
  extractMemories,
  generateMemoryId,
} from "../services/memoryExtractor";
import { initializeEmbedder, isEmbedderReady } from "../services/memoryEmbedder";
import { initializeVectorStore, addVector } from "../services/memoryVectorStore";
import { toast } from "sonner";

/**
 * Memory hook state
 */
interface UseMemoryState {
  /** All loaded memories */
  memories: QuackMemory[];
  /** Current search results */
  searchResults: MemorySearchResult[];
  /** Memory settings */
  settings: MemorySettings;
  /** Loading state */
  isLoading: boolean;
  /** Search loading state */
  isSearching: boolean;
  /** Embedder ready state */
  isEmbedderReady: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Memory hook return type
 */
interface UseMemoryReturn extends UseMemoryState {
  /** Refresh memories from storage */
  refreshMemories: () => Promise<void>;
  /** Search memories */
  search: (query: string, options?: MemorySearchOptions) => Promise<void>;
  /** Clear search results */
  clearSearch: () => void;
  /** Add a new memory manually */
  createMemory: (content: string, category: QuackMemory["category"]) => Promise<void>;
  /** Extract and save memories from text */
  extractAndSave: (text: string, sessionId?: string, projectPath?: string) => Promise<number>;
  /** Update a memory */
  update: (id: string, updates: Partial<QuackMemory>) => Promise<void>;
  /** Delete a memory */
  remove: (id: string) => Promise<void>;
  /** Verify a memory (set userVerified=true) */
  verify: (id: string) => Promise<void>;
  /** Archive a memory */
  archive: (id: string) => Promise<void>;
  /** Update settings */
  updateSettings: (settings: Partial<MemorySettings>) => Promise<void>;
  /** Get recent memories */
  getRecent: (limit?: number) => Promise<QuackMemory[]>;
  /** Get most accessed memories */
  getMostAccessed: (limit?: number) => Promise<QuackMemory[]>;
  /** Initialize the memory system */
  initialize: () => Promise<void>;
}

/**
 * Hook for managing Quack Memory system
 *
 * @example
 * ```tsx
 * function MemoryPanel() {
 *   const {
 *     memories,
 *     search,
 *     searchResults,
 *     createMemory,
 *     isLoading
 *   } = useMemory();
 *
 *   return (
 *     <div>
 *       {isLoading ? <Spinner /> : (
 *         <MemoryList memories={memories} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export const useMemory = (): UseMemoryReturn => {
  const [state, setState] = useState<UseMemoryState>({
    memories: [],
    searchResults: [],
    settings: DEFAULT_MEMORY_SETTINGS,
    isLoading: true,
    isSearching: false,
    isEmbedderReady: false,
    error: null,
  });

  /**
   * Initialize the memory system
   */
  const initialize = useCallback(async () => {
    try {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      // Load settings first
      const settings = await getMemorySettings();

      // Load memories
      const memories = await loadMemoriesFromStorage();

      // Set loading false FIRST, then init embedder in background
      setState((s) => ({
        ...s,
        memories,
        settings,
        isLoading: false,
        isEmbedderReady: false,
      }));

      console.log(`[useMemory] Initialized with ${memories.length} memories`);

      // Initialize embedder in background (non-blocking)
      if (settings.useSemanticSearch) {
        initializeEmbedder()
          .then(() => initializeVectorStore())
          .then(() => {
            setState((s) => ({ ...s, isEmbedderReady: isEmbedderReady() }));
            console.log("[useMemory] Embedder ready");
          })
          .catch((embErr) => {
            console.warn("[useMemory] Embedder init failed:", embErr);
          });
      }
    } catch (error) {
      console.error("[useMemory] Initialize failed:", error);
      setState((s) => ({
        ...s,
        isLoading: false,
        error: "Failed to initialize memory system",
      }));
    }
  }, []);

  /**
   * Refresh memories from storage
   */
  const refreshMemories = useCallback(async () => {
    try {
      const memories = await loadMemoriesFromStorage();
      setState((s) => ({ ...s, memories }));
    } catch (error) {
      console.error("[useMemory] Refresh failed:", error);
    }
  }, []);

  /**
   * Search memories
   */
  const search = useCallback(
    async (query: string, options?: MemorySearchOptions) => {
      if (!query.trim()) {
        setState((s) => ({ ...s, searchResults: [] }));
        return;
      }

      try {
        setState((s) => ({ ...s, isSearching: true }));
        const results = await searchMemories(query, options);
        setState((s) => ({ ...s, searchResults: results, isSearching: false }));
      } catch (error) {
        console.error("[useMemory] Search failed:", error);
        setState((s) => ({ ...s, isSearching: false }));
      }
    },
    []
  );

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    setState((s) => ({ ...s, searchResults: [] }));
  }, []);

  /**
   * Create a new memory manually
   */
  const createMemory = useCallback(
    async (content: string, category: QuackMemory["category"]) => {
      try {
        const memory: QuackMemory = {
          id: generateMemoryId(),
          content,
          category,
          confidence: "high", // Manual = high confidence
          scope: "global",
          keywords: content.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          accessCount: 0,
          userVerified: true, // Manual = verified
          isArchived: false,
        };

        await addMemory(memory);

        // Add to vector store if ready
        if (isEmbedderReady()) {
          try {
            await addVector(memory);
          } catch (err) {
            console.warn("[useMemory] Vector add failed:", err);
          }
        }

        await refreshMemories();
        toast.success("Memory created");
      } catch (error) {
        console.error("[useMemory] Create failed:", error);
        toast.error("Failed to create memory");
      }
    },
    [refreshMemories]
  );

  /**
   * Extract and save memories from text
   */
  const extractAndSave = useCallback(
    async (text: string, sessionId?: string, projectPath?: string): Promise<number> => {
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

        // Save each memory
        for (const memory of extracted) {
          await addMemory(memory);

          // Add to vector store if ready
          if (isEmbedderReady()) {
            try {
              await addVector(memory);
            } catch (err) {
              console.warn("[useMemory] Vector add failed:", err);
            }
          }
        }

        await refreshMemories();
        console.log(`[useMemory] Extracted and saved ${extracted.length} memories`);
        return extracted.length;
      } catch (error) {
        console.error("[useMemory] Extract failed:", error);
        return 0;
      }
    },
    [refreshMemories]
  );

  /**
   * Update a memory
   */
  const update = useCallback(
    async (id: string, updates: Partial<QuackMemory>) => {
      try {
        await updateMemory(id, updates);
        await refreshMemories();
      } catch (error) {
        console.error("[useMemory] Update failed:", error);
        toast.error("Failed to update memory");
      }
    },
    [refreshMemories]
  );

  /**
   * Delete a memory
   */
  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteMemory(id);
        await refreshMemories();
        toast.success("Memory deleted");
      } catch (error) {
        console.error("[useMemory] Delete failed:", error);
        toast.error("Failed to delete memory");
      }
    },
    [refreshMemories]
  );

  /**
   * Verify a memory
   */
  const verify = useCallback(
    async (id: string) => {
      await update(id, { userVerified: true, confidence: "high" });
    },
    [update]
  );

  /**
   * Archive a memory
   */
  const archive = useCallback(
    async (id: string) => {
      await update(id, { isArchived: true });
      toast.success("Memory archived");
    },
    [update]
  );

  /**
   * Update settings
   */
  const updateSettings = useCallback(
    async (settings: Partial<MemorySettings>) => {
      try {
        await updateMemorySettings(settings);
        setState((s) => ({ ...s, settings: { ...s.settings, ...settings } }));
        toast.success("Settings updated");
      } catch (error) {
        console.error("[useMemory] Settings update failed:", error);
        toast.error("Failed to update settings");
      }
    },
    []
  );

  /**
   * Get recent memories
   */
  const getRecent = useCallback(async (limit: number = 10) => {
    return getRecentMemories(limit);
  }, []);

  /**
   * Get most accessed memories
   */
  const getMostAccessed = useCallback(async (limit: number = 10) => {
    return getMostAccessedMemories(limit);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Listen for memory updates from other parts of the app
  useEffect(() => {
    const handleMemoryUpdated = () => {
      console.log("[useMemory] Memory updated event received, refreshing...");
      refreshMemories();
    };

    window.addEventListener(MEMORY_UPDATED_EVENT, handleMemoryUpdated);
    return () => {
      window.removeEventListener(MEMORY_UPDATED_EVENT, handleMemoryUpdated);
    };
  }, [refreshMemories]);

  return {
    ...state,
    refreshMemories,
    search,
    clearSearch,
    createMemory,
    extractAndSave,
    update,
    remove,
    verify,
    archive,
    updateSettings,
    getRecent,
    getMostAccessed,
    initialize,
  };
};

export default useMemory;
