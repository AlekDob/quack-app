/**
 * Unified Agent Storage Service
 *
 * Consolidates all agent-related storage into a single file: quack-agents.json
 * Replaces: terminalStorage.ts, agentChatStorage.ts, agentChatPersistence.ts, sessionStorage.ts
 *
 * Key principles:
 * - ONE storage file for all agent data
 * - Claude SDK manages conversation history (we just store sdkSessionId reference)
 * - Graceful error handling (return empty data on corruption)
 * - Migration support from legacy storage files
 *
 * @module unifiedAgentStorage
 */

import { Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import { getTestModeStoreName } from "../utils/testModeStorage";
import type { AgentPersonality, AgentSession } from "../types";
// Brain: fix-automation-session-title-missing
import { sessionWriteLock } from "../stores/sessionWriteLock";

// ============================================
// Types
// ============================================

/**
 * Unified Agent - single source of truth for agent data
 */
export interface UnifiedAgent {
  id: string;
  name: string;
  projectPath: string;
  projectName: string;
  color: string;
  avatar?: string;
  personality?: AgentPersonality;
  sdkSessionId?: string; // Claude SDK manages conversation history
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Root storage structure
 */
interface UnifiedAgentStore {
  agents: UnifiedAgent[];
  sessions: AgentSession[];
  version: number;
}

// ============================================
// Constants
// ============================================

const STORAGE_FILE = "quack-agents.json";
const AGENTS_KEY = "agents";
const SESSIONS_KEY = "sessions";
const VERSION_KEY = "version";
const CURRENT_VERSION = 1;

// Legacy storage files (for migration)
const LEGACY_FILES = {
  terminals: "quack-terminals.json",
  agentChats: "quack-agent-chats.json",
  agentSessions: "quack-agent-sessions.json",
  agentMessages: "quack-agent-messages.json",
} as const;

// ============================================
// Private Helpers
// ============================================

/**
 * Load store with error handling
 */
async function getStore(): Promise<Store> {
  return Store.load(getTestModeStoreName(STORAGE_FILE));
}

/**
 * Validate agent data structure
 */
function isValidAgent(agent: unknown): agent is UnifiedAgent {
  if (!agent || typeof agent !== "object") return false;
  const a = agent as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.name === "string" &&
    typeof a.projectPath === "string" &&
    typeof a.projectName === "string" &&
    typeof a.color === "string" &&
    typeof a.createdAt === "number" &&
    typeof a.lastActiveAt === "number"
  );
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// Core CRUD Operations
// ============================================

/**
 * Load all agents from storage
 *
 * @returns Array of unified agents (empty array if storage is empty or corrupted)
 */
export async function loadAgents(): Promise<UnifiedAgent[]> {
  try {
    const store = await getStore();

    // Force reload from disk to catch external changes
    try {
      await store.reload();
    } catch (reloadError) {
      console.warn("[unifiedAgentStorage] Failed to reload from disk:", reloadError);
    }

    const stored = await store.get<UnifiedAgent[]>(AGENTS_KEY);

    // Handle empty storage
    if (!stored) {
      console.log("[unifiedAgentStorage] No agents found in storage");
      return [];
    }

    // Validate array structure
    if (!Array.isArray(stored)) {
      console.error("[unifiedAgentStorage] Storage corruption: agents is not an array", typeof stored);
      toast.error("Agent storage corrupted - resetting to clean state");
      await store.delete(AGENTS_KEY);
      await store.save();
      return [];
    }

    // Validate each agent and filter out corrupted entries
    const validated = stored.filter((agent) => {
      if (!isValidAgent(agent)) {
        console.warn("[unifiedAgentStorage] Skipping invalid agent entry:", agent);
        return false;
      }
      return true;
    });

    if (validated.length !== stored.length) {
      console.warn(
        `[unifiedAgentStorage] Filtered out ${stored.length - validated.length} corrupted agent entries`
      );
    }

    console.log(`[unifiedAgentStorage] Loaded ${validated.length} agents`);
    return validated;
  } catch (error) {
    console.error("[unifiedAgentStorage] Critical error loading agents:", error);
    toast.error("Failed to load agents - starting fresh");
    return [];
  }
}

/**
 * Save all agents to storage
 *
 * @param agents - Array of unified agents to persist
 */
export async function saveAgents(agents: UnifiedAgent[]): Promise<void> {
  try {
    const store = await getStore();
    await store.set(AGENTS_KEY, agents);
    await store.set(VERSION_KEY, CURRENT_VERSION);
    await store.save();
    console.log(`[unifiedAgentStorage] Saved ${agents.length} agents`);
  } catch (error) {
    console.error("[unifiedAgentStorage] Failed to save agents:", error);
    toast.error("Failed to save agent data");
  }
}

/**
 * Get a single agent by ID
 *
 * @param id - Agent identifier
 * @returns Agent or null if not found
 */
async function getAgent(id: string): Promise<UnifiedAgent | null> {
  try {
    const agents = await loadAgents();
    return agents.find((a) => a.id === id) ?? null;
  } catch (error) {
    console.error(`[unifiedAgentStorage] Failed to get agent ${id}:`, error);
    return null;
  }
}

/**
 * Create a new agent
 *
 * @param agentData - Agent data without id and createdAt
 * @returns Created agent with generated id and timestamps
 */
export async function createAgent(
  agentData: Omit<UnifiedAgent, "id" | "createdAt">
): Promise<UnifiedAgent> {
  const now = Date.now();
  const newAgent: UnifiedAgent = {
    ...agentData,
    id: generateId(),
    createdAt: now,
    lastActiveAt: agentData.lastActiveAt || now,
  };

  try {
    const agents = await loadAgents();
    agents.push(newAgent);
    await saveAgents(agents);
    console.log(`[unifiedAgentStorage] Created agent: ${newAgent.id} (${newAgent.name})`);
    return newAgent;
  } catch (error) {
    console.error("[unifiedAgentStorage] Failed to create agent:", error);
    toast.error("Failed to create agent");
    throw error;
  }
}

/**
 * Update an existing agent
 *
 * @param id - Agent identifier
 * @param updates - Partial agent object with fields to update
 */
async function updateAgent(
  id: string,
  updates: Partial<Omit<UnifiedAgent, "id" | "createdAt">>
): Promise<void> {
  try {
    const agents = await loadAgents();
    const index = agents.findIndex((a) => a.id === id);

    if (index === -1) {
      console.warn(`[unifiedAgentStorage] Agent ${id} not found for update`);
      return;
    }

    // Merge updates, always update lastActiveAt
    agents[index] = {
      ...agents[index],
      ...updates,
      lastActiveAt: updates.lastActiveAt ?? Date.now(),
    };

    await saveAgents(agents);
    console.log(`[unifiedAgentStorage] Updated agent: ${id}`);
  } catch (error) {
    console.error(`[unifiedAgentStorage] Failed to update agent ${id}:`, error);
    toast.error("Failed to update agent");
  }
}

/**
 * Delete an agent
 *
 * @param id - Agent identifier
 */
export async function deleteAgent(id: string): Promise<void> {
  try {
    const agents = await loadAgents();
    const filtered = agents.filter((a) => a.id !== id);

    if (filtered.length === agents.length) {
      console.warn(`[unifiedAgentStorage] Agent ${id} not found for deletion`);
      return;
    }

    await saveAgents(filtered);
    console.log(`[unifiedAgentStorage] Deleted agent: ${id}`);
  } catch (error) {
    console.error(`[unifiedAgentStorage] Failed to delete agent ${id}:`, error);
    toast.error("Failed to delete agent");
  }
}

// ============================================
// Query Helpers
// ============================================

/**
 * Get agents filtered by project path
 *
 * @param projectPath - Path of the project to filter by
 * @returns Array of agents belonging to the specified project
 */
async function getAgentsByProject(projectPath: string): Promise<UnifiedAgent[]> {
  const agents = await loadAgents();
  return agents.filter((a) => a.projectPath === projectPath);
}

/**
 * Get agents sorted by last activity
 *
 * @param limit - Optional limit on number of agents returned
 * @returns Array of agents sorted by lastActiveAt descending
 */
async function getRecentAgents(limit?: number): Promise<UnifiedAgent[]> {
  const agents = await loadAgents();
  const sorted = agents.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Update SDK session ID for an agent
 *
 * @param agentId - Agent identifier
 * @param sdkSessionId - Claude SDK session ID
 */
async function updateAgentSdkSession(
  agentId: string,
  sdkSessionId: string
): Promise<void> {
  await updateAgent(agentId, { sdkSessionId, lastActiveAt: Date.now() });
}

// ============================================
// Session CRUD Operations
// ============================================

/**
 * Load all agent sessions from storage
 *
 * @returns Array of agent sessions (empty array if storage is empty or corrupted)
 */
export async function loadAgentSessions(): Promise<AgentSession[]> {
  try {
    const store = await getStore();

    // Brain: fix-automation-session-title-missing
    // Skip reload if a write was recently done — prevents race condition where
    // store.reload() overwrites in-memory data before store.save() completes,
    // causing fields like title/status to be lost from newly created sessions.
    if (!sessionWriteLock.shouldSkipReload()) {
      try {
        await store.reload();
        console.log("[unifiedAgentStorage] Store reloaded from disk");
      } catch (reloadError) {
        console.warn("[unifiedAgentStorage] Failed to reload sessions from disk:", reloadError);
      }
    }

    const stored = await store.get<AgentSession[]>(SESSIONS_KEY);
    console.log(`[unifiedAgentStorage] Got ${stored ? (Array.isArray(stored) ? stored.length : 'non-array') : 'null'} sessions from store`);

    // Handle empty storage
    if (!stored) {
      console.log("[unifiedAgentStorage] No sessions found in storage");
      return [];
    }

    // Validate array structure
    if (!Array.isArray(stored)) {
      console.error("[unifiedAgentStorage] Storage corruption: sessions is not an array", typeof stored);
      toast.error("Session storage corrupted - resetting to clean state");
      await store.delete(SESSIONS_KEY);
      await store.save();
      return [];
    }

    // Validate each session
    const validated = stored.filter((session: unknown) => {
      if (!session || typeof session !== 'object') {
        console.warn("[unifiedAgentStorage] Skipping invalid session entry:", session);
        return false;
      }
      const s = session as Record<string, unknown>;
      if (!s.id || !s.title || !s.agentId || !s.status) {
        console.warn("[unifiedAgentStorage] Skipping session missing required fields:", session);
        return false;
      }
      if (!['todo', 'in_progress', 'done'].includes(s.status as string)) {
        console.warn("[unifiedAgentStorage] Skipping session with invalid status:", session);
        return false;
      }
      return true;
    }) as AgentSession[];

    if (validated.length !== stored.length) {
      console.warn(
        `[unifiedAgentStorage] Filtered out ${stored.length - validated.length} corrupted session entries`
      );
    }

    console.log(`[unifiedAgentStorage] Loaded ${validated.length} sessions`);
    return validated;
  } catch (error) {
    console.error("[unifiedAgentStorage] Critical error loading sessions:", error);
    toast.error("Failed to load sessions - starting fresh");
    return [];
  }
}

/**
 * Save all agent sessions to storage
 *
 * @param sessions - Array of agent sessions to persist
 */
export async function saveAgentSessions(sessions: AgentSession[]): Promise<void> {
  try {
    // Brain: fix-automation-session-title-missing
    // Defense-in-depth: detect and warn about sessions with missing required fields
    // This should never happen, but catches race conditions before they corrupt disk data
    for (const s of sessions) {
      if (!s.title || !s.status) {
        console.warn(`[unifiedAgentStorage] ⚠️ Saving session ${s.id} with missing fields: title="${s.title}", status="${s.status}"`);
      }
    }

    const store = await getStore();
    await store.set(SESSIONS_KEY, sessions);
    await store.save();
    console.log(`[unifiedAgentStorage] Saved ${sessions.length} sessions`);
  } catch (error) {
    console.error("[unifiedAgentStorage] Failed to save sessions:", error);
    toast.error("Failed to save session data");
  }
}

// ============================================
// Migration from Legacy Storage
// ============================================

/**
 * Legacy terminal metadata structure
 */
interface LegacyTerminalMetadata {
  id: string;
  label: string;
  color: string;
  cwd: string;
  workingOn?: string;
  avatar?: string;
  branch?: string;
  personality?: Partial<AgentPersonality>;
}

/**
 * Legacy AgentChat structure
 */
interface LegacyAgentChat {
  id: string;
  name: string;
  color: string;
  cwd: string;
  createdAt: number;
  avatar?: string;
  personality?: AgentPersonality;
  sessionId?: string;
}

/**
 * Legacy session map structure
 */
interface LegacyAgentSessionMap {
  [agentId: string]: string;
}

/**
 * Migrate data from legacy storage files
 *
 * This function reads from:
 * - quack-terminals.json (terminal metadata)
 * - quack-agent-chats.json (agent chat configs)
 * - quack-agent-sessions.json (session mappings)
 *
 * And consolidates into quack-agents.json
 *
 * @returns Number of agents migrated
 */
export async function migrateFromLegacy(): Promise<number> {
  console.log("[unifiedAgentStorage] Starting migration from legacy storage...");

  // Check if already migrated (agents exist)
  const existingAgents = await loadAgents();
  if (existingAgents.length > 0) {
    console.log("[unifiedAgentStorage] Migration skipped: agents already exist");
    return 0;
  }

  const migratedAgents: UnifiedAgent[] = [];
  const seenIds = new Set<string>();

  try {
    // 1. Migrate from quack-terminals.json
    try {
      const terminalsStore = await Store.load(
        getTestModeStoreName(LEGACY_FILES.terminals)
      );
      const terminals = await terminalsStore.get<LegacyTerminalMetadata[]>("terminals");

      if (terminals && Array.isArray(terminals)) {
        for (const term of terminals) {
          if (!term.id || seenIds.has(term.id)) continue;
          seenIds.add(term.id);

          // Extract project name from cwd
          const projectName = term.cwd?.split("/").pop() ?? "Unknown";

          migratedAgents.push({
            id: term.id,
            name: term.label,
            projectPath: term.cwd || "",
            projectName,
            color: term.color || "#6366f1",
            avatar: term.avatar,
            personality: term.personality as AgentPersonality | undefined,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
          });
        }
        console.log(`[unifiedAgentStorage] Migrated ${terminals.length} terminals`);
      }
    } catch (e) {
      console.warn("[unifiedAgentStorage] No terminals to migrate:", e);
    }

    // 2. Migrate from quack-agent-chats.json
    try {
      const agentChatsStore = await Store.load(
        getTestModeStoreName(LEGACY_FILES.agentChats)
      );
      const agentChats = await agentChatsStore.get<LegacyAgentChat[]>("agentChats");

      if (agentChats && Array.isArray(agentChats)) {
        for (const chat of agentChats) {
          if (!chat.id || seenIds.has(chat.id)) continue;
          seenIds.add(chat.id);

          const projectName = chat.cwd?.split("/").pop() ?? "Unknown";

          migratedAgents.push({
            id: chat.id,
            name: chat.name,
            projectPath: chat.cwd || "",
            projectName,
            color: chat.color || "#6366f1",
            avatar: chat.avatar,
            personality: chat.personality,
            sdkSessionId: chat.sessionId,
            createdAt: chat.createdAt || Date.now(),
            lastActiveAt: chat.createdAt || Date.now(),
          });
        }
        console.log(`[unifiedAgentStorage] Migrated ${agentChats.length} agent chats`);
      }
    } catch (e) {
      console.warn("[unifiedAgentStorage] No agent chats to migrate:", e);
    }

    // 3. Update with session IDs from quack-agent-sessions.json
    try {
      const sessionsStore = await Store.load(
        getTestModeStoreName(LEGACY_FILES.agentSessions)
      );
      const sessionMap = await sessionsStore.get<LegacyAgentSessionMap>(
        "agentSessionMap"
      );

      if (sessionMap && typeof sessionMap === "object") {
        for (const [agentId, sessionId] of Object.entries(sessionMap)) {
          const agent = migratedAgents.find((a) => a.id === agentId);
          if (agent && !agent.sdkSessionId) {
            agent.sdkSessionId = sessionId;
          }
        }
        console.log(
          `[unifiedAgentStorage] Updated ${Object.keys(sessionMap).length} session mappings`
        );
      }
    } catch (e) {
      console.warn("[unifiedAgentStorage] No session mappings to migrate:", e);
    }

    // Save migrated agents
    if (migratedAgents.length > 0) {
      await saveAgents(migratedAgents);
      console.log(
        `[unifiedAgentStorage] Migration complete: ${migratedAgents.length} agents migrated`
      );
      toast.success(`Migrated ${migratedAgents.length} agents to unified storage`);
    } else {
      console.log("[unifiedAgentStorage] No legacy data found to migrate");
    }

    return migratedAgents.length;
  } catch (error) {
    console.error("[unifiedAgentStorage] Migration failed:", error);
    toast.error("Failed to migrate legacy agent data");
    return 0;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Clear all agent data (for testing or reset)
 */
async function clearAllAgents(): Promise<void> {
  try {
    const store = await getStore();
    await store.clear();
    await store.save();
    console.log("[unifiedAgentStorage] Cleared all agent data");
    toast.success("Agent data cleared");
  } catch (error) {
    console.error("[unifiedAgentStorage] Failed to clear agent data:", error);
    toast.error("Failed to clear agent data");
  }
}

/**
 * Get storage statistics for debugging
 */
async function getStorageStats(): Promise<{
  agentCount: number;
  version: number;
  projectPaths: string[];
}> {
  try {
    const store = await getStore();
    const agents = await store.get<UnifiedAgent[]>(AGENTS_KEY);
    const version = (await store.get<number>(VERSION_KEY)) ?? 0;

    const projectPaths = [
      ...new Set((agents ?? []).map((a) => a.projectPath).filter(Boolean)),
    ];

    return {
      agentCount: agents?.length ?? 0,
      version,
      projectPaths,
    };
  } catch (error) {
    console.error("[unifiedAgentStorage] Failed to get storage stats:", error);
    return { agentCount: 0, version: 0, projectPaths: [] };
  }
}

/**
 * Export agents to JSON (for backup)
 */
async function exportAgents(): Promise<string> {
  const agents = await loadAgents();
  const sessions = await loadAgentSessions();
  const store: UnifiedAgentStore = {
    agents,
    sessions,
    version: CURRENT_VERSION,
  };
  return JSON.stringify(store, null, 2);
}

/**
 * Import agents from JSON (for restore)
 *
 * @param jsonString - JSON string with UnifiedAgentStore structure
 * @param mergeWithExisting - If true, merge with existing agents; if false, replace all
 */
async function importAgents(
  jsonString: string,
  mergeWithExisting = true
): Promise<number> {
  try {
    const imported = JSON.parse(jsonString) as UnifiedAgentStore;

    if (!imported.agents || !Array.isArray(imported.agents)) {
      throw new Error("Invalid import format: agents array not found");
    }

    // Validate all imported agents
    const validAgents = imported.agents.filter(isValidAgent);

    if (validAgents.length !== imported.agents.length) {
      console.warn(
        `[unifiedAgentStorage] Import: ${imported.agents.length - validAgents.length} invalid agents skipped`
      );
    }

    if (mergeWithExisting) {
      const existingAgents = await loadAgents();
      const existingIds = new Set(existingAgents.map((a) => a.id));

      // Add only new agents (skip duplicates)
      const newAgents = validAgents.filter((a) => !existingIds.has(a.id));
      await saveAgents([...existingAgents, ...newAgents]);

      console.log(`[unifiedAgentStorage] Imported ${newAgents.length} new agents (merged)`);
      return newAgents.length;
    } else {
      await saveAgents(validAgents);
      console.log(`[unifiedAgentStorage] Imported ${validAgents.length} agents (replaced)`);
      return validAgents.length;
    }
  } catch (error) {
    console.error("[unifiedAgentStorage] Import failed:", error);
    toast.error("Failed to import agents");
    throw error;
  }
}
