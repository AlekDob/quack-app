/**
 * KeyboardShortcutsSettings
 *
 * Settings panel for customizing keyboard shortcuts.
 * Features key recording with visual effects and conflict detection.
 */

import { useEffect } from "react";
import SectionHeader from "../controls/SectionHeader";
import SettingsRow from "../controls/SettingsRow";
import ShortcutInput from "../controls/ShortcutInput";
import { useShortcutsStore } from "../../../stores/shortcutsStore";
import type { ShortcutActionId } from "../../../types";
import "./KeyboardShortcutsSettings.css";

export default function KeyboardShortcutsSettings() {
  const {
    shortcuts,
    isLoading,
    loadShortcuts,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    getConflict,
  } = useShortcutsStore();

  // Load shortcuts on mount
  useEffect(() => {
    loadShortcuts();
  }, [loadShortcuts]);

  // Handle shortcut change with conflict check
  const handleShortcutChange = async (id: ShortcutActionId, newKeys: string) => {
    await updateShortcut(id, newKeys);
  };

  // Handle reset single shortcut
  const handleReset = async (id: ShortcutActionId) => {
    await resetShortcut(id);
  };

  // Handle reset all shortcuts
  const handleResetAll = async () => {
    await resetAllShortcuts();
  };

  // Check if any shortcuts are modified
  const hasModifications = Object.values(shortcuts).some(
    (s) => s.currentKeys !== s.defaultKeys
  );

  if (isLoading) {
    return (
      <div className="settings-category">
        <SectionHeader
          title="Keyboard Shortcuts"
          description="Loading shortcuts..."
        />
      </div>
    );
  }

  return (
    <div className="settings-category keyboard-shortcuts-settings">
      <SectionHeader
        title="Keyboard Shortcuts"
        description="Customize keyboard shortcuts for quick actions"
      />

      <div className="settings-group">
        {Object.values(shortcuts).map((shortcut) => (
          <SettingsRow
            key={shortcut.id}
            label={shortcut.label}
            description={shortcut.description}
            control={
              <ShortcutInput
                value={shortcut.currentKeys}
                defaultValue={shortcut.defaultKeys}
                onChange={(keys) => handleShortcutChange(shortcut.id, keys)}
                onReset={() => handleReset(shortcut.id)}
                conflict={getConflict(shortcut.currentKeys, shortcut.id)}
              />
            }
          />
        ))}
      </div>

      {/* Reset All Button */}
      {hasModifications && (
        <div className="keyboard-shortcuts-footer">
          <button
            type="button"
            className="reset-all-btn"
            onClick={handleResetAll}
          >
            Reset All to Defaults
          </button>
        </div>
      )}

      {/* Help text */}
      <div className="keyboard-shortcuts-help">
        <p>Click on a shortcut and press a new key combination to customize it.</p>
        <p>Press <kbd>Esc</kbd> to cancel recording.</p>
      </div>
    </div>
  );
}
