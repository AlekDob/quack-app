import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import { AIChatPanel } from "./AIChatPanel";
import { CompactChat, AgentFileOpen } from "./chatToolRender";
import { SourceControlPanel } from "./SourceControlPanel";
import { FileTree } from "./FileTree";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import { setAgentMode } from "../agentMode";
import { getTasks, subscribeTasks, clearTasks } from "../aiTaskStore";
import { AgentCustomizations } from "./AgentCustomizations";
import {
  CustomizationsModal,
  type CustomizationTab,
} from "./CustomizationsModal";
import { FilePopupModal } from "./FilePopupModal";
import { WorkspaceColorPopover } from "./WorkspaceColorPopover";
import { getWorkspaceColor, subscribeWorkspaceColors } from "../workspaceColors";
import { modelBadge } from "../modelBadge";

interface Props {
  // Always the active workspace id. The shell is NOT remounted on
  // workspace switch (no React key), so this prop simply updates and the
  // component's per-workspace selection map survives the switch.
  wsId: string;
}

// Live view of the active session's agent checklist (TodoWrite /
// TaskCreate), published by AIChatPanel into the shared task store. Sits
// below the sessions list so "what the agent is doing" is always visible
// without scrolling the chat. Hidden when the session has no tasks.
function AgentTasks({ chatId }: { chatId: string | null }) {
  const [, setTick] = useState(0);
  useEffect(() => subscribeTasks(() => setTick((t) => t + 1)), []);
  const raw = getTasks(chatId);
  // The checklist builder can emit the same task twice (TaskCreate +
  // TodoWrite both feeding one list). Collapse by content, keeping the
  // furthest-along status, so the count and rows read correctly.
  const rank = { pending: 0, in_progress: 1, completed: 2 } as const;
  const byContent = new Map<string, (typeof raw)[number]>();
  for (const t of raw) {
    const ex = byContent.get(t.content);
    if (!ex || rank[t.status] > rank[ex.status]) byContent.set(t.content, t);
  }
  const tasks = [...byContent.values()];
  if (tasks.length === 0) return null;
  const done = tasks.filter((t) => t.status === "completed").length;
  return (
    <div className="agent-tasks">
      <div className="agent-tasks-head">
        <span className="agent-tasks-title">Tasks</span>
        <span className="agent-tasks-count">
          {done}/{tasks.length}
        </span>
      </div>
      <div className="agent-tasks-list">
        {tasks.map((t, i) => (
          <div key={i} className={`agent-task status-${t.status}`}>
            <span className="agent-task-icon" aria-hidden="true">
              <Icon
                name={
                  t.status === "completed"
                    ? "check-circle"
                    : t.status === "in_progress"
                      ? "arrow-down-circle"
                      : "circle"
                }
                size={12}
              />
            </span>
            <span className="agent-task-text">
              {t.status === "in_progress" && t.activeForm
                ? t.activeForm
                : t.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ContextTab = "changes" | "files";

// 1–2 char workspace badge, same scheme the main app's ActivityBar uses
// so the agent-mode rail reads as the same Codetta workspace switcher.
function initials(name: string): string {
  const parts = name.split(/[\s\-_.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function AgentModeShell({ wsId }: Props) {
  const openIds = useStore((s) => s.openIds);
  const loaded = useStore((s) => s.loaded);
  const recent = useStore((s) => s.recent);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const openWorkspace = useStore((s) => s.openWorkspace);
  const addAIChat = useStore((s) => s.addAIChat);
  const closeAIChat = useStore((s) => s.closeAIChat);

  // Which session fills the center column, tracked PER workspace so
  // switching workspaces (and back) restores what you were looking at.
  const [selectedByWs, setSelectedByWs] = useState<Record<string, string>>({});
  const [contextTab, setContextTab] = useState<ContextTab>("changes");

  // The one Agent Customizations modal, opened at a chosen tab.
  const [custTab, setCustTab] = useState<CustomizationTab | null>(null);
  // File opened from the Files tab (agent mode has no editor pane).
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);

  // "+" workspace menu on the rail (open folder / recent).
  const [railMenu, setRailMenu] = useState(false);
  const railAddRef = useRef<HTMLButtonElement>(null);

  // Right-click color popover for a workspace icon (shared with ActivityBar).
  const [colorMenu, setColorMenu] = useState<{
    wsId: string;
    x: number;
    y: number;
  } | null>(null);
  const [, setColorTick] = useState(0);
  useEffect(
    () => subscribeWorkspaceColors(() => setColorTick((n) => n + 1)),
    [],
  );

  const ws = loaded[wsId];

  const chatsFor = (id: string) => {
    const w = loaded[id];
    if (!w) return [];
    return Object.values(w.aiChats).sort((a, b) => a.createdAt - b.createdAt);
  };

  // Resolve the center session for the active workspace: the explicit
  // per-ws pick if it still exists, else the most recent session.
  const activeChats = chatsFor(wsId);
  const pickedId = selectedByWs[wsId];
  const activeChatId =
    pickedId && ws?.aiChats[pickedId]
      ? pickedId
      : activeChats.length
        ? activeChats[activeChats.length - 1].id
        : null;

  const recentNotOpen = recent.filter((w) => !openIds.includes(w.id));

  const selectSession = (id: string, chatId: string) => {
    if (id !== wsId) void setActiveWorkspace(id);
    setSelectedByWs((m) => ({ ...m, [id]: chatId }));
  };

  const newSession = (id: string) => {
    const chatId = addAIChat(id, "editor");
    if (id !== wsId) void setActiveWorkspace(id);
    setSelectedByWs((m) => ({ ...m, [id]: chatId }));
  };

  const removeSession = (id: string, chatId: string) => {
    closeAIChat(id, chatId);
    clearTasks(chatId);
    setSelectedByWs((m) => {
      if (m[id] !== chatId) return m;
      const rest = { ...m };
      delete rest[id];
      return rest;
    });
  };


  return (
    <div className="agent-shell" data-ws-id={wsId}>
      {/* ── Left: workspace rail (Codetta ActivityBar style) +
             agents panel for the active workspace ──────────────── */}
      <aside className="agent-sidebar">
        <div className="agent-wsrail" role="tablist" aria-label="Workspaces">
          {openIds.map((id) => {
            const meta = loaded[id]?.meta;
            if (!meta) return null;
            const isActiveWs = id === wsId;
            const count = chatsFor(id).length;
            const color = getWorkspaceColor(id);
            return (
              <button
                key={id}
                className={`agent-wsrail-icon ${isActiveWs ? "active" : ""} ${color ? "has-color" : ""}`}
                style={
                  color
                    ? ({ "--ws-color": color.hex } as React.CSSProperties)
                    : undefined
                }
                role="tab"
                aria-selected={isActiveWs}
                title={`${meta.name}\n${meta.root}\nRight-click to set a color`}
                aria-label={`Workspace ${meta.name}`}
                onClick={() => {
                  if (!isActiveWs) void setActiveWorkspace(id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setColorMenu({ wsId: id, x: r.right + 6, y: r.top });
                }}
              >
                <span className="agent-wsrail-text">{initials(meta.name)}</span>
                {count > 0 && (
                  <span className="agent-wsrail-count" aria-hidden="true">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
            );
          })}
          <button
            ref={railAddRef}
            className="agent-wsrail-icon agent-wsrail-add"
            title="Open workspace"
            aria-label="Open workspace"
            aria-haspopup="menu"
            aria-expanded={railMenu}
            onClick={() => setRailMenu((v) => !v)}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>

        <div className="agent-agents">
          <div className="agent-agents-head">
            <span className="agent-agents-title" title={ws?.meta.root}>
              <AIIcon size={13} /> {ws?.meta.name ?? "Workspace"}
            </span>
            <button
              className="agent-new-session"
              onClick={() => newSession(wsId)}
              title="New session"
              aria-label="New session"
            >
              <Icon name="plus" size={12} />
              <span>New</span>
            </button>
          </div>

          <div className="agent-agents-list" role="tablist" aria-label="Sessions">
            {activeChats.length === 0 && (
              <div className="agent-sessions-empty">
                No sessions yet — start one to begin.
              </div>
            )}
            {activeChats.map((chat) => {
              const isActive = chat.id === activeChatId;
              const badge = modelBadge(chat.model);
              return (
                <div
                  key={chat.id}
                  className={`agent-session-item ${isActive ? "active" : ""}`}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  aria-label={`${chat.title} — ${badge.full}`}
                  title={`${chat.title}\n${badge.full}`}
                  onClick={() => selectSession(wsId, chat.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectSession(wsId, chat.id);
                    } else if (
                      (e.key === "Delete" || e.key === "Backspace") &&
                      !e.repeat
                    ) {
                      e.preventDefault();
                      removeSession(wsId, chat.id);
                    }
                  }}
                >
                  <span
                    className={`ai-chats-rail-badge ${badge.className}`}
                    aria-hidden="true"
                  >
                    {badge.short}
                  </span>
                  <span className="agent-session-title">{chat.title}</span>
                  <button
                    className="agent-session-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSession(wsId, chat.id);
                    }}
                    title="Close session"
                    aria-label={`Close session ${chat.title}`}
                  >
                    <Icon name="x" size={10} />
                  </button>
                </div>
              );
            })}
          </div>

          <AgentTasks chatId={activeChatId} />

          <AgentCustomizations onOpen={(t) => setCustTab(t)} />
          <button
            className="agent-exit"
            onClick={() => setAgentMode(false)}
            title="Back to editor layout"
          >
            <Icon name="chevron-left" size={12} />
            <span>Editor layout</span>
          </button>
        </div>
      </aside>

      {railMenu &&
        railAddRef.current &&
        (() => {
          const rect = railAddRef.current.getBoundingClientRect();
          const style: React.CSSProperties = {
            position: "fixed",
            left: rect.right + 6,
            top: Math.max(8, rect.top - 4),
            minWidth: 300,
          };
          return createPortal(
            <>
              <div className="menu-overlay" onClick={() => setRailMenu(false)} />
              <div className="menu-dropdown" style={style} role="menu">
                <button
                  className="menu-item"
                  onClick={async () => {
                    setRailMenu(false);
                    const sel = await openDialog({
                      directory: true,
                      multiple: false,
                    });
                    if (typeof sel === "string") await openWorkspace(sel);
                  }}
                >
                  <span className="menu-item-label">Open Folder…</span>
                </button>
                {recentNotOpen.length > 0 && (
                  <>
                    <div className="menu-separator" />
                    <div className="menu-section-title">Recent</div>
                    {recentNotOpen.slice(0, 8).map((w) => (
                      <button
                        key={w.id}
                        className="menu-item"
                        onClick={() => {
                          setRailMenu(false);
                          void openWorkspace(w.root);
                        }}
                        title={w.root}
                      >
                        <span className="menu-item-label">{w.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>,
            document.body,
          );
        })()}

      {/* ── Chat column (primary) ─────────────────────────────── */}
      <main className="agent-main">
        {ws && activeChatId ? (
          <CompactChat.Provider value={true}>
            <AgentFileOpen.Provider value={setOpenFilePath}>
              <AIChatPanel
                key={`${wsId}:${activeChatId}`}
                wsId={wsId}
                root={ws.meta.root}
                aiChatId={activeChatId}
              />
            </AgentFileOpen.Provider>
          </CompactChat.Provider>
        ) : (
          <div className="agent-main-empty">
            <div className="agent-main-empty-card">
              <AIIcon size={28} />
              <div className="agent-main-empty-title">Start a session</div>
              <div className="agent-main-empty-hint">
                Open a conversation with your model — it can read and edit{" "}
                {ws?.meta.name ?? "this workspace"} directly.
              </div>
              <button
                className="agent-main-empty-btn"
                onClick={() => newSession(wsId)}
              >
                <Icon name="plus" size={12} />
                <span>New session</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Context column (Changes / Files) ──────────────────── */}
      <aside className="agent-context">
        <div className="agent-context-tabs" role="tablist" aria-label="Workspace context">
          <button
            className={`agent-context-tab ${contextTab === "changes" ? "active" : ""}`}
            role="tab"
            aria-selected={contextTab === "changes"}
            onClick={() => setContextTab("changes")}
          >
            Changes
          </button>
          <button
            className={`agent-context-tab ${contextTab === "files" ? "active" : ""}`}
            role="tab"
            aria-selected={contextTab === "files"}
            onClick={() => setContextTab("files")}
          >
            Files
          </button>
        </div>
        <div className="agent-context-body">
          {/* Both panels stay mounted (just hidden) so toggling the tab
              doesn't re-run their git/fs scans on every switch. Keyed by
              wsId so they re-bind when the active workspace changes. */}
          {ws && (
            <>
              <div
                className="agent-context-pane"
                style={{ display: contextTab === "changes" ? "flex" : "none" }}
              >
                <SourceControlPanel key={`sc:${wsId}`} wsId={wsId} root={ws.meta.root} />
              </div>
              <div
                className="agent-context-pane"
                style={{ display: contextTab === "files" ? "flex" : "none" }}
              >
                <FileTree
                  key={`ft:${wsId}`}
                  wsId={wsId}
                  root={ws.meta.root}
                  onOpenFile={(_id, p) => setOpenFilePath(p)}
                />
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Agent Customizations (one tabbed modal) ───────────── */}
      <CustomizationsModal
        open={!!custTab}
        initialTab={custTab ?? "instructions"}
        onClose={() => setCustTab(null)}
        root={ws?.meta.root ?? ""}
      />

      {/* ── File popup (Files tab → click) ────────────────────── */}
      <FilePopupModal
        path={openFilePath}
        root={ws?.meta.root ?? ""}
        onClose={() => setOpenFilePath(null)}
      />

      {colorMenu && (
        <WorkspaceColorPopover
          wsId={colorMenu.wsId}
          x={colorMenu.x}
          y={colorMenu.y}
          onClose={() => setColorMenu(null)}
        />
      )}
    </div>
  );
}
