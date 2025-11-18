/**
 * Terminal Storage Service
 *
 * Handles all terminal-related storage operations using Tauri Store plugin.
 * Extracted from App.tsx for better separation of concerns and testability.
 *
 * @module terminalStorage
 */

import { Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import { getTestModeStoreName } from "../utils/testModeStorage";
import type { TerminalInfo, NativeTerminal, Tab } from "../types";

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

const STORAGE_KEY = "terminals";
const TABS_BY_TERMINAL_KEY = "tabsByTerminal";
const NATIVE_TERMINALS_STORAGE_KEY = "nativeTerminals";

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
