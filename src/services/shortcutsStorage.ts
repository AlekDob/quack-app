/**
 * Keyboard Shortcuts Storage Service
 *
 * Handles persistent storage of custom keyboard shortcuts using Tauri Store.
 * Shortcuts are stored globally and persist across app restarts.
 *
 * @module shortcutsStorage
 */

import { Store } from "@tauri-apps/plugin-store";
import type { ShortcutConfig, ShortcutActionId } from "../types";
import { getTestModeStoreName } from "../utils/testModeStorage";

// Storage key for keyboard shortcuts
const SHORTCUTS_KEY = "keyboardShortcuts";

/**
 * Default keyboard shortcuts configuration
 */
export const DEFAULT_SHORTCUTS: Record<ShortcutActionId, ShortcutConfig> = {
  toggleKanban: {
    id: "toggleKanban",
    label: "Toggle Kanban",
    description: "Switch between Agent list and Kanban board view",
    defaultKeys: "Meta+K",
    currentKeys: "Meta+K",
  },
  openTerminalWindow: {
    id: "openTerminalWindow",
    label: "Terminal Window",
    description: "Open the Terminal Window application",
    defaultKeys: "Meta+T",
    currentKeys: "Meta+T",
  },
  newAgent: {
    id: "newAgent",
    label: "New Agent",
    description: "Create a new agent",
    defaultKeys: "Meta+N",
    currentKeys: "Meta+N",
  },
  toggleSidePanel: {
    id: "toggleSidePanel",
    label: "Toggle Side Panel",
    description: "Show or hide the right side panel",
    defaultKeys: "Meta+B",
    currentKeys: "Meta+B",
  },
  focusFileSearch: {
    id: "focusFileSearch",
    label: "Focus File Search",
    description: "Focus the File Explorer search input",
    defaultKeys: "Meta+F",
    currentKeys: "Meta+F",
  },
  newKanbanTask: {
    id: "newKanbanTask",
    label: "New Kanban Task",
    description: "Create a new task in Kanban view",
    defaultKeys: "Meta+Shift+N",
    currentKeys: "Meta+Shift+N",
  },
  chatAttachFile: {
    id: "chatAttachFile",
    label: "Attach File",
    description: "Open file picker to attach files",
    defaultKeys: "Meta+U",
    currentKeys: "Meta+U",
  },
  chatMentionAgent: {
    id: "chatMentionAgent",
    label: "Mention Agent",
    description: "Mention an agent in the chat",
    defaultKeys: "Meta+M",
    currentKeys: "Meta+M",
  },
  chatToggleLock: {
    id: "chatToggleLock",
    label: "Toggle Agent Lock",
    description: "Lock or unlock current agent",
    defaultKeys: "Meta+L",
    currentKeys: "Meta+L",
  },
  chatToggleFullscreen: {
    id: "chatToggleFullscreen",
    label: "Toggle Fullscreen",
    description: "Open fullscreen compose mode",
    defaultKeys: "Meta+Shift+F",
    currentKeys: "Meta+Shift+F",
  },
  chatVoiceRecord: {
    id: "chatVoiceRecord",
    label: "Voice Record",
    description: "Start voice recording",
    defaultKeys: "Meta+Shift+V",
    currentKeys: "Meta+Shift+V",
  },
  chatSendMessage: {
    id: "chatSendMessage",
    label: "Send Message",
    description: "Send the current message",
    defaultKeys: "Meta+Enter",
    currentKeys: "Meta+Enter",
  },
  chatOpenSnippets: {
    id: "chatOpenSnippets",
    label: "Open Snippets",
    description: "Open snippets panel",
    defaultKeys: "Meta+Shift+S",
    currentKeys: "Meta+Shift+S",
  },
  chatOpenDroids: {
    id: "chatOpenDroids",
    label: "Open Droids",
    description: "Open droids panel",
    defaultKeys: "Meta+D",
    currentKeys: "Meta+D",
  },
  chatOpenCommands: {
    id: "chatOpenCommands",
    label: "Open Commands",
    description: "Open commands panel",
    defaultKeys: "Meta+/",
    currentKeys: "Meta+/",
  },
};

/**
 * Saves keyboard shortcuts to persistent storage
 *
 * @param shortcuts - Record of ShortcutConfig objects to persist
 *
 * @example
 * ```typescript
 * await saveShortcuts({
 *   toggleKanban: { ...config, currentKeys: "Meta+Shift+K" }
 * });
 * ```
 */
export const saveShortcuts = async (
  shortcuts: Record<ShortcutActionId, ShortcutConfig>
): Promise<void> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-keyboard-shortcuts.json"));
    await store.set(SHORTCUTS_KEY, shortcuts);
    await store.save();
    console.log("[shortcutsStorage] Saved keyboard shortcuts");
  } catch (error) {
    console.error("[shortcutsStorage] Failed to save shortcuts:", error);
  }
};

/**
 * Loads keyboard shortcuts from persistent storage
 *
 * Features:
 * - Returns default shortcuts if none are stored
 * - Merges stored shortcuts with defaults to handle new shortcuts
 * - Validates data structure
 *
 * @returns Promise resolving to Record of ShortcutConfig objects
 */
export const loadShortcuts = async (): Promise<Record<ShortcutActionId, ShortcutConfig>> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-keyboard-shortcuts.json"));

    // Try to reload from disk in case of external changes
    try {
      await store.reload();
    } catch (reloadError) {
      console.warn("[shortcutsStorage] Failed to reload from disk:", reloadError);
    }

    const stored = await store.get<Record<ShortcutActionId, ShortcutConfig>>(SHORTCUTS_KEY);

    if (!stored || typeof stored !== "object") {
      console.log("[shortcutsStorage] No stored shortcuts, using defaults");
      return { ...DEFAULT_SHORTCUTS };
    }

    // Merge stored shortcuts with defaults (in case new shortcuts were added)
    const merged: Record<ShortcutActionId, ShortcutConfig> = { ...DEFAULT_SHORTCUTS };
    for (const key of Object.keys(stored) as ShortcutActionId[]) {
      if (merged[key] && stored[key]) {
        merged[key] = {
          ...merged[key],
          currentKeys: stored[key].currentKeys || merged[key].defaultKeys,
        };
      }
    }

    console.log("[shortcutsStorage] Loaded keyboard shortcuts");
    return merged;
  } catch (error) {
    console.error("[shortcutsStorage] Failed to load shortcuts:", error);
    return { ...DEFAULT_SHORTCUTS };
  }
};

/**
 * Resets all shortcuts to their default values
 */
export const resetAllShortcuts = async (): Promise<Record<ShortcutActionId, ShortcutConfig>> => {
  await saveShortcuts(DEFAULT_SHORTCUTS);
  console.log("[shortcutsStorage] Reset all shortcuts to defaults");
  return { ...DEFAULT_SHORTCUTS };
};

/**
 * Resets a single shortcut to its default value
 *
 * @param id - The shortcut action ID to reset
 */
export const resetShortcut = async (
  id: ShortcutActionId
): Promise<Record<ShortcutActionId, ShortcutConfig>> => {
  const shortcuts = await loadShortcuts();
  shortcuts[id] = {
    ...shortcuts[id],
    currentKeys: shortcuts[id].defaultKeys,
  };
  await saveShortcuts(shortcuts);
  console.log(`[shortcutsStorage] Reset shortcut ${id} to default`);
  return shortcuts;
};
