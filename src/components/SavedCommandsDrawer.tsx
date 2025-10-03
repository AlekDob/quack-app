import { useEffect, useMemo, type ReactNode } from "react";
import type { SavedCommand, SavedCommandCategory } from "../types";

interface SavedCommandsDrawerProps {
  open: boolean;
  commands: SavedCommand[];
  onLaunch: (command: SavedCommand, immediate: boolean) => void;
  onEdit: (command: SavedCommand) => void;
  onCreate: () => void;
  onDelete: (command: SavedCommand) => Promise<void>;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<SavedCommandCategory, string> = {
  dev: "Development",
  build: "Build",
  test: "Test",
  custom: "Custom",
};

const icons: Record<string, ReactNode> = {
  launch: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M6 14L14 6M10 6h4v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 10h12m-4-4 4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 14.5V16h1.5l8.6-8.6-1.5-1.5L4 14.5Zm9.9-9.9 1.5 1.5 1.1-1.1a1.1 1.1 0 0 0 0-1.5l-.5-.5a1.1 1.1 0 0 0-1.5 0l-1.1 1.1Z"
        fill="currentColor"
      />
    </svg>
  ),
  delete: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M6 6h8m-6 2v6m4-6v6M8 4h4l.5 1H15v1H5V5h2.5l.5-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export default function SavedCommandsDrawer({
  open,
  commands,
  onLaunch,
  onEdit,
  onCreate,
  onDelete,
  onClose,
}: SavedCommandsDrawerProps) {
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

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <div className={`saved-commands-drawer ${open ? "open" : ""}`}>
      <div className="saved-commands-drawer-backdrop" onClick={onClose} />
      <div className="saved-commands-drawer-panel">
        <header className="saved-commands-drawer-header">
          <div>
            <h2>Saved Commands</h2>
            <p>Organize frequent commands and launch them instantly.</p>
          </div>
          <button
            type="button"
            className="saved-commands-close"
            title="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <div className="saved-commands-drawer-body">
          {(["dev", "build", "test", "custom"] as SavedCommandCategory[]).map(
            (category) => {
              const items = grouped[category];
              if (items.length === 0) {
                return null;
              }
              return (
                <section key={category} className="saved-commands-section">
                  <h3>{CATEGORY_LABELS[category]}</h3>
                  <div className="saved-commands-list">
                    {items.map((command) => (
                      <article
                        key={command.id}
                        className="saved-command-card compact"
                      >
                        <div className="saved-command-top">
                          <div className="saved-command-title">
                            <span
                              className="command-color-dot"
                              style={{ backgroundColor: command.color }}
                            />
                            <strong>{command.name}</strong>
                          </div>
                          <div className="saved-command-icon-actions">
                            <button
                              type="button"
                              className="icon"
                              title="Launch in new terminal"
                              onClick={() => onLaunch(command, true)}
                            >
                              {icons.launch}
                            </button>
                            <button
                              type="button"
                              className="icon"
                              title="Send to active terminal"
                              onClick={() => onLaunch(command, false)}
                            >
                              {icons.send}
                            </button>
                            <button
                              type="button"
                              className="icon"
                              title="Edit command"
                              onClick={() => onEdit(command)}
                            >
                              {icons.edit}
                            </button>
                            <button
                              type="button"
                              className="icon danger"
                              title="Delete command"
                              onClick={() => onDelete(command)}
                            >
                              {icons.delete}
                            </button>
                          </div>
                        </div>
                        <pre
                          className="saved-command-code"
                          title={command.command}
                        >
                          {command.command}
                        </pre>
                      </article>
                    ))}
                  </div>
                </section>
              );
            }
          )}
          {commands.length === 0 && (
            <div className="saved-commands-empty">
              <div>🦆 No saved commands yet.</div>
              <button type="button" className="ghost" onClick={onCreate}>
                Create your first command
              </button>
            </div>
          )}
        </div>
        <footer className="saved-commands-drawer-footer">
          <button type="button" className="primary" onClick={onCreate}>
            + New Command
          </button>
        </footer>
      </div>
    </div>
  );
}
