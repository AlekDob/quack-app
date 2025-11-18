/**
 * Agent Chat Storage Service
 *
 * Handles persistent storage of AgentChat workspace configurations.
 *
 * AgentChats represent workspace containers that group terminal tabs
 * for organizational purposes in the UI.
 *
 * @module agentChatStorage
 */

import { Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import type { AgentChat } from "../types";
import { getTestModeStoreName } from "../utils/testModeStorage";

// Storage key for agent chats
const AGENT_CHATS_KEY = "agentChats";

/**
 * Saves agent chats to persistent storage
 *
 * @param chats - Array of AgentChat objects to persist
 *
 * @example
 * ```typescript
 * const chats: AgentChat[] = [
 *   { id: "1", name: "Project A", terminals: ["term-1", "term-2"] }
 * ];
 * await saveAgentChatsToStorage(chats);
 * ```
 */
export const saveAgentChatsToStorage = async (chats: AgentChat[]): Promise<void> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-chats.json"));
    await store.set(AGENT_CHATS_KEY, chats);
    await store.save();
    console.log(`[agentChatStorage] Saved ${chats.length} AgentChats`);
  } catch (error) {
    console.error("[agentChatStorage] Failed to save AgentChats:", error);
    toast.error("Failed to save workspace configuration");
  }
};

/**
 * Loads agent chats from persistent storage with defensive validation
 *
 * Features:
 * - Validates data structure (must be array)
 * - Filters out corrupted/invalid entries
 * - Auto-cleans storage on corruption detection
 * - Returns empty array on critical errors
 *
 * @returns Promise resolving to validated array of AgentChat objects
 *
 * @example
 * ```typescript
 * const chats = await loadAgentChatsFromStorage();
 * console.log(`Loaded ${chats.length} agent chats`);
 * ```
 */
export const loadAgentChatsFromStorage = async (): Promise<AgentChat[]> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-chats.json"));
    const stored = await store.get<AgentChat[]>(AGENT_CHATS_KEY);

    // ✅ DEFENSIVE: Validate data structure before returning
    if (!stored) {
      return [];
    }

    if (!Array.isArray(stored)) {
      console.error("🦆 [agentChatStorage] Storage corruption detected: agentChats is not an array", typeof stored);
      toast.error("Agent chat storage corrupted - resetting to clean state");
      await store.delete(AGENT_CHATS_KEY);
      await store.save();
      return [];
    }

    // ✅ DEFENSIVE: Validate each agent chat has required fields
    const validated = stored.filter((chat: any) => {
      if (!chat || typeof chat !== 'object') {
        console.warn("🦆 [agentChatStorage] Skipping invalid agent chat entry:", chat);
        return false;
      }
      if (!chat.id || !chat.name) {
        console.warn("🦆 [agentChatStorage] Skipping agent chat missing id/name:", chat);
        return false;
      }
      return true;
    });

    if (validated.length !== stored.length) {
      console.warn(`🦆 [agentChatStorage] Filtered out ${stored.length - validated.length} corrupted entries`);
    }

    console.log(`[agentChatStorage] Loaded ${validated.length} AgentChats`);
    return validated;
  } catch (error) {
    console.error("🦆 [agentChatStorage] Critical error loading AgentChats:", error);
    toast.error("Failed to load agent chats - starting fresh");
    return [];
  }
};
