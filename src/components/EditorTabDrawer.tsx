import { useCallback } from "react";
import { endDrag, getDrag, startDrag, updateDrag } from "../dragState";
import { isEditorDrawerDropZone } from "../editorDrawer";
import { parseKey, useStore, type WorkspaceData } from "../store";
import { basename } from "../pathUtils";
import { Icon } from "./Icon";
import { AIIcon } from "./AIIcon";

interface Props {
  wsId: string;
  ws: WorkspaceData;
  tabKey: string;
  width: number;
  registerContainer: (node: HTMLElement | null) => void;
  onResize: (width: number) => void;
  onDock: () => void;
}

function drawerTabLabel(ws: WorkspaceData, key: string): string {
  const parsed = parseKey(key);
  if (!parsed) return key;
  if (parsed.kind === "file") return basename(parsed.path);
  if (parsed.kind === "ai") return ws.aiChats[parsed.id]?.title ?? "AI Chat";
  if (parsed.kind === "terminal") return ws.terminals[parsed.id]?.title ?? "Terminal";
  if (parsed.kind === "whiteboard") return "Organigramma";
  if (parsed.kind === "works") return "Works";
  if (parsed.kind === "usage") return "Usage";
  if (parsed.kind === "brain") return "Quack Brain";
  if (parsed.kind === "store") return "Quack Store";
  if (parsed.kind === "plan") return "Plan";
  return key;
}

export function EditorTabDrawer({
  wsId,
  ws,
  tabKey,
  width,
  registerContainer,
  onResize,
  onDock,
}: Props) {
  const moveTab = useStore((s) => s.moveTab);
  const closeTab = useStore((s) => s.closeTab);
  const onContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      registerContainer(node);
    },
    [registerContainer],
  );

  const label = drawerTabLabel(ws, tabKey);
  const parsed = parseKey(tabKey);
  const isAi = parsed?.kind === "ai";

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

  return (
    <aside
      className="editor-tab-drawer"
      style={{ width }}
      aria-label="Editor drawer"
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
        {isAi ? <AIIcon size={14} /> : <Icon name="file-text" size={14} />}
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
    </aside>
  );
}
