/**
 * useGlobalKeyboardShortcuts
 *
 * Hook that listens for global keyboard shortcuts and triggers actions.
 * Respects user-configured shortcuts from the store.
 *
 * Features:
 * - Ignores shortcuts when focused in input/textarea
 * - Prevents default browser behavior for registered shortcuts
 * - Automatically loads shortcuts from storage on mount
 */

import { useEffect, useCallback } from "react";
import { useShortcutsStore } from "../stores/shortcutsStore";
import type { ShortcutActionId } from "../types";

interface ShortcutActions {
  toggleKanban?: () => void;
  openTerminalWindow?: () => void;
  newAgent?: () => void;
  toggleSidePanel?: () => void;
  focusFileSearch?: () => void;
  newKanbanTask?: () => void;
}

/**
 * Check if focus is in an editable element where shortcuts should be ignored
 */
const isEditableElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  // Check for contenteditable
  if (target.isContentEditable) return true;

  // Check for Monaco editor or CodeMirror
  if (
    target.closest(".monaco-editor") ||
    target.closest(".cm-editor") ||
    target.closest(".xterm")
  ) {
    return true;
  }

  return false;
};

/**
 * Parse a keydown event into a key string (e.g., "Meta+K")
 */
const parseKeyEvent = (e: KeyboardEvent): string => {
  const parts: string[] = [];

  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  // Get the actual key
  const key = e.key;
  if (
    key !== "Meta" &&
    key !== "Control" &&
    key !== "Alt" &&
    key !== "Shift" &&
    key !== "Dead"
  ) {
    const normalizedKey = key.length === 1 ? key.toUpperCase() : key;
    parts.push(normalizedKey);
  }

  return parts.join("+");
};

/**
 * Hook to handle global keyboard shortcuts
 *
 * @param actions - Object mapping action IDs to callback functions
 *
 * @example
 * ```typescript
 * useGlobalKeyboardShortcuts({
 *   toggleKanban: handleToggleKanbanView,
 *   openTerminalWindow: handleOpenNewTerminalModal,
 *   toggleSidePanel: () => setSidePanelCollapsed(!sidePanelCollapsed),
 * });
 * ```
 */
export function useGlobalKeyboardShortcuts(actions: ShortcutActions): void {
  const { shortcuts, loadShortcuts } = useShortcutsStore();

  // Load shortcuts on mount
  useEffect(() => {
    loadShortcuts();
  }, [loadShortcuts]);

  // Build a map of key combinations to action IDs
  const getKeyToActionMap = useCallback((): Map<string, ShortcutActionId> => {
    const map = new Map<string, ShortcutActionId>();
    Object.values(shortcuts).forEach((shortcut) => {
      if (shortcut.currentKeys) {
        map.set(shortcut.currentKeys, shortcut.id);
      }
    });
    return map;
  }, [shortcuts]);

  // Handle keydown event
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (isEditableElement(e.target)) {
        return;
      }

      // Ignore modifier-only presses
      if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) {
        return;
      }

      const pressedKeys = parseKeyEvent(e);
      const keyToAction = getKeyToActionMap();
      const actionId = keyToAction.get(pressedKeys);

      if (actionId) {
        // Prevent default browser behavior
        e.preventDefault();
        e.stopPropagation();

        // Execute the action
        const action = actions[actionId];
        if (action) {
          console.log(`[shortcuts] Executing: ${actionId} (${pressedKeys})`);
          action();
        }
      }
    },
    [actions, getKeyToActionMap]
  );

  // Set up global event listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handleKeyDown]);
}
