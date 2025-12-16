/**
 * Memory Storage Service
 *
 * Handles persistent storage of Quack Memory metadata using Tauri Store.
 * Memory content and metadata are stored in JSON, while vector embeddings
 * are managed separately by the vector store service.
 *
 * @module services/memoryStorage
 */

import { Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import type { QuackMemory, MemorySettings } from "../types/memory";
import { DEFAULT_MEMORY_SETTINGS } from "../types/memory";
import { getTestModeStoreName } from "../utils/testModeStorage";

// Storage keys
const MEMORIES_KEY = "memories";
const MEMORY_SETTINGS_KEY = "memorySettings";

/**
 * Saves memories to persistent storage
 *
 * Overwrites the entire memories array in storage.
 * Used for bulk updates and periodic syncs.
 *
 * @param memories - Array of QuackMemory objects to persist
 *
 * @example
 * ```typescript
 * const memories: QuackMemory[] = [
 *   { id: "1", content: "User prefers TypeScript strict mode", ... }
 * ];
 * await saveMemoriesToStorage(memories);
 * ```
 */
export const saveMemoriesToStorage = async (
  memories: QuackMemory[]
): Promise<void> => {
  try {
    const store = await Store.load(
      getTestModeStoreName("quack-memories.json")
    );
    await store.set(MEMORIES_KEY, memories);
    await store.save();
    console.log(`[memoryStorage] Saved ${memories.length} memories`);
  } catch (error) {
    console.error("[memoryStorage] Failed to save memories:", error);
    toast.error("Failed to save memories");
  }
};

/**
 * Loads memories from persistent storage with defensive validation
 *
 * Features:
 * - Validates data structure (must be array)
 * - Filters out corrupted/invalid entries
 * - Auto-cleans storage on corruption detection
 * - Returns empty array on critical errors
 *
 * @returns Promise resolving to validated array of QuackMemory objects
 *
 * @example
 * ```typescript
 * const memories = await loadMemoriesFromStorage();
 * console.log(`Loaded ${memories.length} memories`);
 * ```
 */
export const loadMemoriesFromStorage = async (): Promise<QuackMemory[]> => {
  console.log("[memoryStorage] loadMemoriesFromStorage called");
  try {
    const store = await Store.load(
      getTestModeStoreName("quack-memories.json")
    );
    console.log("[memoryStorage] Store loaded for memories");
    const stored = await store.get<QuackMemory[]>(MEMORIES_KEY);
    console.log("[memoryStorage] Raw stored memories:", stored?.length ?? 0);

    // Defensive: Validate data structure before returning
    if (!stored) {
      return [];
    }

    if (!Array.isArray(stored)) {
      console.error(
        "[memoryStorage] Storage corruption detected: memories is not an array",
        typeof stored
      );
      toast.error("Memory storage corrupted - resetting to clean state");
      await store.delete(MEMORIES_KEY);
      await store.save();
      return [];
    }

    // Defensive: Validate each memory has required fields
    const validated = stored.filter((memory: any) => {
      if (!memory || typeof memory !== "object") {
        console.warn("[memoryStorage] Skipping invalid memory entry:", memory);
        return false;
      }
      if (!memory.id || !memory.content || !memory.category) {
        console.warn(
          "[memoryStorage] Skipping memory missing required fields:",
          memory
        );
        return false;
      }
      return true;
    });

    if (validated.length !== stored.length) {
      console.warn(
        `[memoryStorage] Filtered out ${stored.length - validated.length} corrupted entries`
      );
    }

    console.log(`[memoryStorage] Loaded ${validated.length} memories`);
    return validated;
  } catch (error) {
    console.error("[memoryStorage] Critical error loading memories:", error);
    toast.error("Failed to load memories - starting fresh");
    return [];
  }
};

/**
 * Adds a new memory to storage
 *
 * Loads existing memories, appends the new one, and saves back.
 * Updates lastAccessedAt to current timestamp.
 *
 * @param memory - QuackMemory object to add
 *
 * @example
 * ```typescript
 * const newMemory: QuackMemory = {
 *   id: crypto.randomUUID(),
 *   content: "User prefers 20-line functions max",
 *   category: "preference",
 *   ...
 * };
 * await addMemory(newMemory);
 * ```
 */
/**
 * Custom event name for memory updates
 * Used to notify React components when memories change
 */
export const MEMORY_UPDATED_EVENT = "quack-memory-updated";

/**
 * Dispatches memory updated event
 * Called after any memory storage operation
 */
const dispatchMemoryUpdatedEvent = () => {
  window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
};

export const addMemory = async (memory: QuackMemory): Promise<void> => {
  try {
    const memories = await loadMemoriesFromStorage();
    const updatedMemory = {
      ...memory,
      lastAccessedAt: Date.now(),
    };
    memories.push(updatedMemory);
    await saveMemoriesToStorage(memories);
    console.log(`[memoryStorage] Added memory: ${memory.id}`);

    // Notify listeners that memories have changed
    dispatchMemoryUpdatedEvent();
  } catch (error) {
    console.error("[memoryStorage] Failed to add memory:", error);
    toast.error("Failed to add memory");
  }
};

/**
 * Updates an existing memory in storage
 *
 * Finds memory by ID, merges updates, and saves.
 * Updates lastAccessedAt to current timestamp.
 *
 * @param id - Memory ID to update
 * @param updates - Partial QuackMemory with fields to update
 *
 * @example
 * ```typescript
 * await updateMemory("mem-123", {
 *   userVerified: true,
 *   confidence: "high"
 * });
 * ```
 */
export const updateMemory = async (
  id: string,
  updates: Partial<QuackMemory>
): Promise<void> => {
  try {
    const memories = await loadMemoriesFromStorage();
    const index = memories.findIndex((m) => m.id === id);

    if (index === -1) {
      console.warn(`[memoryStorage] Memory not found: ${id}`);
      toast.error("Memory not found");
      return;
    }

    memories[index] = {
      ...memories[index],
      ...updates,
      lastAccessedAt: Date.now(),
    };

    await saveMemoriesToStorage(memories);
    console.log(`[memoryStorage] Updated memory: ${id}`);

    // Notify listeners that memories have changed
    dispatchMemoryUpdatedEvent();
  } catch (error) {
    console.error("[memoryStorage] Failed to update memory:", error);
    toast.error("Failed to update memory");
  }
};

/**
 * Deletes a memory from storage
 *
 * Removes memory by ID. Does not delete vector embeddings
 * (that should be handled by vector store service).
 *
 * @param id - Memory ID to delete
 *
 * @example
 * ```typescript
 * await deleteMemory("mem-123");
 * ```
 */
export const deleteMemory = async (id: string): Promise<void> => {
  try {
    const memories = await loadMemoriesFromStorage();
    const filtered = memories.filter((m) => m.id !== id);

    if (filtered.length === memories.length) {
      console.warn(`[memoryStorage] Memory not found: ${id}`);
      toast.error("Memory not found");
      return;
    }

    await saveMemoriesToStorage(filtered);
    console.log(`[memoryStorage] Deleted memory: ${id}`);

    // Notify listeners that memories have changed
    dispatchMemoryUpdatedEvent();
  } catch (error) {
    console.error("[memoryStorage] Failed to delete memory:", error);
    toast.error("Failed to delete memory");
  }
};

/**
 * Loads memory settings from storage
 *
 * Returns default settings if none are stored.
 * Validates stored settings and falls back to defaults on corruption.
 *
 * @returns Promise resolving to MemorySettings
 *
 * @example
 * ```typescript
 * const settings = await getMemorySettings();
 * if (settings.enabled) {
 *   // Memory system is active
 * }
 * ```
 */
export const getMemorySettings = async (): Promise<MemorySettings> => {
  console.log("[memoryStorage] getMemorySettings called");
  try {
    const store = await Store.load(
      getTestModeStoreName("quack-memories.json")
    );
    console.log("[memoryStorage] Store loaded");
    const stored = await store.get<MemorySettings>(MEMORY_SETTINGS_KEY);
    console.log("[memoryStorage] Settings from store:", stored);

    if (!stored) {
      // First time - just return defaults (don't save yet to avoid issues)
      console.log("[memoryStorage] No settings found, using defaults");
      return DEFAULT_MEMORY_SETTINGS;
    }

    // Defensive: Validate settings structure
    if (typeof stored !== "object") {
      console.error(
        "[memoryStorage] Invalid settings format, using defaults"
      );
      return DEFAULT_MEMORY_SETTINGS;
    }

    console.log("[memoryStorage] Loaded memory settings");
    return { ...DEFAULT_MEMORY_SETTINGS, ...stored };
  } catch (error) {
    console.error("[memoryStorage] Failed to load settings:", error);
    return DEFAULT_MEMORY_SETTINGS;
  }
};

/**
 * Updates memory settings in storage
 *
 * Merges updates with existing settings and saves.
 *
 * @param settings - Partial MemorySettings with fields to update
 *
 * @example
 * ```typescript
 * await updateMemorySettings({
 *   autoExtract: false,
 *   maxMemories: 500
 * });
 * ```
 */
export const updateMemorySettings = async (
  settings: Partial<MemorySettings>
): Promise<void> => {
  try {
    const store = await Store.load(
      getTestModeStoreName("quack-memories.json")
    );
    const current = await getMemorySettings();
    const updated = { ...current, ...settings };
    await store.set(MEMORY_SETTINGS_KEY, updated);
    await store.save();
    console.log("[memoryStorage] Updated memory settings");
  } catch (error) {
    console.error("[memoryStorage] Failed to update settings:", error);
    toast.error("Failed to update memory settings");
  }
};
