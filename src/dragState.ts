import { useEffect, useState } from "react";
import type { DropEdge } from "./store";

export interface ActiveDrag {
  wsId: string;
  key: string;
  label: string;
  x: number;
  y: number;
  overPaneId: string | null;
  edge: DropEdge | null;
  tabInsertIndex: number | null;
  /** Far-right editor strip — opens tab in the resizable drawer. */
  drawerDrop: boolean;
}

let _drag: ActiveDrag | null = null;
const listeners = new Set<(d: ActiveDrag | null) => void>();

function notify() {
  for (const l of listeners) l(_drag);
}

export function startDrag(d: {
  wsId: string;
  key: string;
  label: string;
  x: number;
  y: number;
}) {
  _drag = {
    ...d,
    overPaneId: null,
    edge: null,
    tabInsertIndex: null,
    drawerDrop: false,
  };
  notify();
}

export function updateDrag(
  x: number,
  y: number,
  overPaneId: string | null,
  edge: DropEdge | null,
  tabInsertIndex: number | null = null,
  drawerDrop = false,
) {
  if (!_drag) return;
  _drag = { ..._drag, x, y, overPaneId, edge, tabInsertIndex, drawerDrop };
  notify();
}

export function endDrag() {
  _drag = null;
  notify();
}

export function getDrag(): ActiveDrag | null {
  return _drag;
}

export function useDrag(): ActiveDrag | null {
  const [d, setD] = useState<ActiveDrag | null>(_drag);
  useEffect(() => {
    listeners.add(setD);
    return () => {
      listeners.delete(setD);
    };
  }, []);
  return d;
}
