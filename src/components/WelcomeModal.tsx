// First-run welcome. Shows once (localStorage-gated) the first time
// Quack launches, introducing the headline features and the two things
// a new user wants: open a folder, or see what's new. Dismissing sets the
// flag so it never nags again.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useModalFocus } from "../useModalFocus";
import {
  getString as lsGetString,
  setString as lsSetString,
} from "../localStore";
import { runCommand } from "../actions";
import { setAgentMode } from "../agentMode";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import { QUACK_DISCORD, QUACK_HOME } from "../quackLinks";

const SEEN_KEY = "lcp.welcome.v1";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(modalRef, open);

  useEffect(() => {
    if (lsGetString(SEEN_KEY) !== "1") setOpen(true);
  }, []);

  const close = () => {
    lsSetString(SEEN_KEY, "1");
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const features: { icon: ReactNode; title: string; text: string }[] = [
    {
      icon: <AIIcon size={18} />,
      title: "Bring your own model",
      text: "Anthropic, OpenAI, local Ollama — or sign in with Claude Code to use your existing Claude subscription.",
    },
    {
      icon: <Icon name="code" size={18} />,
      title: "Agent Mode",
      text: "A dedicated agent workspace with a conversation-first chat. Toggle it with the Agent button or Ctrl+Shift+A.",
    },
    {
      icon: <Icon name="globe" size={18} />,
      title: "Plugins & MCP",
      text: "Install Claude Code plugins from any GitHub marketplace, and add MCP servers in a click.",
    },
    {
      icon: <Icon name="folder" size={18} />,
      title: "Many projects, one window",
      text: "Switch workspaces like tabs — each keeps its own files, terminals, and chat history.",
    },
  ];

  return createPortal(
    <div className="welcome-backdrop" onMouseDown={close}>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Quack"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="welcome-close"
          onClick={close}
          aria-label="Close"
          title="Close (Esc)"
        >
          <Icon name="x" size={14} />
        </button>
        <div className="welcome-head">
          <div className="welcome-brand">Quack</div>
          <div className="welcome-tag">
            A lightweight code editor with first-class AI.
          </div>
        </div>
        <div className="welcome-features">
          {features.map((f) => (
            <div key={f.title} className="welcome-feature">
              <div className="welcome-feature-icon">{f.icon}</div>
              <div className="welcome-feature-title">{f.title}</div>
              <div className="welcome-feature-text">{f.text}</div>
            </div>
          ))}
        </div>
        <div className="welcome-actions">
          <button
            className="welcome-btn primary"
            onClick={() => {
              close();
              void runCommand("file.open_folder");
            }}
          >
            <Icon name="folder-open" size={14} /> Open a folder
          </button>
          <button
            className="welcome-btn"
            onClick={() => {
              close();
              void setAgentMode(true);
            }}
            title="Agent Mode applies once you open a folder"
          >
            <Icon name="code" size={14} /> Start in Agent Mode
          </button>
          <button
            className="welcome-btn ghost"
            onClick={() => void openUrl(QUACK_HOME)}
          >
            What's new ↗
          </button>
          <button
            className="welcome-btn ghost"
            onClick={() => void openUrl(QUACK_DISCORD)}
          >
            <Icon name="link" size={14} /> Join Discord
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
