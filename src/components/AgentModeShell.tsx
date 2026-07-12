import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  useStore,
  collectComposeReviewTabs,
  focusedAgentSidePanelKey,
  findTabsPaneByTab,
  parseKey,
} from "../store";
import { AIChatPanel } from "./AIChatPanel";
import { CompactChat, AgentFileOpen } from "./chatToolRender";
import { ComposeReviewPane } from "./ComposeReviewPane";
import { SubagentTranscriptView } from "./SubagentTranscriptView";
import { SourceControlPanel } from "./SourceControlPanel";
import { FileTree } from "./FileTree";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import { setAgentMode } from "../agentMode";
import { getTasks, subscribeTasks, clearTasks } from "../aiTaskStore";
import { FilePopupModal } from "./FilePopupModal";
import { WorkspaceColorPopover } from "./WorkspaceColorPopover";
import { getWorkspaceColor, subscribeWorkspaceColors } from "../workspaceColors";
import { AIChatsRail } from "./AIChatsRail";
import { ChatSwitchVeil } from "./ChatSwitchVeil";
import { addNewAIChat, anchorFromElement } from "../addNewAIChat";
import { endChatSwitch, pulseChatSwitch } from "../chatSwitch";
import { useChatSwitching } from "../useChatSwitching";

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

// One panel per chat, toggled with CSS — mirrors WorkspaceShell's
// AIChatHost so switching doesn't remount and replay hydration.
function AgentChatHost({
  wsId,
  root,
  chatId,
  visible,
  onOpenFile,
}: {
  wsId: string;
  root: string;
  chatId: string;
  visible: boolean;
  onOpenFile: (path: string | null) => void;
}) {
  const [mounted, setMounted] = useState(visible);
  const onHydrated = useCallback(() => endChatSwitch(), []);
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);
  if (!mounted) return null;
  return (
    <div
      className="agent-chat-host"
      data-visible={visible || undefined}
      aria-hidden={!visible}
    >
      <CompactChat.Provider value={true}>
        <AgentFileOpen.Provider value={onOpenFile}>
          <AIChatPanel
            wsId={wsId}
            root={root}
            aiChatId={chatId}
            chatVisible={visible}
            onHydrated={onHydrated}
          />
        </AgentFileOpen.Provider>
      </CompactChat.Provider>
    </div>
  );
}

export function AgentModeShell({ wsId }: Props) {
  const openIds = useStore((s) => s.openIds);
  const loaded = useStore((s) => s.loaded);
  const recent = useStore((s) => s.recent);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const openWorkspace = useStore((s) => s.openWorkspace);

  // Which session fills the center column, tracked PER workspace so
  // switching workspaces (and back) restores what you were looking at.
  const [selectedByWs, setSelectedByWs] = useState<Record<string, string>>({});
  const [contextTab, setContextTab] = useState<ContextTab>("changes");

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
    nameAnchor: { x: number; y: number };
  } | null>(null);
  const [, setColorTick] = useState(0);
  useEffect(
    () => subscribeWorkspaceColors(() => setColorTick((n) => n + 1)),
    [],
  );

  const ws = loaded[wsId];
  const editorRoot = ws?.layout.editorRoot;
  const reviewTabs =
    ws && editorRoot ? collectComposeReviewTabs(wsId, editorRoot) : [];
  const sidePanelKey =
    ws && editorRoot
      ? focusedAgentSidePanelKey(wsId, ws.layout, editorRoot)
      : null;
  const sideParsed = sidePanelKey ? parseKey(sidePanelKey) : null;
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);

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

  const switching = useChatSwitching();

  const recentNotOpen = recent.filter((w) => !openIds.includes(w.id));

  const selectSession = (id: string, chatId: string) => {
    const crossWs = id !== wsId;
    if (chatId !== activeChatId || crossWs) {
      pulseChatSwitch({ veil: crossWs, flushWsId: wsId });
    }
    if (crossWs) void setActiveWorkspace(id);
    setSelectedByWs((m) => ({ ...m, [id]: chatId }));
  };

  const newSession = (
    id: string,
    anchor: { x: number; y: number },
  ) => {
    const chatId = addNewAIChat(id, "editor", anchor);
    if (id !== wsId) void setActiveWorkspace(id);
    setSelectedByWs((m) => ({ ...m, [id]: chatId }));
  };


  return (
    <div className="agent-shell" data-ws-id={wsId}>
      {/* ── Left: workspace rail + expanded Agent Hub ───────── */}
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
                title={`${meta.name}\n${meta.root}\nRight-click for actions`}
                aria-label={`Workspace ${meta.name}`}
                onClick={() => {
                  if (!isActiveWs) void setActiveWorkspace(id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const el = e.currentTarget as HTMLElement;
                  const r = el.getBoundingClientRect();
                  setColorMenu({
                    wsId: id,
                    x: r.right + 6,
                    y: r.top,
                    nameAnchor: anchorFromElement(el),
                  });
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

        <AIChatsRail
          placement="agent-sidebar"
          activeChatId={activeChatId}
          onSelectChat={selectSession}
          onNewChat={newSession}
          onCloseChat={(id, chatId) => {
            clearTasks(chatId);
            setSelectedByWs((m) => {
              if (m[id] !== chatId) return m;
              const rest = { ...m };
              delete rest[id];
              return rest;
            });
          }}
          footer={
            <>
              <AgentTasks chatId={activeChatId} />
              <button
                className="agent-exit"
                onClick={() => setAgentMode(false)}
                title="Back to editor layout"
              >
                <Icon name="chevron-left" size={12} />
                <span>Editor layout</span>
              </button>
            </>
          }
        />
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

      {/* ── Chat column (+ optional side panel: diff review / subagent) ─ */}
      <main className={`agent-main${sidePanelKey ? " has-review" : ""}`}>
        <div className="agent-main-inner">
          <div className="agent-main-chat">
            {ws && activeChats.length > 0 ? (
              <div
                className={`agent-main-chat-panels${switching ? " is-switching" : ""}`}
              >
                {activeChats.map((chat) => (
                  <AgentChatHost
                    key={chat.id}
                    wsId={wsId}
                    root={ws.meta.root}
                    chatId={chat.id}
                    visible={!switching && chat.id === activeChatId}
                    onOpenFile={setOpenFilePath}
                  />
                ))}
              </div>
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
                    onClick={(e) =>
                      newSession(wsId, anchorFromElement(e.currentTarget))
                    }
                  >
                    <Icon name="plus" size={12} />
                    <span>New session</span>
                  </button>
                </div>
              </div>
            )}
            <ChatSwitchVeil />
          </div>
          {sidePanelKey && sideParsed?.kind === "composeReview" && (
            <div className="agent-main-review">
              {reviewTabs.length > 1 && (
                <div className="agent-review-tabs" role="tablist">
                  {reviewTabs.map((key) => {
                    const p = parseKey(key);
                    const label =
                      p?.kind === "composeReview"
                        ? p.path.split(/[\\/]/).pop() ?? p.path
                        : "Review";
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        className={`agent-review-tab${key === sidePanelKey ? " active" : ""}`}
                        aria-selected={key === sidePanelKey}
                        onClick={() => {
                          const pane = editorRoot
                            ? findTabsPaneByTab(editorRoot, key)
                            : null;
                          if (pane) setActiveTab(wsId, pane.id, key);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              <ComposeReviewPane
                wsId={wsId}
                tabKey={sidePanelKey}
                visible
              />
            </div>
          )}
          {sidePanelKey && sideParsed?.kind === "subagent" && ws && (
            <div className="agent-main-review">
              <SubagentTranscriptView
                root={ws.meta.root}
                sessionId={sideParsed.sessionId}
                toolUseId={sideParsed.toolUseId}
                agentType={sideParsed.agentType}
                visible
                inline
                onClose={() => void closeTab(wsId, sidePanelKey)}
              />
            </div>
          )}
        </div>
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
                <SourceControlPanel
                  key={`sc:${wsId}`}
                  wsId={wsId}
                  root={ws.meta.root}
                  compact
                />
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
          nameAnchor={colorMenu.nameAnchor}
          onClose={() => setColorMenu(null)}
          onNewChat={newSession}
        />
      )}
    </div>
  );
}
