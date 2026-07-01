// Agent Customizations — one tabbed surface for everything that
// teaches/extends the agent, instead of scattered modals + Settings
// deep-links. Left nav, content on the right (VS Code's "Agent
// Customizations" dialog, mapped onto Codetta's own surfaces).

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "../useModalFocus";
import { confirm as dialogConfirm } from "../dialog";
import { loadWorkspaceRules } from "../workspaceRules";
import { joinPath, relPath } from "../pathUtils";
import { PROVIDERS } from "../providers";
import { Icon, type IconName } from "./Icon";
import { FileEditorPane } from "./FileEditorPane";
import { SkillsPane } from "./SkillsPane";
import { PluginsPane } from "./PluginsPane";
import { McpServerBrowser } from "./McpServerBrowser";
import { AIPrivacyEditor } from "./aiSettingsSections";
import { ToolPermissionRow, ApiKeyRow } from "./settingsBits";

export type CustomizationTab =
  | "instructions"
  | "skills"
  | "plugins"
  | "mcp"
  | "tools"
  | "providers"
  | "privacy";

interface Props {
  open: boolean;
  onClose: () => void;
  root: string;
  initialTab?: CustomizationTab;
}

const TABS: { id: CustomizationTab; label: string; icon: IconName }[] = [
  { id: "instructions", label: "Instructions", icon: "file-text" },
  { id: "skills", label: "Skills", icon: "star" },
  { id: "plugins", label: "Plugins", icon: "code" },
  { id: "mcp", label: "MCP Servers", icon: "globe" },
  { id: "tools", label: "Tool Access", icon: "wrench" },
  { id: "providers", label: "Providers", icon: "settings" },
  { id: "privacy", label: "Privacy", icon: "eye" },
];

const INSTRUCTIONS_STARTER =
  "# Workspace instructions\n\n" +
  "These notes are prepended to the system prompt for every AI provider\n" +
  "in this workspace. Describe conventions, architecture, and any\n" +
  '"always do X here" preferences.\n';

export function CustomizationsModal({ open, onClose, root, initialTab }: Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(modalRef, open);
  const [tab, setTab] = useState<CustomizationTab>(initialTab ?? "instructions");
  const [rulesPath, setRulesPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const requestClose = useCallback(async () => {
    if (dirty) {
      const ok = await dialogConfirm("Discard unsaved changes?", {
        okLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }, [dirty, onClose]);

  // Reset to the requested tab each time the modal is opened.
  useEffect(() => {
    if (open) setTab(initialTab ?? "instructions");
  }, [open, initialTab]);

  // Resolve the workspace rules file lazily when the Instructions tab is
  // first shown (loadWorkspaceRules hits disk; no need on every open).
  useEffect(() => {
    if (!open || tab !== "instructions" || rulesPath || !root) return;
    let alive = true;
    void (async () => {
      const rules = await loadWorkspaceRules(root);
      if (!alive) return;
      setRulesPath(rules?.absolutePath ?? joinPath(root, ".codetta", "rules.md"));
    })();
    return () => {
      alive = false;
    };
  }, [open, tab, rulesPath, root]);

  // Re-resolve the rules path if the workspace changes between opens.
  useEffect(() => {
    setRulesPath(null);
  }, [root]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  if (!open) return null;

  return createPortal(
    <div className="agent-modal-backdrop" onMouseDown={() => void requestClose()}>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="cust-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Agent Customizations"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cust-modal-head">
          <div className="cust-modal-title">Agent Customizations</div>
          <button
            className="agent-modal-close"
            onClick={() => void requestClose()}
            aria-label="Close"
            title="Close (Esc)"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="cust-modal-body">
          <nav className="cust-nav" aria-label="Customization sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`cust-nav-item ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id}
              >
                <Icon name={t.icon} size={14} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="cust-content">
            {tab === "instructions" && (
              <FileEditorPane
                path={rulesPath}
                subtitle={rulesPath ? relPath(rulesPath, root) : undefined}
                starter={INSTRUCTIONS_STARTER}
                gitRoot={root}
                onDirtyChange={setDirty}
              />
            )}
            {tab === "skills" && (
              <SkillsPane root={root} onDirtyChange={setDirty} />
            )}
            {tab === "plugins" && <PluginsPane root={root} />}
            {tab === "mcp" && (
              <div className="cust-pane cust-pane-scroll">
                <McpServerBrowser />
              </div>
            )}
            {tab === "tools" && (
              <div className="cust-pane cust-pane-scroll">
                <ToolPermissionRow
                  label="Read tools (list_files, read_file, search_text, read_terminal)"
                  hint="Look at code and terminal output"
                  field="read"
                />
                <ToolPermissionRow
                  label="Web search"
                  hint="Public DuckDuckGo search"
                  field="webSearch"
                />
                <ToolPermissionRow
                  label="Write tools (edit_file, create_file)"
                  hint="Modify your code (always shows a diff before applying)"
                  field="write"
                />
                <div className="settings-row settings-row-note">
                  "Allow" runs the tool with no extra prompt. "Ask" pops a
                  confirm dialog each time. "Deny" disables the tool.
                </div>
              </div>
            )}
            {tab === "providers" && (
              <div className="cust-pane cust-pane-scroll">
                {PROVIDERS.filter((p) => p.needsApiKey).map((p) => (
                  <ApiKeyRow
                    key={p.id}
                    providerId={p.id}
                    displayName={p.displayName}
                    helpUrl={p.keyHelpUrl}
                  />
                ))}
                <div className="settings-row settings-row-note">
                  Keys are stored in <code>localStorage</code> on this machine
                  and sent directly from the app to the provider. Ollama runs
                  locally and needs no key.
                </div>
              </div>
            )}
            {tab === "privacy" && (
              <div className="cust-pane cust-pane-scroll">
                <AIPrivacyEditor />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
