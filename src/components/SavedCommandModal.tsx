import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SavedCommand, SavedCommandCategory } from "../types";

interface SavedCommandModalProps {
  open: boolean;
  command: SavedCommand | null;
  onClose: () => void;
  onSaved: (command: SavedCommand) => void;
}

const CATEGORY_OPTIONS: SavedCommandCategory[] = [
  "dev",
  "build",
  "test",
  "custom",
];

const createDefaultCommand = (): SavedCommand => ({
  id: "",
  name: "",
  command: "",
  cwd: "",
  color: "#4ecdc4",
  category: "dev",
});

export default function SavedCommandModal({
  open,
  command,
  onClose,
  onSaved,
}: SavedCommandModalProps) {
  const [draft, setDraft] = useState<SavedCommand>(createDefaultCommand());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(command ?? createDefaultCommand());
      setError(null);
    }
  }, [command, open]);

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
      setError("Completa nome e comando per continuare.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: SavedCommand = {
      ...draft,
      cwd: draft.cwd?.trim() ? draft.cwd : undefined,
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
      console.error("Impossibile salvare il comando", err);
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

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel saved-command-modal">
        <h2>
          {draft.id ? "Modifica comando salvato" : "Nuovo comando salvato"}
        </h2>

        <label className="modal-field">
          <span>Nome comando</span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => handleChange("name", event.target.value)}
            placeholder="Dev Server"
          />
        </label>

        <label className="modal-field">
          <span>Comando da eseguire</span>
          <textarea
            value={draft.command}
            onChange={(event) => handleChange("command", event.target.value)}
            rows={4}
            placeholder="npm run tauri:dev"
          />
        </label>

        <label className="modal-field">
          <span>Cartella (opzionale)</span>
          <input
            type="text"
            value={draft.cwd ?? ""}
            onChange={(event) => handleChange("cwd", event.target.value)}
            placeholder="/Users/alekdob/Desktop/Dev/Personal/quack-app"
          />
        </label>

        <div className="modal-field">
          <span>Colore</span>
          <input
            type="color"
            value={draft.color}
            onChange={(event) => handleChange("color", event.target.value)}
            className="saved-command-color-picker"
            aria-label="Seleziona colore"
          />
        </div>

        <label className="modal-field">
          <span>Categoria</span>
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

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={handleCancel}
            disabled={saving}
          >
            Annulla
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Salvataggio…" : draft.id ? "Salva" : "Crea comando"}
          </button>
        </div>
      </div>
    </div>
  );
}
