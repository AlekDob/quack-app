/**
 * Keyboard Shortcuts Store
 *
 * Zustand store for managing customizable keyboard shortcuts.
 * Handles loading, updating, and resetting shortcuts with persistence.
 *
 * @module shortcutsStore
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { ShortcutConfig, ShortcutActionId } from "../types";
import {
  saveShortcuts,
  loadShortcuts,
  resetAllShortcuts as resetAllStorage,
  resetShortcut as resetSingleStorage,
  DEFAULT_SHORTCUTS,
} from "../services/shortcutsStorage";
import { isMacOS } from "../utils/platform";

interface ShortcutsState {
  // State
  shortcuts: Record<ShortcutActionId, ShortcutConfig>;
  isLoading: boolean;

  // Actions
  loadShortcuts: () => Promise<void>;
  updateShortcut: (id: ShortcutActionId, newKeys: string) => Promise<void>;
  resetShortcut: (id: ShortcutActionId) => Promise<void>;
  resetAllShortcuts: () => Promise<void>;

  // Selectors
  getShortcutByKeys: (keys: string) => ShortcutConfig | undefined;
  getConflict: (newKeys: string, excludeId: ShortcutActionId) => string | undefined;
  formatShortcut: (keys: string) => string;
}

/**
 * Format shortcut keys for display
 * macOS: Meta+K → ⌘K
 * Windows/Linux: Meta+K → Ctrl+K (readable text)
 */
const formatShortcutKeys = (keys: string): string => {
  if (!keys) return "";

  if (isMacOS()) {
    // Mac: use symbols
    return keys
      .replace(/Meta\+/gi, "⌘")
      .replace(/Ctrl\+/gi, "⌃")
      .replace(/Alt\+/gi, "⌥")
      .replace(/Shift\+/gi, "⇧")
      .replace(/\+/g, "");
  } else {
    // Windows/Linux: use readable text
    return keys
      .replace(/Meta\+/gi, "Ctrl+")
      .replace(/Ctrl\+/gi, "Ctrl+")
      .replace(/Alt\+/gi, "Alt+")
      .replace(/Shift\+/gi, "Shift+");
  }
};

export const useShortcutsStore = create<ShortcutsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        shortcuts: DEFAULT_SHORTCUTS,
        isLoading: false,

        // Load shortcuts from storage
        loadShortcuts: async () => {
          set({ isLoading: true });
          try {
            const shortcuts = await loadShortcuts();
            set({ shortcuts, isLoading: false });
            console.log("[shortcutsStore] Loaded shortcuts");
          } catch (error) {
            console.error("[shortcutsStore] Failed to load shortcuts:", error);
            set({ isLoading: false });
          }
        },

        // Update a single shortcut
        updateShortcut: async (id, newKeys) => {
          const shortcuts = { ...get().shortcuts };
          shortcuts[id] = {
            ...shortcuts[id],
            currentKeys: newKeys,
          };
          set({ shortcuts });
          await saveShortcuts(shortcuts);
          console.log(`[shortcutsStore] Updated shortcut ${id} to ${newKeys}`);
        },

        // Reset a single shortcut to default
        resetShortcut: async (id) => {
          const shortcuts = await resetSingleStorage(id);
          set({ shortcuts });
          console.log(`[shortcutsStore] Reset shortcut ${id}`);
        },

        // Reset all shortcuts to defaults
        resetAllShortcuts: async () => {
          const shortcuts = await resetAllStorage();
          set({ shortcuts });
          console.log("[shortcutsStore] Reset all shortcuts");
        },

        // Find shortcut by key combination
        getShortcutByKeys: (keys) => {
          const { shortcuts } = get();
          return Object.values(shortcuts).find((s) => s.currentKeys === keys);
        },

        // Check if a key combination conflicts with another shortcut
        getConflict: (newKeys, excludeId) => {
          const { shortcuts } = get();
          const conflict = Object.values(shortcuts).find(
            (s) => s.currentKeys === newKeys && s.id !== excludeId
          );
          return conflict?.label;
        },

        // Format shortcut for display
        formatShortcut: formatShortcutKeys,
      }),
      {
        name: "quack-shortcuts-store",
        // Only persist shortcuts, not isLoading
        partialize: (state) => ({ shortcuts: state.shortcuts }),
      }
    ),
    { name: "ShortcutsStore" }
  )
);

// Export utility function for use outside of React
export { formatShortcutKeys };
