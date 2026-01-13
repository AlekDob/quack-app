/**
 * Session Storage Service
 *
 * Handles persistent storage of AgentSessions using Tauri Store.
 * Sessions are stored globally and persist across app restarts.
 *
 * @module sessionStorage
 */

import { Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import type { AgentSession } from "../types";
import { getTestModeStoreName } from "../utils/testModeStorage";

// Storage key for agent sessions
const AGENT_SESSIONS_KEY = "agentSessions";

/**
 * Saves agent sessions to persistent storage
 *
 * @param sessions - Array of AgentSession objects to persist
 *
 * @example
 * ```typescript
 * const sessions: AgentSession[] = [
 *   { id: "session-1", title: "Fix auth bug", agentId: "agent-1", ... }
 * ];
 * await saveAgentSessions(sessions);
 * ```
 */
export const saveAgentSessions = async (sessions: AgentSession[]): Promise<void> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-sessions.json"));
    await store.set(AGENT_SESSIONS_KEY, sessions);
    await store.save();
    console.log(`[sessionStorage] Saved ${sessions.length} agent sessions`);
  } catch (error) {
    console.error("[sessionStorage] Failed to save agent sessions:", error);
    toast.error("Failed to save agent sessions");
  }
};

/**
 * Loads agent sessions from persistent storage with defensive validation
 *
 * Features:
 * - Forces reload from disk to catch external changes
 * - Validates data structure (must be array)
 * - Filters out corrupted/invalid entries
 * - Auto-cleans storage on corruption detection
 * - Returns empty array on critical errors
 *
 * @returns Promise resolving to validated array of AgentSession objects
 *
 * @example
 * ```typescript
 * const sessions = await loadAgentSessions();
 * console.log(`Loaded ${sessions.length} agent sessions`);
 * ```
 */
export const loadAgentSessions = async (): Promise<AgentSession[]> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-agent-sessions.json"));

    // IMPORTANT: Force reload from disk to catch external changes
    try {
      await store.reload();
    } catch (reloadError) {
      console.warn("[sessionStorage] Failed to reload from disk:", reloadError);
      // Continue with cached data if reload fails
    }

    const stored = await store.get<AgentSession[]>(AGENT_SESSIONS_KEY);

    // Defensive: Validate data structure before returning
    if (!stored) {
      return [];
    }

    if (!Array.isArray(stored)) {
      console.error("[sessionStorage] Storage corruption detected: agentSessions is not an array", typeof stored);
      toast.error("Session storage corrupted - resetting to clean state");
      await store.delete(AGENT_SESSIONS_KEY);
      await store.save();
      return [];
    }

    // Defensive: Validate each session has required fields
    const validated = stored.filter((session: unknown) => {
      if (!session || typeof session !== 'object') {
        console.warn("[sessionStorage] Skipping invalid session entry:", session);
        return false;
      }
      const s = session as Record<string, unknown>;
      if (!s.id || !s.title || !s.agentId || !s.status) {
        console.warn("[sessionStorage] Skipping session missing required fields:", session);
        return false;
      }
      // Validate status is valid
      if (!['todo', 'in_progress', 'done'].includes(s.status as string)) {
        console.warn("[sessionStorage] Skipping session with invalid status:", session);
        return false;
      }
      return true;
    }) as AgentSession[];

    if (validated.length !== stored.length) {
      console.warn(`[sessionStorage] Filtered out ${stored.length - validated.length} corrupted entries`);
    }

    console.log(`[sessionStorage] Loaded ${validated.length} agent sessions`);
    return validated;
  } catch (error) {
    console.error("[sessionStorage] Critical error loading agent sessions:", error);
    toast.error("Failed to load agent sessions - starting fresh");
    return [];
  }
};

/**
 * Gets sessions filtered by agent ID
 *
 * @param agentId - ID of the agent to filter by
 * @returns Array of sessions belonging to the specified agent
 */
export const getSessionsByAgent = async (agentId: string): Promise<AgentSession[]> => {
  const sessions = await loadAgentSessions();
  return sessions.filter(s => s.agentId === agentId);
};

/**
 * Gets sessions filtered by project path
 *
 * @param projectPath - Path of the project to filter by
 * @returns Array of sessions belonging to the specified project
 */
export const getSessionsByProject = async (projectPath: string): Promise<AgentSession[]> => {
  const sessions = await loadAgentSessions();
  return sessions.filter(s => s.projectPath === projectPath);
};

/**
 * Updates a specific session in storage
 *
 * @param sessionId - ID of the session to update
 * @param updates - Partial session object with fields to update
 */
export const updateAgentSession = async (
  sessionId: string,
  updates: Partial<AgentSession>
): Promise<void> => {
  try {
    const sessions = await loadAgentSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) {
      console.warn(`[sessionStorage] Session ${sessionId} not found for update`);
      return;
    }
    sessions[index] = { ...sessions[index], ...updates, updatedAt: Date.now() };
    await saveAgentSessions(sessions);
    console.log(`[sessionStorage] Updated session ${sessionId}`);
  } catch (error) {
    console.error("[sessionStorage] Failed to update session:", error);
    toast.error("Failed to update session");
  }
};

/**
 * Deletes a specific session from storage
 *
 * @param sessionId - ID of the session to delete
 */
export const deleteAgentSession = async (sessionId: string): Promise<void> => {
  try {
    const sessions = await loadAgentSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    await saveAgentSessions(filtered);
    console.log(`[sessionStorage] Deleted session ${sessionId}`);
  } catch (error) {
    console.error("[sessionStorage] Failed to delete session:", error);
    toast.error("Failed to delete session");
  }
};
