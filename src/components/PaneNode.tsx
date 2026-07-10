import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  parseKey,
  useStore,
  type DropEdge,
  type Pane,
  type PaneId,
  type WorkspaceData,
} from "../store";
import {
  endDrag,
  getDrag,
  startDrag,
  updateDrag,
  useDrag,
} from "../dragState";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { addNewAIChat, anchorFromElement } from "../addNewAIChat";
import { runCommand } from "../actions";
import { openPalette } from "../paletteBus";
import { prompt as dialogPrompt } from "../dialog";
import { popOutTerminal, redockTerminal } from "../terminalPopout";
import { AIIcon } from "./AIIcon";
import { duckAvatarFor } from "../subagents";
import { lookupRemoteLink } from "../sftpLinks";
import { basename, relPath } from "../pathUtils";
import { revealInTree } from "../revealInTree";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Icon } from "./Icon";
import { peekClosedTabs, subscribeClosedTabs } from "../closedTabsStack";
import { setAgentMode } from "../agentMode";
import { htmlPreviewPayload } from "../htmlPreview";

function tabLabel(
  ws: WorkspaceData,
  key: string,
): {
  label: string;
  dirty: boolean;
  isTerminal: boolean;
  isAI: boolean;
  popped: boolean;
  /** Read-only subagent transcript tab — drives the duck-avatar tab icon. */
  subAvatar?: string;
  /** Whiteboard tab — uses the dedicated "whiteboard" SVG icon. */
  isWhiteboard?: boolean;
  /** Usage tab — uses the "chart-bar" SVG icon. */
  isUsage?: boolean;
  /** Agent edit review diff tab. */
  isComposeReview?: boolean;
  composeReviewPath?: string;
  /** Agent HTML preview tab. */
  isHtmlPreview?: boolean;
} {
  const parsed = parseKey(key);
  if (parsed?.kind === "terminal") {
    const t = ws.terminals[parsed.id];
    return {
      label: t?.title ?? "Terminal",
      dirty: false,
      isTerminal: true,
      isAI: false,
      popped: !!t?.popped,
    };
  }
  if (parsed?.kind === "ai") {
    const a = ws.aiChats[parsed.id];
    return {
      label: a?.title ?? "AI Chat",
      dirty: false,
      isTerminal: false,
      isAI: true,
      popped: false,
    };
  }
  if (parsed?.kind === "whiteboard") {
    return {
      label: "Organigramma",
      dirty: false,
      isTerminal: false,
      isAI: false,
      popped: false,
      isWhiteboard: true,
    };
  }
  if (parsed?.kind === "usage") {
    return {
      label: "Usage",
      dirty: false,
      isTerminal: false,
      isAI: false,
      popped: false,
      isUsage: true,
    };
  }
  if (parsed?.kind === "subagent") {
    return {
      label: parsed.agentType || "Subagent",
      dirty: false,
      isTerminal: false,
      isAI: false,
      popped: false,
      subAvatar: duckAvatarFor(parsed.agentType),
    };
  }
  if (parsed?.kind === "composeReview") {
    return {
      label: basename(parsed.path),
      dirty: false,
      isTerminal: false,
      isAI: false,
      popped: false,
      isComposeReview: true,
      composeReviewPath: parsed.path,
    };
  }
  if (parsed?.kind === "htmlPreview") {
    const payload = htmlPreviewPayload(key);
    return {
      label: payload?.title ?? "HTML preview",
      dirty: false,
      isTerminal: false,
      isAI: false,
      popped: false,
      isHtmlPreview: true,
    };
  }
  if (parsed?.kind === "file") {
    const f = ws.files[parsed.path];
    return {
      label: basename(parsed.path),
      dirty: f ? f.contents !== f.original : false,
      isTerminal: false,
      isAI: false,
      popped: false,
    };
  }
  return {
    label: key,
    dirty: false,
    isTerminal: false,
    isAI: false,
    popped: false,
  };
}

function computeEdgeForPoint(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): DropEdge {
  const rect = el.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x > 0.25 && x < 0.75 && y > 0.25 && y < 0.75) return "center";
  const dLeft = x;
  const dRight = 1 - x;
  const dTop = y;
  const dBottom = 1 - y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return "left";
  if (min === dRight) return "right";
  if (min === dTop) return "top";
  return "bottom";
}

interface PaneNodeProps {
  wsId: string;
  ws: WorkspaceData;
  pane: Pane;
  registerContainer: (paneId: PaneId, node: HTMLElement | null) => void;
  rightSlotForRoot?: React.ReactNode;
  rootPaneId?: PaneId;
}

export function PaneNode(props: PaneNodeProps) {
  if (props.pane.kind === "split") {
    return <SplitPaneView {...props} pane={props.pane} />;
  }
  return <TabsPaneView {...props} pane={props.pane} />;
}

function SplitPaneView(
  props: PaneNodeProps & { pane: Extract<Pane, { kind: "split" }> },
) {
  const { wsId, ws, pane, registerContainer, rootPaneId } = props;
  const setSplitRatio = useStore((s) => s.setSplitRatio);
  const containerRef = useRef<HTMLDivElement>(null);

  const horizontal = pane.orientation === "horizontal";
  const ratio = pane.ratio;

  return (
    <div
      ref={containerRef}
      className={`split-pane ${horizontal ? "split-h" : "split-v"}`}
    >
      <div
        className="split-child"
        style={
          horizontal
            ? { width: `${ratio * 100}%` }
            : { height: `${ratio * 100}%` }
        }
      >
        <PaneNode
          wsId={wsId}
          ws={ws}
          pane={pane.first}
          registerContainer={registerContainer}
          rootPaneId={rootPaneId}
        />
      </div>
      <div
        className={`split-divider ${horizontal ? "split-divider-h" : "split-divider-v"}`}
        onMouseDown={(e) => {
          e.preventDefault();
          const root = containerRef.current;
          if (!root) return;
          const rect = root.getBoundingClientRect();
          const onMove = (ev: MouseEvent) => {
            const next = horizontal
              ? (ev.clientX - rect.left) / rect.width
              : (ev.clientY - rect.top) / rect.height;
            const clamped = Math.max(0.1, Math.min(0.9, next));
            setSplitRatio(wsId, pane.id, clamped);
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
        className="split-child"
        style={
          horizontal
            ? { width: `${(1 - ratio) * 100}%` }
            : { height: `${(1 - ratio) * 100}%` }
        }
      >
        <PaneNode
          wsId={wsId}
          ws={ws}
          pane={pane.second}
          registerContainer={registerContainer}
          rootPaneId={rootPaneId}
        />
      </div>
    </div>
  );
}

function TabsPaneView(
  props: PaneNodeProps & { pane: Extract<Pane, { kind: "tabs" }> },
) {
  const { wsId, ws, pane, registerContainer, rightSlotForRoot, rootPaneId } =
    props;
  const setActiveTab = useStore((s) => s.setActiveTab);
  const setActivePane = useStore((s) => s.setActivePane);
  const closeTab = useStore((s) => s.closeTab);
  const moveTab = useStore((s) => s.moveTab);

  const isFocused = ws.layout.activePaneId === pane.id;
  const drag = useDrag();
  const setTabPinned = useStore((s) => s.setTabPinned);
  const pinnedSet = new Set(ws.layout.pinned ?? []);
  const [tabListOpen, setTabListOpen] = useState(false);
  const tabListBtnRef = useRef<HTMLButtonElement>(null);
  const orderedTabs = (() => {
    const pinned = pane.tabs.filter((k) => pinnedSet.has(k));
    const rest = pane.tabs.filter((k) => !pinnedSet.has(k));
    return [...pinned, ...rest];
  })();
  const showOverlay = drag?.overPaneId === pane.id && !!drag?.edge;
  const insertLineIndex =
    drag?.overPaneId === pane.id && drag?.tabInsertIndex != null
      ? drag.tabInsertIndex
      : null;
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [tabMenu, setTabMenu] = useState<{ x: number; y: number; key: string } | null>(null);

  const onContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      registerContainer(pane.id, node);
    },
    [pane.id, registerContainer],
  );

  useEffect(() => {
    const id = pane.id;
    return () => {
      registerContainer(id, null);
    };
  }, [pane.id, registerContainer]);

  // Auto-scroll the active tab into view when it changes.
  useEffect(() => {
    if (!pane.active || !tabBarRef.current) return;
    const el = tabBarRef.current.querySelector(
      `[data-tab-key="${CSS.escape(pane.active)}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pane.active]);

  const tabMenuItems: (ContextMenuItem | "separator")[] = (() => {
    if (!tabMenu) return [];
    const targetKey = tabMenu.key;
    const others = pane.tabs.filter((x) => x !== targetKey);
    const out: (ContextMenuItem | "separator")[] = [];
    out.push({
      label: "Close",
      onClick: () => closeTab(wsId, targetKey),
    });
    out.push({
      label: "Close Others",
      disabled: others.length === 0,
      onClick: () => {
        for (const k of others) {
          if (!pinnedSet.has(k)) closeTab(wsId, k);
        }
      },
    });
    out.push({
      label: "Close All",
      onClick: () => {
        for (const k of [...pane.tabs]) {
          if (!pinnedSet.has(k)) closeTab(wsId, k);
        }
      },
    });
    const targetIdx = pane.tabs.indexOf(targetKey);
    out.push({
      label: "Close to the Right",
      disabled: targetIdx < 0 || targetIdx >= pane.tabs.length - 1,
      onClick: () => {
        const toClose = pane.tabs.slice(targetIdx + 1);
        for (const k of toClose) closeTab(wsId, k);
      },
    });
    out.push({
      label: "Close to the Left",
      disabled: targetIdx <= 0,
      onClick: () => {
        const toClose = pane.tabs.slice(0, targetIdx);
        for (const k of toClose) closeTab(wsId, k);
      },
    });
    out.push({
      label: "Close Saved",
      onClick: () => {
        for (const k of [...pane.tabs]) {
          const p = parseKey(k);
          if (p?.kind === "file") {
            const f = ws.files[p.path];
            if (f && f.contents === f.original) closeTab(wsId, k);
          }
        }
      },
    });
    out.push("separator");
    out.push({
      label: pinnedSet.has(targetKey) ? "Unpin" : "Pin",
      onClick: () => setTabPinned(wsId, targetKey, !pinnedSet.has(targetKey)),
    });
    const parsed = parseKey(targetKey);
    if (parsed?.kind === "file") {
      out.push("separator");
      out.push({
        label: "Copy Path",
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(parsed.path);
          } catch {
            /* ignore */
          }
        },
      });
      out.push({
        label: "Copy Relative Path",
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(
              relPath(parsed.path, ws.meta.root),
            );
          } catch {
            /* ignore */
          }
        },
      });
      out.push({
        label: "Reveal in File Tree",
        // Parameterised to the right-clicked tab rather than the active
        // editor — the user might right-click an unfocused tab and we
        // should reveal *that* file.
        onClick: () => revealInTree(wsId, parsed.path),
      });
      out.push({
        label:
          navigator.userAgent.includes("Mac")
            ? "Reveal in Finder"
            : "Reveal in File Explorer",
        onClick: async () => {
          try {
            await revealItemInDir(parsed.path);
          } catch {
            /* ignore */
          }
        },
      });
    }
    if (parsed?.kind === "ai") {
      const chat = ws.aiChats[parsed.id];
      out.push("separator");
      out.push({
        label: "Rename Chat…",
        disabled: !chat,
        onClick: async () => {
          const next = await dialogPrompt(
            "New chat name",
            chat?.title ?? "",
            { title: "Rename AI chat", okLabel: "Rename" },
          );
          if (!next || !next.trim()) return;
          useStore.getState().setAIChatTitle(wsId, parsed.id, next.trim());
        },
      });
    }
    if (parsed?.kind === "terminal") {
      const term = ws.terminals[parsed.id];
      out.push("separator");
      out.push({
        label: "Rename Terminal…",
        disabled: !term,
        onClick: async () => {
          const next = await dialogPrompt(
            "New terminal name",
            term?.title ?? "",
            { title: "Rename terminal", okLabel: "Rename" },
          );
          if (!next || !next.trim()) return;
          useStore.setState((s) => {
            const w = s.loaded[wsId];
            if (!w || !w.terminals[parsed.id]) return s;
            return {
              loaded: {
                ...s.loaded,
                [wsId]: {
                  ...w,
                  terminals: {
                    ...w.terminals,
                    [parsed.id]: {
                      ...w.terminals[parsed.id],
                      title: next.trim(),
                    },
                  },
                },
              },
            };
          });
        },
      });
      out.push({
        label: "Clear Terminal",
        onClick: () => {
          // Send Ctrl+L to the PTY, which most shells (cmd/pwsh/bash)
          // interpret as "clear screen".
          if (term?.ptyId) {
            void import("../ipc").then(({ pty }) =>
              pty.write(term.ptyId!, "\x0c"),
            );
          }
        },
      });
      out.push("separator");
      if (term?.popped) {
        out.push({
          label: "Re-dock Terminal",
          onClick: () => {
            void redockTerminal(parsed.id);
          },
        });
      } else {
        out.push({
          label: "Pop Out Terminal…",
          disabled: !term,
          onClick: () => {
            if (!term) return;
            void popOutTerminal(wsId, term, ws.meta.root);
          },
        });
      }
    }
    return out;
  })();

  return (
    <div
      className={`tabs-pane ${isFocused ? "focused" : ""}`}
      onMouseDown={() => {
        if (ws.layout.activePaneId !== pane.id) {
          setActivePane(wsId, pane.id);
        }
      }}
    >
      <div
        className="tab-bar"
        data-pane-tab-bar={pane.id}
        ref={tabBarRef}
      >
        {orderedTabs.map((k, idx) => {
          const info = tabLabel(ws, k);
          const isActive = pane.active === k;
          const parsed = parseKey(k);
          const isPinned = pinnedSet.has(k);
          return (
            <Fragment key={k}>
              {insertLineIndex === idx && (
                <div className="tab-insert-line" />
              )}
            <div
              data-tab-index={idx}
              data-tab-key={k}
              className={`tab ${isActive ? "active" : ""} ${isPinned ? "pinned" : ""}`}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTabMenu({ x: e.clientX, y: e.clientY, key: k });
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                const target = e.target as HTMLElement;
                if (target.closest(".tab-close")) return;
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                let dragStarted = false;
                const labelStr = info.label;
                const targetWsId = wsId;
                const targetKey = k;
                const myPaneId = pane.id;

                const onMove = (ev: PointerEvent) => {
                  if (!dragStarted) {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    if (dx * dx + dy * dy < 25) return;
                    dragStarted = true;
                    startDrag({
                      wsId: targetWsId,
                      key: targetKey,
                      label: labelStr,
                      x: ev.clientX,
                      y: ev.clientY,
                    });
                  }
                  const el = document.elementFromPoint(
                    ev.clientX,
                    ev.clientY,
                  ) as HTMLElement | null;
                  // Tab-bar insertion mode: drop between existing tabs.
                  const tabBarEl = el?.closest(
                    "[data-pane-tab-bar]",
                  ) as HTMLElement | null;
                  if (tabBarEl) {
                    const overPaneId =
                      tabBarEl.dataset.paneTabBar ?? null;
                    const tabEls = Array.from(
                      tabBarEl.querySelectorAll("[data-tab-index]"),
                    ) as HTMLElement[];
                    let insertIndex = tabEls.length;
                    for (let i = 0; i < tabEls.length; i++) {
                      const r = tabEls[i].getBoundingClientRect();
                      if (ev.clientX < r.left + r.width / 2) {
                        insertIndex = i;
                        break;
                      }
                    }
                    updateDrag(
                      ev.clientX,
                      ev.clientY,
                      overPaneId,
                      null,
                      insertIndex,
                    );
                    return;
                  }
                  // Otherwise fall back to edge-zone detection on pane content.
                  const paneEl = el?.closest("[data-pane-id]") as
                    | HTMLElement
                    | null;
                  const overPaneId = paneEl?.dataset.paneId ?? null;
                  let edge: DropEdge | null = null;
                  if (paneEl) {
                    edge = computeEdgeForPoint(paneEl, ev.clientX, ev.clientY);
                  }
                  updateDrag(ev.clientX, ev.clientY, overPaneId, edge, null);
                };

                const finish = (
                  applyDrop: boolean,
                  upEv?: PointerEvent,
                ) => {
                  document.removeEventListener("pointermove", onMove);
                  document.removeEventListener("pointerup", onUp);
                  document.removeEventListener("pointercancel", onCancel);
                  if (dragStarted) {
                    const cur = getDrag();
                    if (applyDrop && cur?.overPaneId) {
                      if (cur.tabInsertIndex != null) {
                        moveTab(targetWsId, targetKey, {
                          paneId: cur.overPaneId,
                          insertIndex: cur.tabInsertIndex,
                        });
                      } else if (cur.edge) {
                        moveTab(targetWsId, targetKey, {
                          paneId: cur.overPaneId,
                          edge: cur.edge,
                        });
                      }
                    }
                    endDrag();
                  } else if (!isActive && upEv && upEv.button === 0) {
                    setActiveTab(targetWsId, myPaneId, targetKey);
                  }
                };

                const onUp = (ev: PointerEvent) => finish(true, ev);
                const onCancel = () => finish(false);

                document.addEventListener("pointermove", onMove);
                document.addEventListener("pointerup", onUp);
                document.addEventListener("pointercancel", onCancel);
              }}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(wsId, k);
                }
              }}
              title={
                parsed?.kind === "file"
                  ? parsed.path
                  : parsed?.kind === "composeReview"
                    ? parsed.path
                    : info.label
              }
            >
              <span className="tab-icon">
                {isPinned ? (
                  // Keep the pin glyph as a literal pin emoji — screen
                  // readers + sighted users both understand it; no SVG
                  // analogue in the registry.
                  "📌"
                ) : info.isTerminal ? (
                  <Icon name="terminal" size={12} />
                ) : info.isAI ? (
                  <AIIcon size={12} />
                ) : info.isWhiteboard ? (
                  <Icon name="whiteboard" size={12} />
                ) : info.isUsage ? (
                  <Icon name="chart-bar" size={12} />
                ) : info.isComposeReview ? (
                  <Icon name="git-compare" size={12} />
                ) : info.isHtmlPreview ? (
                  <Icon name="globe" size={12} />
                ) : info.subAvatar ? (
                  <img
                    className="tab-sub-avatar"
                    src={info.subAvatar}
                    alt=""
                    aria-hidden="true"
                  />
                ) : (
                  <Icon name="file-text" size={12} />
                )}
              </span>
              <span className="tab-name">
                {info.label}
                {info.dirty ? " •" : ""}
                {info.popped ? (
                  <span
                    className="tab-popped-mark"
                    title="In a separate window"
                  >
                    <Icon name="external-link" size={10} />
                  </span>
                ) : null}
                {(() => {
                  // Auto-push indicator: tiny ↥ glyph for files with a
                  // remote link AND autoPush enabled, so the user knows
                  // at a glance which buffers will push to remote on
                  // save. Cheap to compute (localStorage lookup keyed
                  // by absolute path); only runs for file tabs.
                  if (parsed?.kind !== "file") return null;
                  const link = lookupRemoteLink(wsId, parsed.path);
                  if (!link?.autoPush) return null;
                  return (
                    <span
                      className="tab-autopush-mark"
                      title={`Auto-push on save → ${link.remotePath}`}
                    >
                      <Icon name="upload-cloud" size={10} />
                    </span>
                  );
                })()}
              </span>
              {!isPinned && (
                <button
                  className="tab-close"
                  title="Close"
                  aria-label={`Close ${info.label}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(wsId, k);
                  }}
                >
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
            </Fragment>
          );
        })}
        {insertLineIndex === pane.tabs.length && (
          <div className="tab-insert-line" />
        )}
        <div className="tab-bar-spacer" />
        {/* Tab list dropdown — shown only when there's enough overflow
            potential (4+ tabs in this pane) to make a flat list useful.
            Below that threshold the tabs all fit on screen, and an
            extra button just adds noise. */}
        {pane.tabs.length >= 4 && (
          <button
            ref={tabListBtnRef}
            className="tab-list-btn"
            onClick={(e) => {
              e.stopPropagation();
              setTabListOpen((v) => !v);
            }}
            title={`Show all ${pane.tabs.length} tabs`}
            aria-label="Show all tabs"
            aria-haspopup="menu"
            aria-expanded={tabListOpen}
          >
            <Icon name="chevron-down" size={12} />
            <span className="tab-list-count">{pane.tabs.length}</span>
          </button>
        )}
        {rootPaneId === pane.id ? rightSlotForRoot : null}
      </div>
      {tabListOpen && (
        <TabListDropdown
          anchor={tabListBtnRef.current}
          tabs={orderedTabs}
          ws={ws}
          activeKey={pane.active}
          pinnedSet={pinnedSet}
          onPick={(k) => {
            setActiveTab(wsId, pane.id, k);
            setActivePane(wsId, pane.id);
            setTabListOpen(false);
          }}
          onClose={(k) => {
            void closeTab(wsId, k);
          }}
          onDismiss={() => setTabListOpen(false)}
        />
      )}
      <div
        ref={onContentRef}
        className="pane-content"
        data-pane-id={pane.id}
      >
        {pane.tabs.length === 0 && <EmptyPane wsId={wsId} />}
        {showOverlay && drag?.edge && <DropOverlay edge={drag.edge} />}
      </div>
      {tabMenu && (
        <ContextMenu
          x={tabMenu.x}
          y={tabMenu.y}
          items={tabMenuItems}
          onClose={() => setTabMenu(null)}
        />
      )}
    </div>
  );
}

interface TabListDropdownProps {
  anchor: HTMLElement | null;
  tabs: string[];
  ws: WorkspaceData;
  activeKey: string | null;
  pinnedSet: Set<string>;
  onPick: (key: string) => void;
  onClose: (key: string) => void;
  onDismiss: () => void;
}

function TabListDropdown({
  anchor,
  tabs,
  ws,
  activeKey,
  pinnedSet,
  onPick,
  onClose,
  onDismiss,
}: TabListDropdownProps) {
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Open beneath the anchor button. Layout fallback ("0,0") if anchor
  // got unmounted between click and render.
  const rect = anchor?.getBoundingClientRect();
  const top = rect ? rect.bottom + 4 : 0;
  const right = rect ? Math.max(8, window.innerWidth - rect.right) : 8;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Dismiss on outside click + Escape; let the parent toggle handle
  // re-clicks on the anchor button itself.
  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const card = (e.target as HTMLElement)?.closest(
        ".tab-list-dropdown",
      );
      if (card) return;
      if (anchor && anchor.contains(t)) return;
      onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("mousedown", onClickAway);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClickAway);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor, onDismiss]);

  const fq = filter.toLowerCase();
  const visible = tabs.filter((k) => {
    if (!fq) return true;
    const info = tabLabel(ws, k);
    return info.label.toLowerCase().includes(fq);
  });

  return (
    <div
      className="tab-list-dropdown"
      style={{ top, right }}
      role="menu"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        className="tab-list-filter"
        type="text"
        value={filter}
        placeholder="Filter tabs…"
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && visible.length > 0) {
            onPick(visible[0]);
          }
        }}
      />
      <div className="tab-list-rows">
        {visible.length === 0 && (
          <div className="tab-list-empty">No matching tabs</div>
        )}
        {visible.map((k) => {
          const info = tabLabel(ws, k);
          const isActive = k === activeKey;
          const isPinned = pinnedSet.has(k);
          return (
            <div
              key={k}
              className={`tab-list-row ${isActive ? "active" : ""}`}
              onClick={() => onPick(k)}
              role="menuitem"
              tabIndex={0}
            >
              {isPinned && (
                <Icon
                  name="star-filled"
                  size={10}
                  className="tab-list-pin"
                />
              )}
              <span className="tab-list-label">
                {info.dirty && <span className="tab-list-dirty">●</span>}
                {info.label}
              </span>
              <button
                className="tab-list-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(k);
                }}
                title="Close tab"
                aria-label={`Close ${info.label}`}
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tiny inline "X ago" formatter used by the recently-closed list. Avoids
// pulling in date-fns just to render four resolution buckets — anything
// older than yesterday is just "older" since the closed-tab stack caps
// at 20 entries and turns over fast in practice.
function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return "older";
}

function EmptyPane({ wsId }: { wsId: string }) {
  // Subscribe to the closed-tabs stack so the list rerenders when a tab
  // is closed (or reopened) elsewhere while this empty pane is visible.
  const [closedTick, setClosedTick] = useState(0);
  useEffect(() => {
    return subscribeClosedTabs((changedWsId) => {
      if (changedWsId === wsId) setClosedTick((n) => n + 1);
    });
  }, [wsId]);
  // closedTick is intentionally unused beyond forcing a rerender.
  void closedTick;
  const recentClosed = peekClosedTabs(wsId).slice(0, 5);

  return (
    <div className="pane-empty">
      <div className="pane-empty-card">
        <div className="pane-empty-icon">
          <img
            src="/quack-mark.png"
            alt="Quack"
            className="pane-empty-logo"
            draggable={false}
          />
        </div>
        <div className="pane-empty-title">Nothing open here</div>
        <div className="pane-empty-sub">
          Start a conversation with AI, or jump back into your work.
        </div>
        <div className="pane-empty-primary">
          <button
            className="pane-empty-ai"
            onClick={(e) =>
              addNewAIChat(wsId, "editor", anchorFromElement(e.currentTarget))
            }
            title="Open a new AI chat tab"
          >
            <AIIcon size={15} />
            <span>New AI chat</span>
          </button>
          <button
            className="pane-empty-agent"
            onClick={() => setAgentMode(true)}
            title="Switch to Agent Mode (Ctrl+Shift+A)"
          >
            <Icon name="code" size={14} />
            <span>Agent Mode</span>
          </button>
        </div>
        <div
          className="pane-empty-actions"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
          }}
        >
          <button onClick={() => openPalette("")} title="Ctrl+P">
            <Icon name="file" size={14} />
            <span>Quick open file</span>
          </button>
          <button
            onClick={() => openPalette("? ")}
            title="Ctrl+Shift+F"
          >
            <Icon name="search" size={14} />
            <span>Search content</span>
          </button>
          <button
            onClick={() => runCommand("file.open_folder")}
            title="Ctrl+O"
          >
            <Icon name="folder-open" size={14} />
            <span>Open Folder</span>
          </button>
          <button
            onClick={() => runCommand("workspace.open_recent")}
            title="Open a recent workspace"
          >
            <Icon name="folder" size={14} />
            <span>Open Recent Workspace</span>
          </button>
          <button
            onClick={() => runCommand("edit.reopen_closed_tab")}
            title="Ctrl+Shift+T"
          >
            <Icon name="rotate-ccw" size={14} />
            <span>Reopen Closed Tab</span>
          </button>
          <button
            onClick={() => openPalette("> ")}
            title="Ctrl+Shift+P"
          >
            <Icon name="command" size={14} />
            <span>Command Palette</span>
          </button>
        </div>
        {recentClosed.length > 0 && (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              style={{
                fontSize: 11,
                opacity: 0.6,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                marginBottom: 4,
              }}
            >
              Recently closed
            </div>
            {recentClosed.map((entry) => (
              <button
                key={`${entry.path}:${entry.closedAt}`}
                onClick={() =>
                  void useStore.getState().openFile(wsId, entry.path)
                }
                title={entry.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "4px 8px",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 4,
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--hover-bg, rgba(127,127,127,0.12))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  <Icon name="file-text" size={12} />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {basename(entry.path)}
                  </span>
                </span>
                <span style={{ fontSize: 11, opacity: 0.55, flexShrink: 0 }}>
                  {formatAgo(entry.closedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="pane-empty-foot">
          Tip: drag any tab onto an edge to split this pane.
        </div>
      </div>
    </div>
  );
}

function DropOverlay({ edge }: { edge: DropEdge }) {
  const style: React.CSSProperties = (() => {
    switch (edge) {
      case "center":
        return { inset: 0 };
      case "left":
        return { top: 0, bottom: 0, left: 0, width: "50%" };
      case "right":
        return { top: 0, bottom: 0, right: 0, width: "50%" };
      case "top":
        return { left: 0, right: 0, top: 0, height: "50%" };
      case "bottom":
        return { left: 0, right: 0, bottom: 0, height: "50%" };
    }
  })();
  return <div className="drop-overlay" style={style} />;
}
