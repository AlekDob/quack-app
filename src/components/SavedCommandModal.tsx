import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SavedCommand, SavedCommandCategory } from "../types";
import "./SavedCommandModal.css";

interface SavedCommandModalProps {
  open: boolean;
  command: SavedCommand | null;
  onClose: () => void;
  onSaved: (command: SavedCommand) => void;
  defaultProjectPath?: string | null;
}

const CATEGORY_OPTIONS: SavedCommandCategory[] = [
  "dev",
  "build",
  "test",
  "custom",
];

const createDefaultCommand = (projectPath?: string | null): SavedCommand => ({
  id: "",
  name: "",
  command: "",
  cwd: "",
  color: "#4ecdc4",
  category: "dev",
  projectPath: projectPath || undefined,
});

export default function SavedCommandModal({
  open,
  command,
  onClose,
  onSaved,
  defaultProjectPath,
}: SavedCommandModalProps) {
  const [draft, setDraft] = useState<SavedCommand>(createDefaultCommand());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(command ?? createDefaultCommand(defaultProjectPath));
      setError(null);
    }
  }, [command, open, defaultProjectPath]);

  if (!open) {
    return null;
  }

  const handleChange = <Key extends keyof SavedCommand>(
    key: Key,
    value: SavedCommand[Key]
  ) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleSubmit = async () => {
    if (saving) {
      return;
    }

    if (!draft.name.trim() || !draft.command.trim()) {
      setError("Please fill in name and command to continue.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: SavedCommand = {
      ...draft,
      cwd: draft.cwd?.trim() ? draft.cwd : undefined,
      projectPath: draft.projectPath?.trim() ? draft.projectPath : undefined,
    };

    try {
      let result: SavedCommand;
      if (payload.id) {
        result = await invoke<SavedCommand>("update_command", {
          id: payload.id,
          command: payload,
        });
      } else {
        result = await invoke<SavedCommand>("save_command", {
          command: payload,
        });
      }
      onSaved(result);
      onClose();
      setDraft(createDefaultCommand());
    } catch (err) {
      console.error("Failed to save command", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (saving) {
      return;
    }
    setDraft(createDefaultCommand());
    setError(null);
    onClose();
  };

  const projectLabel = draft.projectPath
    ? draft.projectPath.split("/").pop() || draft.projectPath
    : "Global (all projects)";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel saved-command-modal">
        <h2>
          {draft.id ? "Edit Saved Command" : "New Saved Command"}
        </h2>

        <label className="modal-field">
          <span>Command name</span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => handleChange("name", event.target.value)}
            placeholder="Dev Server"
          />
        </label>

        <label className="modal-field">
          <span>Command to run</span>
          <textarea
            value={draft.command}
            onChange={(event) => handleChange("command", event.target.value)}
            rows={4}
            placeholder="npm run tauri:dev"
          />
        </label>

        <label className="modal-field">
          <span>Working directory (optional)</span>
          <input
            type="text"
            value={draft.cwd ?? ""}
            onChange={(event) => handleChange("cwd", event.target.value)}
            placeholder="/path/to/project"
          />
        </label>

        <div className="modal-field">
          <span>Project</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="text"
              value={draft.projectPath ?? ""}
              onChange={(event) => handleChange("projectPath", event.target.value)}
              placeholder="Leave empty for global"
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: "11px", opacity: 0.6, whiteSpace: "nowrap" }}>
              {projectLabel}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <div className="modal-field" style={{ flex: 0 }}>
            <span>Color</span>
            <input
              type="color"
              value={draft.color}
              onChange={(event) => handleChange("color", event.target.value)}
              className="saved-command-color-picker"
              aria-label="Select color"
            />
          </div>

          <label className="modal-field" style={{ flex: 1 }}>
            <span>Category</span>
            <select
              value={draft.category}
              onChange={(event) =>
                handleChange(
                  "category",
                  event.target.value as SavedCommandCategory
                )
              }
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving..." : draft.id ? "Save" : "Create Command"}
          </button>
        </div>
      </div>
    </div>
  );
}
