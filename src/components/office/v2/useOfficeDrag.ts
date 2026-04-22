import { useCallback, useRef, useState } from 'react';
import { DRAG_THRESHOLD_PX } from './officeConstants';
import type { Viewport } from './officeTypes';

interface DragState {
  id: string;
  startPointerX: number;
  startPointerY: number;
  startX: number;
  startY: number;
  active: boolean;
}

interface Handlers {
  onCardMove: (projectPath: string, x: number, y: number) => void;
  onCardDrop: (projectPath: string, x: number, y: number) => void;
}

export function useOfficeDrag(viewport: Viewport, handlers: Handlers) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const startCardDrag = useCallback((projectPath: string, startX: number, startY: number, e: React.PointerEvent) => {
    setDrag({
      id: projectPath,
      startPointerX: e.clientX, startPointerY: e.clientY,
      startX, startY, active: false,
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startPointerX) / viewport.zoom;
    const dy = (e.clientY - d.startPointerY) / viewport.zoom;

    if (!d.active) {
      const pxDelta = Math.hypot(e.clientX - d.startPointerX, e.clientY - d.startPointerY);
      if (pxDelta < DRAG_THRESHOLD_PX) return;
      setDrag({ ...d, active: true });
    }

    handlers.onCardMove(d.id, d.startX + dx, d.startY + dy);
  }, [viewport.zoom, handlers]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.active) {
      const dx = (e.clientX - d.startPointerX) / viewport.zoom;
      const dy = (e.clientY - d.startPointerY) / viewport.zoom;
      handlers.onCardDrop(d.id, d.startX + dx, d.startY + dy);
    }
    setDrag(null);
  }, [viewport.zoom, handlers]);

  return {
    drag,
    startCardDrag,
    onPointerMove,
    onPointerUp,
  };
}
