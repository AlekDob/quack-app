// Pointer-based drag from the file tree into the chat composer or editor
// panes. Tauri 2 swallows in-app HTML5 drags, so we mirror the tab-drag
// flow: mousedown on a tree row → document mousemove/mouseup → hit-test.

import {
  endDrag,
  getDrag,
  startDrag,
  updateDrag,
} from "./dragState";
import { resolveTabDropTarget } from "./tabDropTarget";
import { fileKey, useStore } from "./store";

export const COMPOSER_FILE_DROP_ATTR = "data-composer-file-drop";
export const FILE_TREE_DRAG_THRESHOLD_PX = 4;

interface ComposerFileDropZone {
  onFile: (absPath: string) => void;
}

let dropZone: ComposerFileDropZone | null = null;
const hoverListeners = new Set<(over: boolean) => void>();

export function registerComposerFileDrop(zone: ComposerFileDropZone): () => void {
  dropZone = zone;
  return () => {
    if (dropZone === zone) dropZone = null;
  };
}

export function subscribeComposerFileDropHover(
  cb: (over: boolean) => void,
): () => void {
  hoverListeners.add(cb);
  return () => {
    hoverListeners.delete(cb);
  };
}

function notifyHover(over: boolean): void {
  for (const cb of hoverListeners) cb(over);
}

function isOverComposerDrop(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return false;
  return !!el.closest(`[${COMPOSER_FILE_DROP_ATTR}]`);
}

function applyEditorDrop(wsId: string, absPath: string): void {
  const cur = getDrag();
  if (!cur) return;
  const st = useStore.getState();
  if (cur.drawerDrop) {
    void st.openFile(wsId, absPath).then(() => {
      st.moveTabToDrawer(wsId, fileKey(absPath));
    });
    return;
  }
  if (!cur.overPaneId) return;
  if (cur.tabInsertIndex != null) {
    void st.openFileAt(wsId, absPath, {
      paneId: cur.overPaneId,
      insertIndex: cur.tabInsertIndex,
    });
    return;
  }
  if (cur.edge) {
    void st.openFileAt(wsId, absPath, {
      paneId: cur.overPaneId,
      edge: cur.edge,
    });
  }
}

/** Begin a file-tree drag. Returns cleanup for mouseup. */
export function startFileTreeDrag(
  wsId: string,
  absPath: string,
  label: string,
  startX: number,
  startY: number,
  sourceEl: HTMLElement,
): (endX: number, endY: number) => void {
  let active = true;
  let dragStarted = false;
  sourceEl.classList.add("tree-row--dragging");

  const onMove = (e: MouseEvent) => {
    if (!active) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragStarted) {
      if (Math.hypot(dx, dy) < FILE_TREE_DRAG_THRESHOLD_PX) return;
      dragStarted = true;
      startDrag({
        wsId,
        key: fileKey(absPath),
        label,
        x: e.clientX,
        y: e.clientY,
      });
    }
    const overComposer = isOverComposerDrop(e.clientX, e.clientY);
    notifyHover(overComposer);
    if (!overComposer) {
      const t = resolveTabDropTarget(e.clientX, e.clientY, wsId);
      updateDrag(
        e.clientX,
        e.clientY,
        t.overPaneId,
        t.edge,
        t.tabInsertIndex,
        t.drawerDrop,
      );
    } else {
      updateDrag(e.clientX, e.clientY, null, null, null, false);
    }
  };

  window.addEventListener("mousemove", onMove);

  return (endX: number, endY: number) => {
    if (!active) return;
    active = false;
    window.removeEventListener("mousemove", onMove);
    notifyHover(false);
    sourceEl.classList.remove("tree-row--dragging");
    if (isOverComposerDrop(endX, endY) && dropZone) {
      dropZone.onFile(absPath);
    } else if (dragStarted) {
      applyEditorDrop(wsId, absPath);
    }
    if (dragStarted) endDrag();
  };
}
