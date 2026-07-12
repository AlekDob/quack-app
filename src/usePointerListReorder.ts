// Pointer-based drag-to-reorder for vertical icon lists.
// HTML5 DnD is broken in Tauri/WKWebView — see features/012.
import { useCallback, useRef, useState } from "react";

export interface PointerDragState {
  from: number;
  over: number;
}

const THRESHOLD = 4;

function indexAtPoint(
  x: number,
  y: number,
  dataAttr: string,
): number | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const host = el?.closest<HTMLElement>(`[${dataAttr}]`);
  if (!host) return null;
  const raw = host.getAttribute(dataAttr);
  if (raw === null) return null;
  const i = Number(raw);
  return Number.isNaN(i) ? null : i;
}

interface Options {
  dataAttr: string;
  bodyClass: string;
  onReorder: (from: number, to: number) => void;
}

export function usePointerListReorder({
  dataAttr,
  bodyClass,
  onReorder,
}: Options) {
  const [drag, setDrag] = useState<PointerDragState | null>(null);
  const press = useRef<{ from: number; startY: number; active: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);

  const onMove = useCallback(
    (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!p.active && Math.abs(e.clientY - p.startY) < THRESHOLD) return;
      if (!p.active) document.body.classList.add(bodyClass);
      p.active = true;
      const over = indexAtPoint(e.clientX, e.clientY, dataAttr);
      setDrag({ from: p.from, over: over ?? p.from });
    },
    [bodyClass, dataAttr],
  );

  const onUp = useCallback(
    (e: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove(bodyClass);
      const p = press.current;
      press.current = null;
      if (p?.active) {
        suppressClick.current = true;
        const over = indexAtPoint(e.clientX, e.clientY, dataAttr);
        if (over !== null && over !== p.from) onReorder(p.from, over);
      }
      setDrag(null);
    },
    [bodyClass, dataAttr, onMove, onReorder],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      if (e.button !== 0) return;
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
