/**
 * Terminal Storage Service
 *
 * Handles all terminal-related storage operations using Tauri Store plugin.
 * Extracted from App.tsx for better separation of concerns and testability.
 *
 * NEW: Uses .quack/active-agents.json as the source of truth for active agents,
 * ensuring consistency between dev and build environments.
 *
 * @module terminalStorage
 */

import { Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { getTestModeStoreName } from "../utils/testModeStorage";
import type { TerminalInfo, NativeTerminal, AgentPersonality } from "../types";
import type { Tab } from "../components/TabBar";

// ============================================
// Types
// ============================================

/**
 * Terminal metadata stored in persistent storage
 */
export interface TerminalMetadata {
  id: string;
  label: string;
  color: string;
  cwd: string;
  workingOn?: string;
  avatar?: string;
  branch?: string;
  personality?: Partial<any>; // AgentPersonality
}

// ============================================
// Storage Keys
// ============================================

export const STORAGE_KEY = "terminals";
export const TABS_BY_TERMINAL_KEY = "tabsByTerminal";
export const NATIVE_TERMINALS_STORAGE_KEY = "nativeTerminals";

// ============================================
// Terminal Storage Functions
// ============================================

/**
 * Save terminals to persistent storage
 * @param terminals Array of terminal information to save
 */
export const saveTerminalsToStorage = async (terminals: TerminalInfo[]): Promise<void> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
    // Save terminal metadata including personality AND ID for persistence
    const metadata: TerminalMetadata[] = terminals.map((t) => ({
      id: t.id, // ✅ CRITICAL FIX: Save ID to preserve personality linkage!
      label: t.label,
      color: t.color,
      cwd: t.cwd,
      workingOn: t.workingOn,
      avatar: t.avatar,
      branch: t.branch,
      personality: t.personality, // Include personality traits
    }));
    await store.set(STORAGE_KEY, metadata);
    await store.save();
    console.log(`[terminalStorage] Saved ${metadata.length} terminals with personality data`);
  } catch (error) {
    console.warn("[terminalStorage] Unable to save terminals", error);
  }
};

/**
 * Load terminals from persistent storage
 * @returns Array of terminal metadata, empty array if none found or error occurs
 */
export const loadTerminalsFromStorage = async (): Promise<TerminalMetadata[]> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
    const stored = await store.get<TerminalMetadata[]>(STORAGE_KEY);

    // ✅ DEFENSIVE: Validate data structure before returning
    if (!stored) {
      return [];
    }

    if (!Array.isArray(stored)) {
      console.error("[terminalStorage] 🦆 Storage corruption detected: terminals is not an array", typeof stored);
      toast.error("Terminal storage corrupted - resetting to clean state");
      // Clear corrupted data
      await store.delete(STORAGE_KEY);
      await store.save();
      return [];
    }

    // ✅ DEFENSIVE: Validate each terminal has required fields
    const validated = stored.filter((t: any) => {
      if (!t || typeof t !== 'object') {
        console.warn("[terminalStorage] 🦆 Skipping invalid terminal entry:", t);
        return false;
      }
      if (!t.id || !t.label) {
        console.warn("[terminalStorage] 🦆 Skipping terminal missing id/label:", t);
        return false;
      }
      return true;
    });

    if (validated.length !== stored.length) {
      console.warn(`[terminalStorage] 🦆 Filtered out ${stored.length - validated.length} corrupted terminal entries`);
    }

    return validated;
  } catch (error) {
    console.error("[terminalStorage] 🦆 Critical error loading terminals:", error);
    toast.error("Failed to load terminals - starting fresh");
    return [];
  }
};

// ============================================
// Tabs per Terminal Storage Functions
// ============================================

/**
 * Save tabs mapping (terminalId -> Tab[]) to persistent storage
 * @param tabsByTerminal Map of terminal IDs to their tabs
 */
export const saveTabsByTerminalToStorage = async (tabsByTerminal: Map<string, Tab[]>): Promise<void> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
    // Convert Map to plain object for storage
    const obj: Record<string, Tab[]> = {};
    tabsByTerminal.forEach((tabs, terminalId) => {
      obj[terminalId] = tabs;
    });
    await store.set(TABS_BY_TERMINAL_KEY, obj);
    await store.save();
    console.log(`[terminalStorage] Saved tabs for ${Object.keys(obj).length} terminals`);
  } catch (error) {
    console.error("[terminalStorage] Failed to save tabs by terminal:", error);
  }
};

/**
 * Load tabs mapping from persistent storage
 * @returns Map of terminal IDs to their tabs, empty Map if none found or error occurs
 */
export const loadTabsByTerminalFromStorage = async (): Promise<Map<string, Tab[]>> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
    const stored = await store.get<Record<string, Tab[]>>(TABS_BY_TERMINAL_KEY);

    if (!stored) {
      return new Map();
    }

    // ✅ DEFENSIVE: Validate that stored is actually an object
    if (typeof stored !== 'object' || Array.isArray(stored)) {
      console.error("[terminalStorage] 🦆 Storage corruption detected: tabsByTerminal is not an object", typeof stored);
      toast.error("Tab storage corrupted - resetting to clean state");
      await store.delete(TABS_BY_TERMINAL_KEY);
      await store.save();
      return new Map();
    }

    // ✅ DEFENSIVE: Wrap Object.entries in try-catch to handle edge cases
    try {
      const map = new Map<string, Tab[]>();
      Object.entries(stored).forEach(([terminalId, tabs]) => {
        // Validate each entry
        if (typeof terminalId === 'string' && Array.isArray(tabs)) {
          map.set(terminalId, tabs);
        } else {
          console.warn("[terminalStorage] 🦆 Skipping invalid tab entry for terminal:", terminalId);
        }
      });
      console.log(`[terminalStorage] Loaded tabs for ${map.size} terminals from storage`);
      return map;
    } catch (entriesError) {
      console.error("[terminalStorage] 🦆 Error parsing tabsByTerminal entries:", entriesError);
      toast.error("Tab storage parsing failed - resetting");
      await store.delete(TABS_BY_TERMINAL_KEY);
      await store.save();
      return new Map();
    }
  } catch (error) {
    console.error("[terminalStorage] 🦆 Critical error loading tabs by terminal:", error);
    toast.error("Failed to load tabs - starting fresh");
    return new Map();
  }
};

// ============================================
// Native Terminal Storage Functions
// ============================================

/**
 * Save native terminals to persistent storage
 * @param terminals Array of native terminal information to save
 */
export const saveNativeTerminalsToStorage = async (terminals: NativeTerminal[]): Promise<void> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
    // Mark all as closed on save (they might not be running when app restarts)
    const metadata = terminals.map((t) => ({
      ...t,
      isOpen: false,
      pid: undefined,
    }));
    await store.set(NATIVE_TERMINALS_STORAGE_KEY, metadata);
    await store.save();
    console.log(`[terminalStorage] Saved ${metadata.length} native terminals`);
  } catch (error) {
    console.warn("[terminalStorage] Unable to save native terminals", error);
  }
};

/**
 * Load native terminals from persistent storage
 * @returns Array of native terminal information, empty array if none found or error occurs
 */
export const loadNativeTerminalsFromStorage = async (): Promise<NativeTerminal[]> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
    const stored = await store.get<NativeTerminal[]>(NATIVE_TERMINALS_STORAGE_KEY);

    // ✅ DEFENSIVE: Validate data structure before returning
    if (!stored) {
      return [];
    }

    if (!Array.isArray(stored)) {
      console.error("[terminalStorage] 🦆 Storage corruption detected: nativeTerminals is not an array", typeof stored);
      toast.error("Native terminal storage corrupted - resetting to clean state");
      await store.delete(NATIVE_TERMINALS_STORAGE_KEY);
      await store.save();
      return [];
    }

    // ✅ DEFENSIVE: Validate each native terminal has required fields
    const validated = stored.filter((t: any) => {
      if (!t || typeof t !== 'object') {
        console.warn("[terminalStorage] 🦆 Skipping invalid native terminal entry:", t);
        return false;
      }
      if (!t.id || !t.name) {
        console.warn("[terminalStorage] 🦆 Skipping native terminal missing id/name:", t);
        return false;
      }
      return true;
    });

    if (validated.length !== stored.length) {
      console.warn(`[terminalStorage] 🦆 Filtered out ${stored.length - validated.length} corrupted native terminal entries`);
    }

    return validated;
  } catch (error) {
    console.error("[terminalStorage] 🦆 Critical error loading native terminals:", error);
    toast.error("Failed to load native terminals - starting fresh");
    return [];
  }
};

// ============================================
// Active Agents Index Functions (File-based)
// ============================================

/**
 * Load active agent IDs from the project's .quack/active-agents.json
 * This is the new source of truth for which agents are "open"
 * @param projectPath The project path to load active agents for
 */
export const loadActiveAgentIds = async (projectPath: string): Promise<string[]> => {
  try {
    const ids = await invoke<string[]>('load_active_agents', { projectPath });
    console.log(`[terminalStorage] Loaded ${ids.length} active agents from ${projectPath}`);
    return ids;
  } catch (error) {
    console.warn("[terminalStorage] Could not load active agents index:", error);
    return [];
  }
};

/**
 * Save active agent IDs to the project's .quack/active-agents.json
 * @param projectPath The project path
 * @param agentIds Array of agent IDs that are currently active
 */
export const saveActiveAgentIds = async (projectPath: string, agentIds: string[]): Promise<void> => {
  try {
    await invoke('save_active_agents', { projectPath, agentIds });
    console.log(`[terminalStorage] Saved ${agentIds.length} active agents to ${projectPath}`);
  } catch (error) {
    console.error("[terminalStorage] Failed to save active agents index:", error);
  }
};

/**
 * Add an agent to the active index
 * @param projectPath The project path
 * @param agentId The agent ID to add
 */
export const addActiveAgent = async (projectPath: string, agentId: string): Promise<void> => {
  try {
    await invoke('add_active_agent', { projectPath, agentId });
    console.log(`[terminalStorage] Added agent ${agentId} to active index`);
  } catch (error) {
    console.error("[terminalStorage] Failed to add active agent:", error);
  }
};

/**
 * Remove an agent from the active index
 * @param projectPath The project path
 * @param agentId The agent ID to remove
 */
export const removeActiveAgent = async (projectPath: string, agentId: string): Promise<void> => {
  try {
    await invoke('remove_active_agent', { projectPath, agentId });
    console.log(`[terminalStorage] Removed agent ${agentId} from active index`);
  } catch (error) {
    console.error("[terminalStorage] Failed to remove active agent:", error);
  }
};

/**
 * Load active agents with full personality data
 * @param projectPath The project path
 */
export const loadActiveAgentsWithData = async (projectPath: string): Promise<AgentPersonality[]> => {
  try {
    const agents = await invoke<AgentPersonality[]>('load_active_agents_with_data', { projectPath });
    console.log(`[terminalStorage] Loaded ${agents.length} active agents with personality data`);
    return agents;
  } catch (error) {
    console.error("[terminalStorage] Failed to load active agents with data:", error);
    return [];
  }
};

/**
 * Migrate from old Tauri store to new file-based index
 * This runs once per project when upgrading from the old system
 * @param projectPath The project path to migrate
 */
export const migrateToActiveAgentsIndex = async (projectPath: string): Promise<string[]> => {
  // Check if the new index already exists (already migrated)
  const existingIds = await loadActiveAgentIds(projectPath);
  if (existingIds.length > 0) {
    console.log(`[terminalStorage] Project ${projectPath} already migrated, found ${existingIds.length} active agents`);
    return existingIds;
  }

  // Try to migrate from old Tauri store
  console.log(`[terminalStorage] Migrating project ${projectPath} to active-agents.json...`);

  const oldTerminals = await loadTerminalsFromStorage();
  const projectTerminals = oldTerminals.filter(t => t.cwd === projectPath);

  if (projectTerminals.length > 0) {
    const agentIds = projectTerminals.map(t => t.id);
    await saveActiveAgentIds(projectPath, agentIds);
    console.log(`[terminalStorage] Migrated ${agentIds.length} agents from old storage to ${projectPath}`);
    return agentIds;
  }

  console.log(`[terminalStorage] No agents to migrate for ${projectPath}`);
  return [];
};
