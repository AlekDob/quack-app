// Pointer-based drag-to-reorder for the workspace icons.
//
// We deliberately do NOT use the HTML5 drag-and-drop API: in Tauri's WKWebView
// (macOS) a native element drag aborts instantly — `dragstart` fires, then
// `dragend` with no `dragover`/`drop` in between — so the reorder never runs.
// Pointer events work reliably. See features/002-workspace-colors.md.
import { useCallback, useRef, useState } from "react";
import { useStore } from "./store";

export interface IconDragState {
  /** Index of the icon being dragged. */
  from: number;
  /** Index of the slot the pointer is currently over. */
  over: number;
}

// Pixels of movement before a press becomes a drag (below this, it's a click).
const THRESHOLD = 4;

// Resolve the workspace index under a screen point via the `data-ws-index`
// the ActivityBar stamps on each icon. null when the pointer is off the list.
function indexAtPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const host = el?.closest<HTMLElement>("[data-ws-index]");
  if (!host) return null;
  const i = Number(host.dataset.wsIndex);
  return Number.isNaN(i) ? null : i;
}

export function useWorkspaceReorder() {
  const reorder = useStore((s) => s.reorderWorkspaces);
  const [drag, setDrag] = useState<IconDragState | null>(null);
  // Source press tracked in a ref (synchronous, no re-render) until it
  // crosses THRESHOLD and becomes an active drag.
  const press = useRef<{ from: number; startY: number; active: boolean } | null>(
    null,
  );
  // Set when a real drag just ended, so the trailing click doesn't also fire
  // setActiveWorkspace. Consumed by shouldSuppressClick().
  const suppressClick = useRef(false);

  const onMove = useCallback((e: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (!p.active && Math.abs(e.clientY - p.startY) < THRESHOLD) return;
    if (!p.active) document.body.classList.add("ws-dragging"); // first activation
    p.active = true;
    const over = indexAtPoint(e.clientX, e.clientY);
    setDrag({ from: p.from, over: over ?? p.from });
  }, []);

  const onUp = useCallback(
    (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("ws-dragging");
      const p = press.current;
      press.current = null;
      if (p?.active) {
        suppressClick.current = true;
        const over = indexAtPoint(e.clientX, e.clientY);
        if (over !== null && over !== p.from) reorder(p.from, over);
      }
      setDrag(null);
    },
    [onMove, reorder],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      if (e.button !== 0) return; // left button only
      press.current = { from: index, startY: e.clientY, active: false };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [onMove, onUp],
  );

  const shouldSuppressClick = useCallback(() => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  }, []);

  return { drag, onPointerDown, shouldSuppressClick };
}
