import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { endDrag, getDrag, startDrag, updateDrag } from "../dragState";
import {
  EDITOR_DRAWER_ANIM_MS,
  isEditorDrawerDropZone,
} from "../editorDrawer";
import { registerEditorDrawerStack } from "../editorDrawerStack";
import { parseKey, useStore, type WorkspaceData } from "../store";
import { basename } from "../pathUtils";
import { duckAvatarFor } from "../subagents";
import { Icon } from "./Icon";
import { AIIcon } from "./AIIcon";

interface Props {
  wsId: string;
  ws: WorkspaceData;
  tabKey: string;
  width: number;
  /** When false, plays close animation then calls onExited. */
  open: boolean;
  registerContainer: (node: HTMLElement | null) => void;
  onResize: (width: number) => void;
  onDock: () => void;
  onExited: () => void;
}

function drawerTabLabel(ws: WorkspaceData, key: string): string {
  const parsed = parseKey(key);
  if (!parsed) return key;
  if (parsed.kind === "file") return basename(parsed.path);
  if (parsed.kind === "ai") return ws.aiChats[parsed.id]?.title ?? "AI Chat";
  if (parsed.kind === "terminal") return ws.terminals[parsed.id]?.title ?? "Terminal";
  if (parsed.kind === "whiteboard") return "Team";
  if (parsed.kind === "works") return "Works";
  if (parsed.kind === "usage") return "Usage";
  if (parsed.kind === "brain") return "Quack Brain";
  if (parsed.kind === "store") return "Quack Store";
  if (parsed.kind === "plan") return "Plan";
  if (parsed.kind === "subagent") return parsed.agentType || "Subagent";
  return key;
}

export function EditorTabDrawer({
  wsId,
  ws,
  tabKey,
  width,
  open,
  registerContainer,
  onResize,
  onDock,
  onExited,
}: Props) {
  const moveTab = useStore((s) => s.moveTab);
  const closeTab = useStore((s) => s.closeTab);
  const [shown, setShown] = useState(false);
  const onStackRef = useCallback(
    (node: HTMLDivElement | null) => {
      registerEditorDrawerStack(wsId, shown ? node : null);
    },
    [shown, wsId],
  );

  const onContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      registerContainer(node);
    },
    [registerContainer],
  );

  useEffect(() => {
    if (open) {
      const id = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(onExited, EDITOR_DRAWER_ANIM_MS);
    return () => window.clearTimeout(t);
  }, [open, onExited]);

  const label = drawerTabLabel(ws, tabKey);
  const parsed = parseKey(tabKey);
  const isAi = parsed?.kind === "ai";
  const subAvatar =
    parsed?.kind === "subagent"
      ? duckAvatarFor(parsed.agentType)
      : null;

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".editor-tab-drawer-close")) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragStarted = false;
    const onMove = (ev: PointerEvent) => {
      if (!dragStarted) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy < 25) return;
        dragStarted = true;
        startDrag({
          wsId,
          key: tabKey,
          label,
          x: ev.clientX,
          y: ev.clientY,
        });
      }
      if (isEditorDrawerDropZone(ev.clientX, wsId)) {
        updateDrag(ev.clientX, ev.clientY, null, null, null, true);
        return;
      }
      const paneEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(
        "[data-pane-id]",
      ) as HTMLElement | null;
      const overPaneId = paneEl?.dataset.paneId ?? null;
      updateDrag(ev.clientX, ev.clientY, overPaneId, null, null, false);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      if (!dragStarted) return;
      const cur = getDrag();
      if (cur?.drawerDrop) {
        endDrag();
        return;
      }
      if (cur?.overPaneId) {
        moveTab(wsId, tabKey, { paneId: cur.overPaneId, edge: "center" });
      }
      endDrag();
    };
    const onCancel = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      if (dragStarted) endDrag();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
  };

  const onResizeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      onResize(startW - (ev.clientX - startX));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return createPortal(
    <>
      <button
        type="button"
        className={`editor-tab-drawer-scrim${shown ? " shown" : ""}`}
        aria-label="Close drawer"
        tabIndex={shown ? 0 : -1}
        onClick={() => void closeTab(wsId, tabKey)}
      />
      <aside
        className={`editor-tab-drawer editor-tab-drawer--overlay${shown ? " shown" : ""}`}
        style={{ width }}
        aria-label="Editor drawer"
        aria-hidden={!shown}
      >
        <div
          className="editor-tab-drawer-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize drawer"
          onMouseDown={onResizeDown}
        />
        <div
          className="editor-tab-drawer-head"
          onPointerDown={onHeaderPointerDown}
          title="Drag to dock back into the editor"
        >
          {isAi ? (
            <AIIcon size={14} />
          ) : subAvatar ? (
            <img
              className="editor-tab-drawer-sub-avatar"
              src={subAvatar}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <Icon name="file-text" size={14} />
          )}
          <span className="editor-tab-drawer-title">{label}</span>
          <button
            type="button"
            className="editor-tab-drawer-dock"
            onClick={onDock}
            title="Dock into editor"
            aria-label="Dock into editor"
          >
            <Icon name="chevron-left" size={12} />
          </button>
          <button
            type="button"
            className="editor-tab-drawer-close"
            onClick={() => void closeTab(wsId, tabKey)}
            title="Close"
            aria-label="Close tab"
          >
            ×
          </button>
        </div>
        <div ref={onContentRef} className="editor-tab-drawer-body pane-content" />
        <div
          ref={onStackRef}
          className="editor-drawer-nested-stack"
          data-editor-drawer-stack={wsId}
          aria-hidden="true"
        />
      </aside>
    </>,
    document.body,
  );
}
