import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorPane } from "./EditorPane";
import { MediaPreviewPane } from "./MediaPreviewPane";
import { SessionTranscriptPane } from "./SessionTranscriptPane";
import { mediaKindOf } from "../mediaPreview";
import { TerminalCore } from "./TerminalCore";
import { PaneNode } from "./PaneNode";
import { SidebarStack } from "./SidebarStack";
import { AIChatPanel } from "./AIChatPanel";
import { AIIcon } from "./AIIcon";
import { SubagentTranscriptView } from "./SubagentTranscriptView";
import { ComposeReviewPane } from "./ComposeReviewPane";
import { HtmlPreviewPane } from "./HtmlPreviewPane";
import { WhiteboardPane } from "./WhiteboardPane";
import { UsagePanel } from "./UsagePanel";
import { BrainPanel } from "./BrainPanel";
import {
  aiKey,
  findTabsPaneByTab,
  parseKey,
  termKey,
  useStore,
  type PaneId,
  type TerminalLocation,
} from "../store";
import { pty, type ShellOption } from "../ipc";
import { redockTerminal } from "../terminalPopout";
import { Icon } from "./Icon";
import { useZenMode } from "../zenMode";
import { ChatSwitchVeil } from "./ChatSwitchVeil";
import { useChatSwitching } from "../useChatSwitching";

interface Props {
  wsId: string;
  isActive: boolean;
}

interface ShellDropdownProps {
  anchor: HTMLElement | null;
  shells: ShellOption[];
  onClose: () => void;
  onPick: (shell?: ShellOption) => void;
}

function ShellDropdown({ anchor, shells, onClose, onPick }: ShellDropdownProps) {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 2,
    right: Math.max(8, window.innerWidth - rect.right),
    left: "auto",
  };
  return createPortal(
    <>
      <div className="menu-overlay" onClick={onClose} />
      <div className="menu-dropdown shell-dropdown" style={style}>
        <button className="menu-item" onClick={() => onPick()}>
          <span className="menu-item-label">Default shell</span>
        </button>
        {shells.length > 0 && <div className="menu-separator" />}
        {shells.map((sh) => (
          <button
            key={sh.id}
            className="menu-item"
            onClick={() => onPick(sh)}
            title={sh.path}
          >
            <span className="menu-item-label">{sh.label}</span>
            <span className="menu-item-accel">{sh.id}</span>
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}

export function WorkspaceShell({ wsId, isActive }: Props) {
  const ws = useStore((s) => s.loaded[wsId]);
  const setTermH = useStore((s) => s.setTermH);
  const setBottomVisible = useStore((s) => s.setBottomVisible);
  const addTerminal = useStore((s) => s.addTerminal);
  const setAIPanelW = useStore((s) => s.setAIPanelW);
  const setAIPanelVisible = useStore((s) => s.setAIPanelVisible);
  const zen = useZenMode();

  const [paneContainers, setPaneContainers] = useState<
    Record<PaneId, HTMLElement>
  >({});
  const [shells, setShells] = useState<ShellOption[]>([]);
  const [addOpen, setAddOpen] = useState<"bottom" | null>(null);
  const bottomAddBtnRef = useRef<HTMLButtonElement>(null);

  const registerContainer = useCallback(
    (paneId: PaneId, node: HTMLElement | null) => {
      setPaneContainers((prev) => {
        const cur = prev[paneId];
        if (node === cur) return prev;
        if (!node) {
          if (!(paneId in prev)) return prev;
          const { [paneId]: _drop, ...rest } = prev;
          return rest;
        }
        return { ...prev, [paneId]: node };
      });
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    pty
      .availableShells()
      .then((s) => {
        if (alive) setShells(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const spawnTerminal = (location: TerminalLocation, shell?: ShellOption) => {
    setAddOpen(null);
    addTerminal(
      wsId,
      location,
      shell
        ? { path: shell.path, args: shell.args, label: shell.label }
        : undefined,
    );
  };

  // Remembered narrow width for the AI panel expand/collapse toggle.
  // Lets a one-click expand snap to wide, then snap back to whatever
  // the user had drag-set (not the 380 default).
  const lastNarrowAiWRef = useRef<number | null>(null);

  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!ws || autoCreatedRef.current) return;
    autoCreatedRef.current = true;
    if (Object.keys(ws.terminals).length === 0) {
      addTerminal(wsId, "bottom");
    }
  }, [ws, wsId, addTerminal]);

  if (!ws) return null;
  const layout = ws.layout;

  return (
    <div
      className="shell"
      style={{ display: isActive ? "flex" : "none" }}
      data-ws-id={wsId}
      data-sidebar-side={layout.sidebarSide}
    >
      {layout.sidebarVisible && !zen && <SidebarStack wsId={wsId} ws={ws} />}
      {/* The cross-project Agent Hub (was the per-workspace AI rail) now
          mounts once at App root — see App.tsx. */}
      {layout.aiPanelVisible && !zen && (
        <>
          <div
            className="vsplit ai-vsplit"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = layout.aiPanelW;
              const onMove = (ev: MouseEvent) => {
                setAIPanelW(wsId, startW - (ev.clientX - startX));
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          />
          <div
            className="ai-side-panel"
            style={{ width: layout.aiPanelW }}
          >
            <div className="ai-side-panel-header">
              <span className="ai-side-panel-title">
                <AIIcon size={14} /> AI Chat
              </span>
              {(() => {
                // Quick width toggle. The drag-resize handle is precise but
                // slow; a one-click "give me reading room" snap covers the
                // common request ("the chat is too narrow to read code in").
                // Toggles between a wide preset (720) and the user's last
                // remembered narrow width (preserved in a ref so collapsing
                // restores their feel, not the 380 default).
                const wideThreshold = 600;
                const isWide = layout.aiPanelW >= wideThreshold;
                return (
                  <button
                    className="ai-side-panel-expand"
                    onClick={() => {
                      if (isWide) {
                        const restore = lastNarrowAiWRef.current ?? 380;
                        setAIPanelW(wsId, restore);
                      } else {
                        lastNarrowAiWRef.current = layout.aiPanelW;
                        setAIPanelW(wsId, 720);
                      }
                    }}
                    title={
                      isWide
                        ? "Collapse AI panel back to narrow"
                        : "Expand AI panel for more reading room"
                    }
                  >
                    {isWide ? "⇥" : "⇤"}
                  </button>
                );
              })()}
              <button
                className="ai-side-panel-close"
                onClick={() => setAIPanelVisible(wsId, false)}
                title="Hide AI panel"
              >
                ×
              </button>
            </div>
            <div className="ai-side-panel-body">
              <AIChatPanel wsId={wsId} root={ws.meta.root} />
            </div>
          </div>
        </>
      )}
      <div className="main-col">
        <div className="editor-area">
          <PaneNode
            wsId={wsId}
            ws={ws}
            pane={layout.editorRoot}
            registerContainer={registerContainer}
            rootPaneId={layout.editorRoot.id}
          />
        </div>
        {/*
          Bottom panel: kept mounted (just visually hidden via display:none)
          when bottomVisible is false. Unmounting + remounting it would
          tear down the pane container DOM nodes that TerminalCore
          portals into — and re-opening an xterm Terminal on a new DOM
          node is fragile (silent loss of buffer + listeners). Keeping
          the panel in the DOM means the same container ref stays valid
          across hide/show, so terminals just disappear/reappear without
          losing state. Pay-cost: a sliver of layout space; worth it.
        */}
        {layout.bottomRoot && !zen && (
          <>
            {layout.bottomVisible && (
              <div
                className="hsplit"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize bottom panel"
                aria-valuenow={layout.termH}
                aria-valuemin={80}
                aria-valuemax={800}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  // ArrowUp grows the bottom panel (taller), ArrowDown
                  // shrinks it. Matches the mouse drag where dragging up
                  // grows the panel.
                  const dir = e.key === "ArrowUp" ? 1 : -1;
                  const step = e.shiftKey ? 60 : 20;
                  const next = Math.max(
                    80,
                    Math.min(800, layout.termH + dir * step),
                  );
                  setTermH(wsId, next);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startH = layout.termH;
                  const onMove = (ev: MouseEvent) => {
                    setTermH(
                      wsId,
                      Math.max(80, Math.min(800, startH - (ev.clientY - startY))),
                    );
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
              />
            )}
            <div
              className="bottom-area"
              style={{
                height: layout.termH,
                display: layout.bottomVisible ? undefined : "none",
              }}
            >
              <PaneNode
                wsId={wsId}
                ws={ws}
                pane={layout.bottomRoot}
                registerContainer={registerContainer}
                rootPaneId={layout.bottomRoot.id}
                rightSlotForRoot={
                  <>
                    <button
                      ref={bottomAddBtnRef}
                      className="tab-add"
                      title="New terminal"
                      onClick={() =>
                        setAddOpen(addOpen === "bottom" ? null : "bottom")
                      }
                    >
                      + Term ▾
                    </button>
                    <button
                      className="tab-add"
                      title="Hide panel"
                      onClick={() => setBottomVisible(wsId, false)}
                    >
                      ▾
                    </button>
                  </>
                }
              />
            </div>
          </>
        )}
      </div>

      {addOpen === "bottom" && (
        <ShellDropdown
          anchor={bottomAddBtnRef.current}
          shells={shells}
          onClose={() => setAddOpen(null)}
          onPick={(sh) => spawnTerminal("bottom", sh)}
        />
      )}

      {/* File editors: one per pane that has an active file tab. */}
      {(() => {
        const overlays: React.ReactNode[] = [];
        const visit = (pane: typeof layout.editorRoot) => {
          if (pane.kind === "tabs") {
            const active = pane.active;
            if (active && active.startsWith("file:")) {
              const path = active.slice(5);
              const container = paneContainers[pane.id];
              const media = mediaKindOf(path);
              // Media panes (image / pdf) render without a backing
              // ws.files entry — they read bytes themselves. Session
              // tabs are handled by the separate portal below; we skip
              // them here so they don't double-mount.
              const isSessionTab = media === "session-transcript";
              const canRender =
                container && !isSessionTab &&
                (media !== null || ws.files[path]);
              if (canRender) {
                overlays.push(
                  createPortal(
                    media ? (
                      <MediaPreviewPane
                        key={pane.id + ":" + path}
                        wsId={wsId}
                        path={path}
                        kind={media}
                      />
                    ) : (
                      <EditorPane
                        key={pane.id + ":" + path}
                        wsId={wsId}
                        path={path}
                      />
                    ),
                    container,
                    pane.id + ":" + path,
                  ),
                );
              }
            }
          } else {
            visit(pane.first);
            visit(pane.second);
          }
        };
        visit(layout.editorRoot);
        if (layout.bottomRoot && layout.bottomVisible) {
          visit(layout.bottomRoot);
        }
        return <>{overlays}</>;
      })()}

      {/* AI chats: one AIChatHost per descriptor. Internally portals an
          AIChatPanel into the pane container that currently owns the
          tab. Because the React component itself stays mounted across
          container changes, in-flight streams + chat state survive a
          tab being dragged from one pane to another. Only mount hosts
          for the active workspace — background projects hydrate from
          the store without paying per-chat panel cost. */}
      {isActive &&
        Object.values(ws.aiChats).map((chat) => {
        const tabKeyStr = aiKey(chat.id);
        const editorPane = findTabsPaneByTab(layout.editorRoot, tabKeyStr);
        const bottomPane = layout.bottomRoot
          ? findTabsPaneByTab(layout.bottomRoot, tabKeyStr)
          : null;
        const pane = editorPane ?? bottomPane;
        const inBottom = !editorPane && !!bottomPane;
        const container = pane ? (paneContainers[pane.id] ?? null) : null;
        const visible =
          isActive &&
          !!pane &&
          pane.active === tabKeyStr &&
          (inBottom ? layout.bottomVisible : true);
        return (
          <AIChatHost
            key={chat.id}
            wsId={wsId}
            root={ws.meta.root}
            chatId={chat.id}
            container={container}
            visible={visible}
          />
        );
      })}

      {/* Read-only subagent transcript tabs. Their `sub:` keys live only
          in the layout (no descriptor record), so we walk the pane tree
          to find them and portal one viewer per open key. */}
      {(() => {
        const keys = new Set<string>();
        const walk = (pane: typeof layout.editorRoot) => {
          if (pane.kind === "tabs") {
            pane.tabs.forEach((k) => {
              if (k.startsWith("sub:")) keys.add(k);
            });
          } else {
            walk(pane.first);
            walk(pane.second);
          }
        };
        walk(layout.editorRoot);
        if (layout.bottomRoot) walk(layout.bottomRoot);
        return [...keys].map((key) => {
          const parsed = parseKey(key);
          if (parsed?.kind !== "subagent") return null;
          const editorPane = findTabsPaneByTab(layout.editorRoot, key);
          const bottomPane = layout.bottomRoot
            ? findTabsPaneByTab(layout.bottomRoot, key)
            : null;
          const pane = editorPane ?? bottomPane;
          const inBottom = !editorPane && !!bottomPane;
          const container = pane ? (paneContainers[pane.id] ?? null) : null;
          const visible =
            isActive &&
            !!pane &&
            pane.active === key &&
            (inBottom ? layout.bottomVisible : true);
          return (
            <SubagentTranscriptView
              key={key}
              root={ws.meta.root}
              sessionId={parsed.sessionId}
              toolUseId={parsed.toolUseId}
              agentType={parsed.agentType}
              container={container}
              visible={visible}
            />
          );
        });
      })()}

      {/* Agent edit review — Conductor-style diff tabs (`crev:` keys). */}
      {(() => {
        const keys = new Set<string>();
        const walk = (pane: typeof layout.editorRoot) => {
          if (pane.kind === "tabs") {
            pane.tabs.forEach((k) => {
              if (k.startsWith("crev:")) keys.add(k);
            });
          } else {
            walk(pane.first);
            walk(pane.second);
          }
        };
        walk(layout.editorRoot);
        if (layout.bottomRoot) walk(layout.bottomRoot);
        return [...keys].map((key) => {
          const parsed = parseKey(key);
          if (parsed?.kind !== "composeReview") return null;
          const editorPane = findTabsPaneByTab(layout.editorRoot, key);
          const bottomPane = layout.bottomRoot
            ? findTabsPaneByTab(layout.bottomRoot, key)
            : null;
          const pane = editorPane ?? bottomPane;
          const inBottom = !editorPane && !!bottomPane;
          const container = pane ? (paneContainers[pane.id] ?? null) : null;
          const visible =
            isActive &&
            !!pane &&
            pane.active === key &&
            (inBottom ? layout.bottomVisible : true);
          if (!container) return null;
          return createPortal(
            <ComposeReviewPane
              key={key}
              wsId={wsId}
              tabKey={key}
              visible={visible}
            />,
            container,
            key,
          );
        });
      })()}

      {/* Agent HTML preview tabs (`prev:` keys). */}
      {(() => {
        const keys = new Set<string>();
        const walk = (pane: typeof layout.editorRoot) => {
          if (pane.kind === "tabs") {
            pane.tabs.forEach((k) => {
              if (k.startsWith("prev:")) keys.add(k);
            });
          } else {
            walk(pane.first);
            walk(pane.second);
          }
        };
        walk(layout.editorRoot);
        if (layout.bottomRoot) walk(layout.bottomRoot);
        return [...keys].map((key) => {
          const parsed = parseKey(key);
          if (parsed?.kind !== "htmlPreview") return null;
          const editorPane = findTabsPaneByTab(layout.editorRoot, key);
          const bottomPane = layout.bottomRoot
            ? findTabsPaneByTab(layout.bottomRoot, key)
            : null;
          const pane = editorPane ?? bottomPane;
          const inBottom = !editorPane && !!bottomPane;
          const container = pane ? (paneContainers[pane.id] ?? null) : null;
          const visible =
            isActive &&
            !!pane &&
            pane.active === key &&
            (inBottom ? layout.bottomVisible : true);
          if (!container || !visible) return null;
          return createPortal(
            <HtmlPreviewPane key={key} tabKey={key} />,
            container,
            key,
          );
        });
      })()}

      {/* Whiteboard tab — one persistent per workspace. Walk the pane
          tree for `wb:` keys and portal one WhiteboardPane per key. */}
      {(() => {
        const keys = new Set<string>();
        const walk = (pane: typeof layout.editorRoot) => {
          if (pane.kind === "tabs") {
            pane.tabs.forEach((k) => {
              if (k.startsWith("wb:")) keys.add(k);
            });
          } else {
            walk(pane.first);
            walk(pane.second);
          }
        };
        walk(layout.editorRoot);
        if (layout.bottomRoot) walk(layout.bottomRoot);
        return [...keys].map((key) => {
          const parsed = parseKey(key);
          if (parsed?.kind !== "whiteboard") return null;
          const editorPane = findTabsPaneByTab(layout.editorRoot, key);
          const bottomPane = layout.bottomRoot
            ? findTabsPaneByTab(layout.bottomRoot, key)
            : null;
          const pane = editorPane ?? bottomPane;
          const inBottom = !editorPane && !!bottomPane;
          const container = pane ? (paneContainers[pane.id] ?? null) : null;
          const visible =
            isActive &&
            !!pane &&
            pane.active === key &&
            (inBottom ? layout.bottomVisible : true);
          return (
            <WhiteboardPane
              key={key}
              wsId={wsId}
              root={ws.meta.root}
              container={container}
              visible={visible}
            />
          );
        });
      })()}

      {/* Session transcript tabs — one per open Claude Code session.
          Uses the same portal pattern as Whiteboard; the pane fetches
          turns lazily via `claude_session_load_turns` so a multi-MB
          session never blocks the tab open. */}
      {(() => {
        const keys = new Set<string>();
        const walk = (pane: typeof layout.editorRoot) => {
          if (pane.kind === "tabs") {
            pane.tabs.forEach((k) => {
              if (k.startsWith("sess:")) keys.add(k);
            });
          } else {
            walk(pane.first);
            walk(pane.second);
          }
        };
        walk(layout.editorRoot);
        if (layout.bottomRoot) walk(layout.bottomRoot);
        return [...keys].map((key) => {
          const parsed = parseKey(key);
          if (parsed?.kind !== "session") return null;
          const editorPane = findTabsPaneByTab(layout.editorRoot, key);
          const bottomPane = layout.bottomRoot
            ? findTabsPaneByTab(layout.bottomRoot, key)
            : null;
          const pane = editorPane ?? bottomPane;
          const inBottom = !editorPane && !!bottomPane;
          const container = pane ? (paneContainers[pane.id] ?? null) : null;
          const visible =
            isActive &&
            !!pane &&
            pane.active === key &&
            (inBottom ? layout.bottomVisible : true);
          if (!container || !visible) return null;
          return createPortal(
            <SessionTranscriptPane key={key} tabKey={key} />,
            container,
            key,
          );
        });
      })()}

      {/* Usage tab — one per workspace. Same portal pattern; the panel
          polls the Rust backend for the live cost monitor. Only mounted
          when its tab is the active one so the 12s poll doesn't run for
          background tabs. */}
      {(() => {
        const keys = new Set<string>();
        const walk = (pane: typeof layout.editorRoot) => {
          if (pane.kind === "tabs") {
            pane.tabs.forEach((k) => {
              if (k.startsWith("usage:")) keys.add(k);
            });
          } else {
            walk(pane.first);
            walk(pane.second);
          }
        };
        walk(layout.editorRoot);
        if (layout.bottomRoot) walk(layout.bottomRoot);
        return [...keys].map((key) => {
          if (parseKey(key)?.kind !== "usage") return null;
          const editorPane = findTabsPaneByTab(layout.editorRoot, key);
          const bottomPane = layout.bottomRoot
            ? findTabsPaneByTab(layout.bottomRoot, key)
            : null;
          const pane = editorPane ?? bottomPane;
          const inBottom = !editorPane && !!bottomPane;
          const container = pane ? (paneContainers[pane.id] ?? null) : null;
          const visible =
            isActive &&
            !!pane &&
            pane.active === key &&
            (inBottom ? layout.bottomVisible : true);
          if (!container || !visible) return null;
          return createPortal(
            <UsagePanel key={key} wsId={wsId} root={ws.meta.root} />,
            container,
            key,
          );
        });
      })()}

      {/* Pinky Brain tab — hybrid knowledge search per workspace. */}
      {(() => {
        const keys = new Set<string>();
        const walk = (pane: typeof layout.editorRoot) => {
          if (pane.kind === "tabs") {
            pane.tabs.forEach((k) => {
              if (k.startsWith("brain:")) keys.add(k);
            });
          } else {
            walk(pane.first);
            walk(pane.second);
          }
        };
        walk(layout.editorRoot);
        if (layout.bottomRoot) walk(layout.bottomRoot);
        return [...keys].map((key) => {
          if (parseKey(key)?.kind !== "brain") return null;
          const editorPane = findTabsPaneByTab(layout.editorRoot, key);
          const bottomPane = layout.bottomRoot
            ? findTabsPaneByTab(layout.bottomRoot, key)
            : null;
          const pane = editorPane ?? bottomPane;
          const inBottom = !editorPane && !!bottomPane;
          const container = pane ? (paneContainers[pane.id] ?? null) : null;
          const visible =
            isActive &&
            !!pane &&
            pane.active === key &&
            (inBottom ? layout.bottomVisible : true);
          if (!container || !visible) return null;
          return createPortal(
            <BrainPanel key={key} wsId={wsId} root={ws.meta.root} />,
            container,
            key,
          );
        });
      })()}

      {/* Terminals: one TerminalCore per terminal, portal-ed to its current pane's container. */}
      {Object.values(ws.terminals).map((t) => {
        const tabKeyStr = termKey(t.id);
        const editorPane = findTabsPaneByTab(layout.editorRoot, tabKeyStr);
        const bottomPane = layout.bottomRoot
          ? findTabsPaneByTab(layout.bottomRoot, tabKeyStr)
          : null;
        const pane = editorPane ?? bottomPane;
        const inBottom = !editorPane && !!bottomPane;
        const container = pane ? (paneContainers[pane.id] ?? null) : null;
        const visible =
          isActive &&
          !!pane &&
          pane.active === tabKeyStr &&
          (inBottom ? layout.bottomVisible : true);
        // While popped out, hide the in-window xterm and render a placeholder
        // in its slot. The popout window owns the only live xterm bound to
        // this PTY; on re-dock the terminal is re-mounted and replays the
        // backend's scrollback.
        if (t.popped) {
          return (
            <PoppedPlaceholder
              key={t.id}
              container={container}
              visible={visible}
              title={t.title}
              onRedock={() => {
                void redockTerminal(t.id);
              }}
            />
          );
        }
        return (
          <TerminalCore
            key={t.id}
            termId={t.id}
            cwd={ws.meta.root}
            container={container}
            visible={visible}
            shellPath={t.shell?.path}
            shellArgs={t.shell?.args}
            title={t.title}
            ptyId={t.ptyId}
            onPtyIdChange={(id) =>
              useStore.getState().setTerminalPtyId(wsId, t.id, id)
            }
          />
        );
      })}
    </div>
  );
}

interface AIChatHostProps {
  wsId: string;
  root: string;
  chatId: string;
  container: HTMLElement | null;
  visible: boolean;
}

function AIChatHost({
  wsId,
  root,
  chatId,
  container,
  visible,
}: AIChatHostProps) {
  const switching = useChatSwitching();
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);
  if (!container || !mounted) return null;
  const showVeil = switching && visible;
  return createPortal(
    <div
      className={`ai-tab-host${showVeil ? " is-switching" : ""}`}
      style={{ display: visible ? "flex" : "none" }}
    >
      <AIChatPanel
        wsId={wsId}
        root={root}
        aiChatId={chatId}
        chatVisible={visible}
      />
      {showVeil && <ChatSwitchVeil />}
    </div>,
    container,
  );
}

interface PoppedPlaceholderProps {
  container: HTMLElement | null;
  visible: boolean;
  title: string;
  onRedock: () => void;
}

function PoppedPlaceholder({
  container,
  visible,
  title,
  onRedock,
}: PoppedPlaceholderProps) {
  if (!container) return null;
  return createPortal(
    <div
      className="popped-placeholder"
      style={{ display: visible ? "flex" : "none" }}
    >
      <div className="popped-placeholder-card">
        <div className="popped-placeholder-icon">
          <Icon name="external-link" size={28} />
        </div>
        <div className="popped-placeholder-title">
          {title} is in a separate window
        </div>
        <div className="popped-placeholder-hint">
          Closing the pop-out window or clicking re-dock brings it back here.
        </div>
        <button className="popped-placeholder-btn" onClick={onRedock}>
          <Icon name="rotate-ccw" size={12} />
          <span>Re-dock now</span>
        </button>
      </div>
    </div>,
    container,
  );
}

