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
import { isMacOS } from "../utils/platform";

// Storage key for keyboard shortcuts
const SHORTCUTS_KEY = "keyboardShortcuts";

/**
 * Get the primary modifier key for the current platform
 * macOS: Meta (Command key)
 * Windows/Linux: Ctrl
 */
const getPrimaryModifier = (): string => {
  return isMacOS() ? "Meta" : "Ctrl";
};

/**
 * Build shortcut string with platform-specific modifier
 */
const buildShortcut = (key: string, withShift = false): string => {
  const modifier = getPrimaryModifier();
  return withShift ? `${modifier}+Shift+${key}` : `${modifier}+${key}`;
};

/**
 * Default keyboard shortcuts configuration
 * Uses platform-specific modifiers (Meta on Mac, Ctrl on Windows/Linux)
 */
export const DEFAULT_SHORTCUTS: Record<ShortcutActionId, ShortcutConfig> = (() => {
  const shortcuts = {
    toggleKanban: {
      id: "toggleKanban" as const,
      label: "Toggle Kanban",
      description: "Switch between Agent list and Kanban board view",
      defaultKeys: buildShortcut("K"),
      currentKeys: buildShortcut("K"),
    },
    toggleAutomation: {
      id: "toggleAutomation" as const,
      label: "Toggle Automation",
      description: "Open or close the Automation scheduler view",
      defaultKeys: buildShortcut("J"),
      currentKeys: buildShortcut("J"),
    },
    toggleOffice: {
      id: "toggleOffice" as const,
      label: "Toggle Office",
      description: "Open or close the Office view",
      defaultKeys: buildShortcut("O"),
      currentKeys: buildShortcut("O"),
    },
    toggleCodeEditor: {
      id: "toggleCodeEditor" as const,
      label: "Toggle Code Editor",
      description: "Open or close the integrated code editor tab",
      defaultKeys: buildShortcut("E"),
      currentKeys: buildShortcut("E"),
    },
    toggleFeatureMap: {
      id: "toggleFeatureMap" as const,
      label: "Toggle Feature Map",
      description: "Open or close the Feature Map whiteboard",
      defaultKeys: buildShortcut("M", true),
      currentKeys: buildShortcut("M", true),
    },
    openTerminalWindow: {
      id: "openTerminalWindow" as const,
      label: "Terminal Window",
      description: "Open the Terminal Window application",
      defaultKeys: buildShortcut("T"),
      currentKeys: buildShortcut("T"),
    },
    newAgent: {
      id: "newAgent" as const,
      label: "New Agent",
      description: "Create a new agent",
      defaultKeys: buildShortcut("N"),
      currentKeys: buildShortcut("N"),
    },
    toggleSidePanel: {
      id: "toggleSidePanel" as const,
      label: "Toggle Side Panel",
      description: "Show or hide the right side panel",
      defaultKeys: buildShortcut("B"),
      currentKeys: buildShortcut("B"),
    },
    focusFileSearch: {
      id: "focusFileSearch" as const,
      label: "Focus File Search",
      description: "Focus the File Explorer search input",
      defaultKeys: buildShortcut("F"),
      currentKeys: buildShortcut("F"),
    },
    newKanbanTask: {
      id: "newKanbanTask" as const,
      label: "New Kanban Task",
      description: "Create a new task in Kanban view",
      defaultKeys: buildShortcut("N", true),
      currentKeys: buildShortcut("N", true),
    },
    chatAttachFile: {
      id: "chatAttachFile" as const,
      label: "Attach File",
      description: "Open file picker to attach files",
      defaultKeys: buildShortcut("U"),
      currentKeys: buildShortcut("U"),
    },
    chatMentionAgent: {
      id: "chatMentionAgent" as const,
      label: "Mention Agent",
      description: "Mention an agent in the chat",
      defaultKeys: buildShortcut("M"),
      currentKeys: buildShortcut("M"),
    },
    chatToggleLock: {
      id: "chatToggleLock" as const,
      label: "Toggle Agent Lock",
      description: "Lock or unlock current agent",
      defaultKeys: buildShortcut("L"),
      currentKeys: buildShortcut("L"),
    },
    chatToggleFullscreen: {
      id: "chatToggleFullscreen" as const,
      label: "Toggle Fullscreen",
      description: "Open fullscreen compose mode",
      defaultKeys: buildShortcut("F", true),
      currentKeys: buildShortcut("F", true),
    },
    chatVoiceRecord: {
      id: "chatVoiceRecord" as const,
      label: "Voice Record",
      description: "Start voice recording",
      defaultKeys: buildShortcut("V", true),
      currentKeys: buildShortcut("V", true),
    },
    chatSendMessage: {
      id: "chatSendMessage" as const,
      label: "Send Message",
      description: "Send the current message",
      defaultKeys: `${getPrimaryModifier()}+Enter`,
      currentKeys: `${getPrimaryModifier()}+Enter`,
    },
    chatOpenSnippets: {
      id: "chatOpenSnippets" as const,
      label: "Open Snippets",
      description: "Open snippets panel",
      defaultKeys: buildShortcut("S", true),
      currentKeys: buildShortcut("S", true),
    },
    chatOpenDroids: {
      id: "chatOpenDroids" as const,
      label: "Open Droids",
      description: "Open droids panel",
      defaultKeys: buildShortcut("D"),
      currentKeys: buildShortcut("D"),
    },
    chatOpenCommands: {
      id: "chatOpenCommands" as const,
      label: "Open Commands",
      description: "Open commands panel",
      defaultKeys: buildShortcut("/"),
      currentKeys: buildShortcut("/"),
    },
    chatInsertXml: {
      id: "chatInsertXml" as const,
      label: "Insert XML Tag",
      description: "Insert smart XML tag at cursor",
      defaultKeys: buildShortcut("X", true),
      currentKeys: buildShortcut("X", true),
    },
    chatNewLine: {
      id: "chatNewLine" as const,
      label: "New Line with _",
      description: "Insert new line with underscore prefix",
      defaultKeys: buildShortcut("L", true),
      currentKeys: buildShortcut("L", true),
    },
    toggleSidebarView: {
      id: "toggleSidebarView" as const,
      label: "Toggle Sidebar View",
      description: "Switch between Projects and Task Hub view",
      defaultKeys: buildShortcut("E"),
      currentKeys: buildShortcut("E"),
    },
    toggleBTW: {
      id: "toggleBTW" as const,
      label: "Toggle BTW",
      description: "Open BTW side-chain quick question drawer",
      defaultKeys: "Ctrl+B",
      currentKeys: "Ctrl+B",
    },
  };
  return shortcuts;
})();

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
