import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  useStore,
  collectComposeReviewTabs,
  focusedAgentSidePanelKey,
  findTabsPaneByTab,
  parseKey,
  activeAiChatId,
  type EditorDrawerState,
} from "../store";
import { AIChatPanel } from "./AIChatPanel";
import { CompactChat, AgentFileOpen } from "./chatToolRender";
import { ComposeReviewPane } from "./ComposeReviewPane";
import { SubagentTranscriptView } from "./SubagentTranscriptView";
import { EditorTabDrawer } from "./EditorTabDrawer";
import { TabContentHost } from "./TabContentHost";
import { AgentContextColumn } from "./AgentContextColumn";
import {
  AGENT_CONTEXT_MAX_W,
  AGENT_CONTEXT_MIN_W,
  clampAgentContextWidth,
  getAgentContextWidth,
  setAgentContextWidth,
} from "../agentContextWidth";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import {
  getAgentSelectedChat,
  setAgentSelectedChat,
  clearAgentSelectedChat,
} from "../agentModeSelection";
import { clearTasks } from "../aiTaskStore";
import { getAgentStatus, subscribeAgentStatus } from "../agentStatusStore";
import { FilePopupModal } from "./FilePopupModal";
import { WorkspaceColorPopover } from "./WorkspaceColorPopover";
import { getWorkspaceColor, subscribeWorkspaceColors } from "../workspaceColors";
import { AIChatsRail } from "./AIChatsRail";
import { addNewAIChat, anchorFromElement } from "../addNewAIChat";
import { endChatSwitch, getChatSwitchTarget, pulseChatSwitch } from "../chatSwitch";
import { logChatSwitch } from "../chatSwitchDebug";
import { logAgentModePhase } from "../switchPerf";
import { useChatSwitching } from "../useChatSwitching";
import {
  shouldKeepChatHostMounted,
  useChatHostLiveStatus,
} from "../chatHostMount";
import { isAgentChatWarm, touchAgentChatWarm } from "../agentChatWarm";
import { dropCachedSessionBody } from "../chatStoreCache";

interface Props {
  // Always the active workspace id. The shell is NOT remounted on
  // workspace switch (no React key). Agent↔IDE *does* remount the shell —
  // selected chat lives in `agentModeSelection.ts`, not component state.
  wsId: string;
}

// 1–2 char workspace badge, same scheme the main app's ActivityBar uses
// so the agent-mode rail reads as the same Codetta workspace switcher.
function initials(name: string): string {
  const parts = name.split(/[\s\-_.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// One panel per chat, toggled with CSS — mirrors WorkspaceShell's
// AIChatHost so switching doesn't remount and replay hydration.
// memo: AgentModeShell re-renders on every select + agent-status tick;
// without memo every warm host re-painted its full AIChatPanel.
const AgentChatHost = memo(function AgentChatHost({
  wsId,
  root,
  chatId,
  visible,
  tabOpen,
  doneAt,
  archivedAt,
  onOpenFile,
}: {
  wsId: string;
  root: string;
  chatId: string;
  visible: boolean;
  tabOpen: boolean;
  doneAt?: number;
  archivedAt?: number;
  onOpenFile: (path: string | null) => void;
}) {
  const liveStatus = useChatHostLiveStatus(chatId);
  const keepWarm = shouldKeepChatHostMounted({
    visible,
    doneAt,
    archivedAt,
    liveStatus,
    tabOpen,
  });
  const [mounted, setMounted] = useState(visible || keepWarm);
  const onHydrated = useCallback(
    () => endChatSwitch("AgentChatHost", chatId),
    [chatId],
  );
  useEffect(() => {
    if (visible || keepWarm) {
      setMounted(true);
      return;
    }
    setMounted(false);
  }, [visible, keepWarm]);
  useEffect(() => {
    if (mounted || keepWarm) return;
    dropCachedSessionBody(wsId, chatId);
  }, [mounted, keepWarm, wsId, chatId]);
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
});

export function AgentModeShell({ wsId }: Props) {
  const openIds = useStore((s) => s.openIds);
  const loaded = useStore((s) => s.loaded);
  const recent = useStore((s) => s.recent);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const openWorkspace = useStore((s) => s.openWorkspace);

  useEffect(() => {
    logAgentModePhase("agent-shell mounted", { wsId });
  }, [wsId]);

  // Which session fills the center column — module-level so Agent↔IDE
  // shell remount does not forget the pick (component state used to).
  const [, setSelTick] = useState(0);
  const bumpSel = () => setSelTick((n) => n + 1);

  // File opened from the Files tab (agent mode has no editor pane).
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [contextW, setContextW] = useState(getAgentContextWidth);
  const setContextWidth = useCallback((w: number) => {
    const next = clampAgentContextWidth(w);
    setContextW(next);
    setAgentContextWidth(next);
  }, []);

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
  const dockEditorDrawer = useStore((s) => s.dockEditorDrawer);
  const setEditorDrawerW = useStore((s) => s.setEditorDrawerW);
  const [drawerContainer, setDrawerContainer] = useState<HTMLElement | null>(
    null,
  );
  const [drawerLinger, setDrawerLinger] = useState<EditorDrawerState | null>(
    null,
  );
  const drawerLive = ws?.layout.editorDrawer;
  const drawerOpen = !!drawerLive?.tabKey;

  useEffect(() => {
    if (drawerLive?.tabKey) setDrawerLinger(drawerLive);
  }, [drawerLive?.tabKey, drawerLive?.width]);

  const registerDrawerContainer = useCallback((node: HTMLElement | null) => {
    setDrawerContainer(node);
  }, []);

  const onDrawerExited = useCallback(() => {
    const cur = useStore.getState().loaded[wsId]?.layout.editorDrawer;
    if (!cur?.tabKey) setDrawerLinger(null);
  }, [wsId]);

  const chatsFor = (id: string) => {
    const w = loaded[id];
    if (!w) return [];
    return Object.values(w.aiChats).sort((a, b) => a.createdAt - b.createdAt);
  };

  // Resolve the center session: remembered pick → IDE-focused AI tab →
  // most recent. Seeding the module map keeps Agent↔IDE round-trips stable.
  const activeChats = chatsFor(wsId);
  const remembered = getAgentSelectedChat(wsId);
  const ideFocused = ws ? activeAiChatId(ws) : null;
  const activeChatId =
    remembered && ws?.aiChats[remembered]
      ? remembered
      : ideFocused && ws?.aiChats[ideFocused]
        ? ideFocused
        : activeChats.length
          ? activeChats[activeChats.length - 1].id
          : null;

  useEffect(() => {
    if (activeChatId) setAgentSelectedChat(wsId, activeChatId);
  }, [wsId, activeChatId]);

  const switching = useChatSwitching();

  const [, setAgentStatusTick] = useState(0);
  useEffect(() => subscribeAgentStatus(() => setAgentStatusTick((t) => t + 1)), []);

  // Mount sticky (working / needs-input) + warm LRU + per-ws last selection
  // from EVERY open workspace. Without the warm set, every Agent Mode hop
  // remounted AIChatPanel (Audit: 0/15 alreadyMounted, hydrate 70–380ms).
  // Surface visibility stays gated to the active workspace selection below.
  const switchTarget = getChatSwitchTarget();
  const mountChats: Array<{
    chatWsId: string;
    root: string;
    chat: (typeof activeChats)[number];
    tabOpen: boolean;
  }> = [];
  for (const id of openIds) {
    const w = loaded[id];
    if (!w) continue;
    const wsSelected = getAgentSelectedChat(id);
    for (const chat of chatsFor(id)) {
      const keepSurface =
        (id === wsId && chat.id === activeChatId) ||
        (switching && switchTarget !== null && chat.id === switchTarget);
      const live = getAgentStatus(chat.id)?.derived ?? null;
      // Per-ws last pick stays mounted across cross-ws flips (veil can end
      // before setActiveWorkspace resolves — was a second cold remount).
      const tabOpen =
        chat.id === wsSelected || isAgentChatWarm(chat.id);
      if (
        !shouldKeepChatHostMounted({
          visible: keepSurface,
          doneAt: chat.doneAt,
          archivedAt: chat.archivedAt,
          liveStatus: live,
          tabOpen,
        })
      ) {
        continue;
      }
      mountChats.push({
        chatWsId: id,
        root: w.meta.root,
        chat,
        tabOpen,
      });
    }
  }

  const recentNotOpen = recent.filter((w) => !openIds.includes(w.id));

  const selectSession = (id: string, chatId: string) => {
    const crossWs = id !== wsId;
    // Touch BEFORE mount pass so the target enters the warm set this frame
    // (and survives veil-down before a cross-ws setActiveWorkspace resolves).
    touchAgentChatWarm(chatId);
    if (chatId !== activeChatId || crossWs) {
      const alreadyMounted = mountChats.some((m) => m.chat.id === chatId);
      logChatSwitch("agent select", {
        chatId,
        activeChatId,
        crossWs,
        wsId: id,
        alreadyMounted,
      });
      // Warm hop: CSS toggle only — veil made 160–220ms floors feel heavy
      // even when hydrate was already done (Cursor has no loader on revisit).
      pulseChatSwitch({
        veil: !alreadyMounted,
        flush: crossWs,
        flushWsId: crossWs ? wsId : undefined,
        source: "AgentModeShell.selectSession",
        chatId,
      });
    }
    if (crossWs) void setActiveWorkspace(id);
    setAgentSelectedChat(id, chatId);
    bumpSel();
    // Keep IDE tab focus in sync so Agent→IDE lands on the same chat.
    useStore.getState().focusAIChat(id, chatId);
  };

  const newSession = (
    id: string,
    anchor: { x: number; y: number },
  ) => {
    const chatId = addNewAIChat(id, "editor", anchor);
    touchAgentChatWarm(chatId);
    if (id !== wsId) void setActiveWorkspace(id);
    setAgentSelectedChat(id, chatId);
    bumpSel();
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
            if (getAgentSelectedChat(id) === chatId) {
              clearAgentSelectedChat(id);
              bumpSel();
            }
          }}
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
            {mountChats.length > 0 && (
              <div
                className={`agent-main-chat-panels${switching ? " is-switching" : ""}`}
              >
                {mountChats.map(({ chatWsId, root, chat, tabOpen }) => {
                  // Mount/hydrate while switching; only hide the surface
                  // (parent `.is-switching` + aria) so cold load isn't deferred
                  // until after the 1s CAP. Cross-ws sticky hosts stay
                  // invisible until their project is active again.
                  const isActive =
                    chatWsId === wsId && chat.id === activeChatId;
                  const isPulseTarget =
                    switching &&
                    switchTarget !== null &&
                    chat.id === switchTarget;
                  const hostVisible = isActive || isPulseTarget;
                  return (
                    <AgentChatHost
                      key={chat.id}
                      wsId={chatWsId}
                      root={root}
                      chatId={chat.id}
                      visible={hostVisible}
                      tabOpen={tabOpen}
                      doneAt={chat.doneAt}
                      archivedAt={chat.archivedAt}
                      onOpenFile={setOpenFilePath}
                    />
                  );
                })}
              </div>
            )}
            {ws && activeChats.length === 0 && (
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

      {/* ── Context column (Changes / Files / Terminals) ─────── */}
      {ws && (
        <>
          <div
            className="vsplit agent-context-vsplit"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize context panel"
            aria-valuenow={contextW}
            aria-valuemin={AGENT_CONTEXT_MIN_W}
            aria-valuemax={AGENT_CONTEXT_MAX_W}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const dir = e.key === "ArrowRight" ? 1 : -1;
              const step = e.shiftKey ? 60 : 20;
              setContextWidth(contextW + dir * step);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = contextW;
              const onMove = (ev: MouseEvent) => {
                // Dragging the left edge: move left → wider panel.
                setContextWidth(startW - (ev.clientX - startX));
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          />
          <AgentContextColumn
            wsId={wsId}
            root={ws.meta.root}
            activeChatId={activeChatId}
            frozen={switching}
            width={contextW}
            onOpenFile={setOpenFilePath}
          />
        </>
      )}

      {/* ── File popup (Files tab → click) ────────────────────── */}
      <FilePopupModal
        path={openFilePath}
        root={ws?.meta.root ?? ""}
        onClose={() => setOpenFilePath(null)}
      />

      {colorMenu && (
        <WorkspaceColorPopover
          wsId={colorMenu.wsId}
          root={loaded[colorMenu.wsId]?.meta.root ?? ""}
          x={colorMenu.x}
          y={colorMenu.y}
          nameAnchor={colorMenu.nameAnchor}
          onClose={() => setColorMenu(null)}
          onNewChat={newSession}
        />
      )}

      {drawerLinger?.tabKey && drawerContainer && ws && (
        <TabContentHost
          wsId={wsId}
          ws={ws}
          tabKey={drawerLinger.tabKey}
          container={drawerContainer}
          visible={drawerOpen}
          showHeavy
          editorsReady
        />
      )}
      {drawerLinger?.tabKey && ws && (
        <EditorTabDrawer
          wsId={wsId}
          ws={ws}
          tabKey={drawerLinger.tabKey}
          width={drawerLinger.width}
          open={drawerOpen}
          registerContainer={registerDrawerContainer}
          onResize={(w) => setEditorDrawerW(wsId, w)}
          onDock={() => dockEditorDrawer(wsId)}
          onExited={onDrawerExited}
        />
      )}
    </div>
  );
}
