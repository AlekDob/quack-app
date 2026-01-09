/**
 * Agent Chat Persistence Service
 *
 * Handles automatic persistence and restoration of agent chat sessions.
 * Saves sessionId and chat messages when they're created, and restores them on app startup.
 *
 * @module agentChatPersistence
 */

import { Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import type { ChatMessage } from "../types";
import { getTestModeStoreName } from "../utils/testModeStorage";

// Storage keys
const AGENT_SESSION_MAP_KEY = "agentSessionMap";
const AGENT_MESSAGES_KEY_PREFIX = "agentMessages_";

/**
 * Mapping of agentId to Claude SDK sessionId
 */
export interface AgentSessionMap {
  [agentId: string]: string; // agentId -> sessionId
}

/**
 * Stored chat messages for an agent
 */
export interface StoredAgentMessages {
  agentId: string;
  sessionId: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: number;
  }>;
  lastUpdated: number;
}

/**
 * Save sessionId for an agent
 *
 * @param agentId - Agent identifier
 * @param sessionId - Claude SDK session ID
 */
export async function saveAgentSessionId(agentId: string, sessionId: string): Promise<void> {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-sessions.json"));

    // Load existing map
    const existingMap = await store.get<AgentSessionMap>(AGENT_SESSION_MAP_KEY) || {};

    // Update with new sessionId
    existingMap[agentId] = sessionId;

    await store.set(AGENT_SESSION_MAP_KEY, existingMap);
    await store.save();

    console.log(`[agentChatPersistence] Saved sessionId for agent ${agentId}: ${sessionId}`);
  } catch (error) {
    console.error(`[agentChatPersistence] Failed to save sessionId for agent ${agentId}:`, error);
  }
}

/**
 * Get sessionId for an agent
 *
 * @param agentId - Agent identifier
 * @returns SessionId or undefined if not found
 */
export async function getAgentSessionId(agentId: string): Promise<string | undefined> {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-sessions.json"));
    const map = await store.get<AgentSessionMap>(AGENT_SESSION_MAP_KEY);

    return map?.[agentId];
  } catch (error) {
    console.error(`[agentChatPersistence] Failed to get sessionId for agent ${agentId}:`, error);
    return undefined;
  }
}

/**
 * Load all agent session IDs
 *
 * @returns Map of agentId -> sessionId
 */
export async function loadAllAgentSessions(): Promise<Map<string, string>> {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-sessions.json"));
    const map = await store.get<AgentSessionMap>(AGENT_SESSION_MAP_KEY) || {};

    const result = new Map<string, string>();
    Object.entries(map).forEach(([agentId, sessionId]) => {
      result.set(agentId, sessionId);
    });

    console.log(`[agentChatPersistence] Loaded ${result.size} agent sessions`);
    return result;
  } catch (error) {
    console.error("[agentChatPersistence] Failed to load agent sessions:", error);
    return new Map();
  }
}

/**
 * Save chat messages for an agent
 *
 * @param agentId - Agent identifier
 * @param sessionId - Claude SDK session ID
 * @param messages - Chat messages to save
 */
export async function saveAgentMessages(
  agentId: string,
  sessionId: string,
  messages: ChatMessage[]
): Promise<void> {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-messages.json"));

    const storageKey = `${AGENT_MESSAGES_KEY_PREFIX}${agentId}`;

    // Only save essential message data to reduce storage size
    const simplifiedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    const storedMessages: StoredAgentMessages = {
      agentId,
      sessionId,
      messages: simplifiedMessages,
      lastUpdated: Date.now(),
    };

    await store.set(storageKey, storedMessages);
    await store.save();

    console.log(`[agentChatPersistence] Saved ${messages.length} messages for agent ${agentId}`);
  } catch (error) {
    console.error(`[agentChatPersistence] Failed to save messages for agent ${agentId}:`, error);
  }
}

/**
 * Load chat messages for an agent
 *
 * @param agentId - Agent identifier
 * @returns Stored messages or null if not found
 */
export async function loadAgentMessages(agentId: string): Promise<StoredAgentMessages | null> {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-messages.json"));
    const storageKey = `${AGENT_MESSAGES_KEY_PREFIX}${agentId}`;

    const stored = await store.get<StoredAgentMessages>(storageKey);

    if (stored) {
      console.log(`[agentChatPersistence] Loaded ${stored.messages.length} messages for agent ${agentId}`);
    }

    return stored || null;
  } catch (error) {
    console.error(`[agentChatPersistence] Failed to load messages for agent ${agentId}:`, error);
    return null;
  }
}

/**
 * Delete stored data for an agent (when agent is deleted)
 *
 * @param agentId - Agent identifier
 */
export async function deleteAgentData(agentId: string): Promise<void> {
  try {
    // Remove sessionId from map
    const sessionStore = await Store.load(getTestModeStoreName("quack-agent-sessions.json"));
    const map = await sessionStore.get<AgentSessionMap>(AGENT_SESSION_MAP_KEY) || {};
    delete map[agentId];
    await sessionStore.set(AGENT_SESSION_MAP_KEY, map);
    await sessionStore.save();

    // Remove messages
    const messagesStore = await Store.load(getTestModeStoreName("quack-agent-messages.json"));
    const storageKey = `${AGENT_MESSAGES_KEY_PREFIX}${agentId}`;
    await messagesStore.delete(storageKey);
    await messagesStore.save();

    console.log(`[agentChatPersistence] Deleted data for agent ${agentId}`);
  } catch (error) {
    console.error(`[agentChatPersistence] Failed to delete data for agent ${agentId}:`, error);
  }
}

/**
 * Clear all stored agent chat data (for testing or reset)
 */
export async function clearAllAgentData(): Promise<void> {
  try {
    const sessionStore = await Store.load(getTestModeStoreName("quack-agent-sessions.json"));
    await sessionStore.clear();
    await sessionStore.save();

    const messagesStore = await Store.load(getTestModeStoreName("quack-agent-messages.json"));
    await messagesStore.clear();
    await messagesStore.save();

    console.log("[agentChatPersistence] Cleared all agent data");
    toast.success("Agent chat data cleared");
  } catch (error) {
    console.error("[agentChatPersistence] Failed to clear agent data:", error);
    toast.error("Failed to clear agent data");
  }
}
