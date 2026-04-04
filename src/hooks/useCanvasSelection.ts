/**
 * Canvas multi-selection hook — lasso + Shift+click
 * Manages selectedIds set and lasso rectangle state.
 */

import { useState, useCallback, useRef } from 'react';
import type { CanvasAnnotations, LassoRect } from '../components/featureMap/annotationTypes';
import { POST_IT_W, POST_IT_H } from '../components/featureMap/annotationTypes';

/** Get center point of any annotation by type */
function getAnnotationCenter(
  id: string,
  annotations: CanvasAnnotations,
): { x: number; y: number } | null {
  const postIt = annotations.postIts.find(p => p.id === id);
  if (postIt) return { x: postIt.x + POST_IT_W / 2, y: postIt.y + POST_IT_H / 2 };
  const group = annotations.groups.find(g => g.id === id);
  if (group) return { x: group.x + group.w / 2, y: group.y + group.h / 2 };
  const img = annotations.images.find(i => i.id === id);
  if (img) return { x: img.x + img.w / 2, y: img.y + img.h / 2 };
  return null;
}

/** Check if a point is inside a rectangle */
function isInsideRect(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/** Collect all annotation IDs whose center falls inside the lasso */
function hitTestLasso(
  lasso: LassoRect,
  annotations: CanvasAnnotations,
): Set<string> {
  const hits = new Set<string>();
  const allIds = [
    ...annotations.postIts.map(p => p.id),
    ...annotations.groups.map(g => g.id),
    ...annotations.images.map(i => i.id),
  ];
  for (const id of allIds) {
    const center = getAnnotationCenter(id, annotations);
    if (center && isInsideRect(center.x, center.y, lasso.x, lasso.y, lasso.w, lasso.h)) {
      hits.add(id);
    }
  }
  return hits;
}

export interface CanvasSelectionState {
  selectedIds: Set<string>;
  lassoRect: LassoRect | null;
  isLassoing: boolean;
}

export interface CanvasSelectionActions {
  /** Start lasso from SVG coordinates */
  startLasso: (svgX: number, svgY: number) => void;
  /** Update lasso end point (SVG coordinates) */
  updateLasso: (svgX: number, svgY: number) => void;
  /** Reset lasso rect without selecting */
  resetLasso: () => void;
  /** Set selected IDs directly (from external hit-test) */
  setSelection: (ids: Set<string>) => void;
  /** Toggle an annotation in/out of selection (Shift+click) */
  toggleSelect: (id: string) => void;
  /** Clear entire selection */
  clearSelection: () => void;
  /** Check if an annotation is selected */
  isSelected: (id: string) => boolean;
  /** Number of selected items */
  selectionCount: number;
}

export function useCanvasSelection(): CanvasSelectionState & CanvasSelectionActions {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lassoRect, setLassoRect] = useState<LassoRect | null>(null);
  const lassoOrigin = useRef<{ x: number; y: number } | null>(null);

  const startLasso = useCallback((svgX: number, svgY: number) => {
    lassoOrigin.current = { x: svgX, y: svgY };
    setLassoRect({ x: svgX, y: svgY, w: 0, h: 0 });
  }, []);

  const updateLasso = useCallback((svgX: number, svgY: number) => {
    const origin = lassoOrigin.current;
    if (!origin) return;
    const x = Math.min(origin.x, svgX);
    const y = Math.min(origin.y, svgY);
    const w = Math.abs(svgX - origin.x);
    const h = Math.abs(svgY - origin.y);
    setLassoRect({ x, y, w, h });
  }, []);

  const resetLasso = useCallback(() => {
    setLassoRect(null);
    lassoOrigin.current = null;
  }, []);

  const setSelection = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    lassoRect,
    isLassoing: lassoOrigin.current !== null,
    startLasso,
    updateLasso,
    resetLasso,
    setSelection,
    toggleSelect,
    clearSelection,
    isSelected,
    selectionCount: selectedIds.size,
  };
}
