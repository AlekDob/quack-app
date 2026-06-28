import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import { openPalette } from "../paletteBus";
import { openSettings } from "../settingsBus";
import { pty } from "../ipc";
import { error as toastError, errMsg, info as toastInfo } from "../notify";
import { prompt as dialogPrompt } from "../dialog";
import { Icon } from "./Icon";

interface Tip {
  keys: string[];
  label: string;
}

const TIPS: Tip[] = [
  { keys: ["Ctrl", "P"], label: "Quick-open files & commands" },
  { keys: ["Ctrl", "Shift", "F"], label: "Search file contents" },
  { keys: ["Ctrl", "Shift", "G"], label: "Source control" },
  { keys: ["Ctrl", "Shift", "T"], label: "TODO / FIXME panel" },
  { keys: ["Ctrl", "B"], label: "Toggle sidebar" },
  { keys: ["Ctrl", "J"], label: "Toggle bottom panel" },
  { keys: ["Ctrl", "`"], label: "New terminal" },
  { keys: ["Ctrl", "S"], label: "Save" },
  { keys: ["Alt", "Z"], label: "Toggle word wrap" },
  { keys: ["Ctrl", "+"], label: "Zoom in / out / reset (Ctrl+0)" },
];

export function WorkspacePicker() {
  const recent = useStore((s) => s.recent);
  const openWs = useStore((s) => s.openWorkspace);
  const removeRecent = useStore((s) => s.removeFromRecent);

  async function pickFolder() {
    const sel = await open({ directory: true, multiple: false });
    if (typeof sel === "string") await openWs(sel);
  }

  async function cloneFromUrl() {
    const url = await dialogPrompt(
      "Git repository URL (https or ssh)",
      "",
      { title: "Clone repository", okLabel: "Continue" },
    );
    if (!url || !url.trim()) return;
    const dest = await open({ directory: true, multiple: false });
    if (typeof dest !== "string") return;
    try {
      // Open the destination as a workspace, then run `git clone` inside it.
      await openWs(dest);
      // Spawn a shell in the destination that runs the clone, then opens
      // the cloned subfolder as a workspace via a marker check.
      const ptyId = await pty.spawn({
        cwd: dest,
        cols: 100,
        rows: 24,
        title: "Clone",
      });
      const cmd = `git clone ${url.replace(/"/g, '\\"')}\r`;
      await pty.write(ptyId, cmd);
      toastInfo("Cloning… check the new terminal for progress.");
    } catch (e) {
      toastError(`Clone failed: ${errMsg(e)}`);
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-content">
        <div className="welcome-brand">
          <div className="welcome-logo">⌘</div>
          <h1>Quack</h1>
          <p className="welcome-tagline">
            A lightweight desktop code editor with AI
          </p>
        </div>

        <div className="welcome-grid">
          <section className="welcome-section">
            <h2>Get started</h2>
            <button
              className="welcome-action primary"
              onClick={() => void pickFolder()}
            >
              <span className="welcome-action-icon">
                <Icon name="folder-open" size={20} />
              </span>
              <span className="welcome-action-label">
                <strong>Open Folder…</strong>
                <span>Open any project directory as a workspace</span>
              </span>
            </button>
            <button
              className="welcome-action"
              onClick={() => void cloneFromUrl()}
            >
              <span className="welcome-action-icon">
                <Icon name="git-branch" size={20} />
              </span>
              <span className="welcome-action-label">
                <strong>Clone from Git URL…</strong>
                <span>Pick a destination folder and run git clone</span>
              </span>
            </button>
            <button
              className="welcome-action"
              onClick={() => openPalette("")}
            >
              <span className="welcome-action-icon">
                <Icon name="command" size={20} />
              </span>
              <span className="welcome-action-label">
                <strong>Command Palette</strong>
                <span>Search commands, files, and workspaces</span>
              </span>
            </button>
            {/* The product pitch is "BYOK AI editor", yet a new user
                could work for days without ever finding the AI setup
                path (the AI panel defaults to hidden). One visible
                door, straight to the key fields. */}
            <button
              className="welcome-action"
              onClick={() => openSettings("ai-providers")}
            >
              <span className="welcome-action-icon">
                <Icon name="settings" size={20} />
              </span>
              <span className="welcome-action-label">
                <strong>Set up AI</strong>
                <span>
                  Bring your own key — Claude Code, Anthropic, OpenAI.
                  Ollama needs no key.
                </span>
              </span>
            </button>
          </section>

          <section className="welcome-section">
            <h2>Recent Workspaces</h2>
            {recent.length === 0 ? (
              <p className="welcome-empty">No recent workspaces yet.</p>
            ) : (
              <ul className="welcome-recent-list">
                {recent.slice(0, 8).map((w) => (
                  <li key={w.id}>
                    <button
                      className="welcome-recent-row"
                      onClick={() => void openWs(w.root)}
                      title={w.root}
                    >
                      <strong>{w.name}</strong>
                      <span>{w.root}</span>
                    </button>
                    <button
                      className="welcome-recent-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeRecent(w.id);
                      }}
                      title="Remove from list"
                      aria-label={`Remove ${w.name} from recent workspaces`}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="welcome-section welcome-tips">
            <h2>Quick tips</h2>
            <ul>
              {TIPS.map((t, i) => (
                <li key={i}>
                  <span className="welcome-keys">
                    {t.keys.map((k, j) => (
                      <kbd key={j}>{k}</kbd>
                    ))}
                  </span>
                  <span>{t.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
