import { useMemo, useState } from "react";
import type { SavedCommand, SavedCommandCategory } from "../types";

interface SavedCommandsProps {
  commands: SavedCommand[];
  onSelect: (command: SavedCommand) => void;
  onLaunchNow: (command: SavedCommand) => void;
  onEdit: (command: SavedCommand) => void;
  onCreate: () => void;
  onDelete: (command: SavedCommand) => Promise<void>;
}

const CATEGORY_LABELS: Record<SavedCommandCategory, string> = {
  dev: "Sviluppo",
  build: "Build",
  test: "Test",
  custom: "Personalizzati",
};

export default function SavedCommands({
  commands,
  onSelect,
  onLaunchNow,
  onEdit,
  onCreate,
  onDelete,
}: SavedCommandsProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return commands.reduce<Record<SavedCommandCategory, SavedCommand[]>>(
      (accumulator, command) => {
        const category = command.category ?? "custom";
        accumulator[category].push(command);
        return accumulator;
      },
      {
        dev: [],
        build: [],
        test: [],
        custom: [],
      }
    );
  }, [commands]);

  const handleDelete = async (command: SavedCommand) => {
    if (busyId) {
      return;
    }
    setBusyId(command.id);
    setErrorId(null);
    try {
      await onDelete(command);
    } catch (error) {
      console.error("Impossibile eliminare il comando", error);
      setErrorId(command.id);
    } finally {
      setBusyId(null);
    }
  };

  const renderCategory = (category: SavedCommandCategory) => {
    const items = grouped[category];
    if (items.length === 0) {
      return null;
    }
    return (
      <div key={category} className="saved-commands-category">
        <div className="saved-commands-category-header">
          {CATEGORY_LABELS[category]}
        </div>
        <div className="saved-commands-list">
          {items.map((command) => (
            <div
              key={command.id}
              className={`saved-command-item ${errorId === command.id ? "error" : ""}`}
            >
              <button
                type="button"
                className="saved-command-main"
                onClick={() => onSelect(command)}
                title={command.command}
              >
                <span
                  className="command-color-dot"
                  style={{ backgroundColor: command.color }}
                />
                <span className="saved-command-name">{command.name}</span>
              </button>
              <div className="command-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onLaunchNow(command)}
                  disabled={busyId === command.id}
                  title="Lancia subito"
                >
                  ▶
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onEdit(command)}
                  title="Modifica"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="ghost danger"
                  onClick={() => handleDelete(command)}
                  disabled={busyId === command.id}
                  title="Elimina"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="saved-commands">
      <header className="saved-commands-header">
        <div className="saved-commands-title">
          <span>Comandi salvati</span>
          <button type="button" className="ghost" onClick={onCreate}>
            + Nuovo
          </button>
        </div>
        <p className="saved-commands-description">
          Organizza i tuoi comandi frequenti per lanciarli al volo nei terminali
          Quack.
        </p>
      </header>
      <div className="saved-commands-body">
        {(["dev", "build", "test", "custom"] as SavedCommandCategory[]).map(
          renderCategory
        )}
        {commands.length === 0 && (
          <div className="saved-commands-empty">
            <div>🦆 Nessun comando salvato ancora.</div>
            <button type="button" className="ghost" onClick={onCreate}>
              Crea il primo comando
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
