import { useCallback, useRef, useState } from 'react';
import { DRAG_THRESHOLD_PX } from './officeConstants';
import type { OfficeZone, Viewport } from './officeTypes';

interface DragState {
  kind: 'card' | 'zone';
  id: string;
  startPointerX: number;
  startPointerY: number;
  startX: number;
  startY: number;
  active: boolean;
  hoverZoneId?: string;
}

interface Handlers {
  onCardMove: (projectPath: string, x: number, y: number) => void;
  onZoneMove: (zoneId: string, x: number, y: number) => void;
  onCardDrop: (projectPath: string, x: number, y: number, zoneId: string | undefined) => void;
}

export function useOfficeDrag(viewport: Viewport, zones: OfficeZone[], handlers: Handlers) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const hitTestZone = useCallback((x: number, y: number): string | undefined => {
    for (const z of zones) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z.id;
    }
    return undefined;
  }, [zones]);

  const screenToCanvas = useCallback((sx: number, sy: number) => ({
    x: (sx - viewport.panX) / viewport.zoom,
    y: (sy - viewport.panY) / viewport.zoom,
  }), [viewport]);

  const startCardDrag = useCallback((projectPath: string, startX: number, startY: number, e: React.PointerEvent) => {
    setDrag({
      kind: 'card', id: projectPath,
      startPointerX: e.clientX, startPointerY: e.clientY,
      startX, startY, active: false,
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const startZoneDrag = useCallback((zoneId: string, startX: number, startY: number, e: React.PointerEvent) => {
    setDrag({
      kind: 'zone', id: zoneId,
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

    const nx = d.startX + dx;
    const ny = d.startY + dy;

    if (d.kind === 'card') {
      handlers.onCardMove(d.id, nx, ny);
      const { x: cx, y: cy } = screenToCanvas(e.clientX, e.clientY);
      const hoverZoneId = hitTestZone(cx, cy);
      if (hoverZoneId !== d.hoverZoneId) setDrag({ ...d, active: true, hoverZoneId });
    } else {
      handlers.onZoneMove(d.id, nx, ny);
    }
  }, [viewport.zoom, screenToCanvas, hitTestZone, handlers]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'card' && d.active) {
      const dx = (e.clientX - d.startPointerX) / viewport.zoom;
      const dy = (e.clientY - d.startPointerY) / viewport.zoom;
      handlers.onCardDrop(d.id, d.startX + dx, d.startY + dy, d.hoverZoneId);
    }
    setDrag(null);
  }, [viewport.zoom, handlers]);

  return {
    drag,
    startCardDrag,
    startZoneDrag,
    onPointerMove,
    onPointerUp,
  };
}
