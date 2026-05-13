/**
 * Feature Map — Knowledge Graph BrainNode (compact preview card).
 *
 * HTML overlay following the same pattern as `CanvasMdCard` (NO SVG foreignObject
 * to avoid the WebKit clipping bug under transformed `<g>`).
 *
 * Compact view: draggable header + mini SVG preview (deterministic static layout)
 * + doc count footer. Double-click opens the full `BrainNodeExplorer`.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { BrainNode } from './annotationTypes';
import { BRAIN_NODE_MIN_W, BRAIN_NODE_MIN_H } from './annotationTypes';
import { loadBrainGraph, type BrainGraphData } from '../../services/brainGraphService';

const DRAG_T = 4;
const MAX_PREVIEW_NODES = 12;

interface Props {
  node: BrainNode;
  zoom: number;
  projectPath: string;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onUpdate: (id: string, partial: Partial<BrainNode>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
  onEnter: (id: string, label: string) => void;
  onMultiToggle?: (id: string) => void;
  onGroupDragStart?: (clientX: number, clientY: number) => void;
  onBeginDrag?: () => void;
  onEndDrag?: () => void;
  onAnnotationDragStart?: (id: string) => void;
  onAnnotationDragEnd?: (id: string) => void;
}

type DragRef = { sx: number; sy: number; ox: number; oy: number; did: boolean } | null;
type ResizeRef = { sx: number; sy: number; ow: number; oh: number } | null;

/** Deterministic small layout for the mini-preview — no force sim, no flicker. */
function staticPreviewPoints(count: number, w: number, h: number) {
  const pts: Array<{ x: number; y: number }> = [];
  if (count === 0) return pts;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.32;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export default function CanvasBrainNode({
  node, zoom, projectPath, isSelected, isMultiSelected,
  onUpdate, onRemove, onSelect, onEnter, onMultiToggle, onGroupDragStart,
  onBeginDrag, onEndDrag,
  onAnnotationDragStart, onAnnotationDragEnd,
}: Props) {
  const dragRef = useRef<DragRef>(null);
  const [graph, setGraph] = useState<BrainGraphData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectPath) return;
    let alive = true;
    setLoading(true);
    loadBrainGraph(projectPath)
      .then(data => { if (alive) setGraph(data); })
      .catch(() => { /* silent — empty state will show */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectPath]);

  const previewW = Math.max(0, node.w - 24);
  const previewH = Math.max(0, node.h - 64);

  const preview = useMemo(() => {
    const total = graph?.nodes.length ?? 0;
    const count = Math.min(total, MAX_PREVIEW_NODES);
    const points = staticPreviewPoints(count, previewW, previewH);
    // build edges between points that share an index in graph.links (approximate visual)
    const edges: Array<{ a: number; b: number }> = [];
    if (graph && count > 1) {
      const slice = graph.nodes.slice(0, count);
      const idIdx = new Map<string, number>();
      slice.forEach((n, i) => idIdx.set(n.id, i));
      for (const l of graph.links) {
        const ai = idIdx.get(typeof l.source === 'string' ? l.source : (l.source as { id: string }).id);
        const bi = idIdx.get(typeof l.target === 'string' ? l.target : (l.target as { id: string }).id);
        if (ai === undefined || bi === undefined) continue;
        edges.push({ a: ai, b: bi });
        if (edges.length > 24) break;
      }
    }
    return { points, edges };
  }, [graph, previewW, previewH]);

  // --- Drag (whole card) — body and header both trigger drag.
  // Buttons + resize stop propagation, so only "neutral" surface drags.
  const handleCardMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (e.shiftKey && onMultiToggle) { onMultiToggle(node.id); return; }
    if (isMultiSelected && onGroupDragStart) { onGroupDragStart(e.clientX, e.clientY); return; }

    onBeginDrag?.();
    onAnnotationDragStart?.(node.id);
    onSelect(node.id);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y, did: false };

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.sx;
      const dy = ev.clientY - d.sy;
      if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) d.did = true;
      if (d.did) onUpdate(node.id, { x: d.ox + dx / zoom, y: d.oy + dy / zoom });
    };
    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (d?.did) onEndDrag?.();
      onAnnotationDragEnd?.(node.id);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [node.id, node.x, node.y, zoom, isMultiSelected, onMultiToggle, onGroupDragStart,
    onBeginDrag, onEndDrag, onSelect, onUpdate, onAnnotationDragStart, onAnnotationDragEnd]);

  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const r: ResizeRef = { sx: e.clientX, sy: e.clientY, ow: node.w, oh: node.h };
    onBeginDrag?.();

    const onMove = (ev: MouseEvent) => {
      if (!r) return;
      const dw = (ev.clientX - r.sx) / zoom;
      const dh = (ev.clientY - r.sy) / zoom;
      onUpdate(node.id, {
        w: Math.max(BRAIN_NODE_MIN_W, r.ow + dw),
        h: Math.max(BRAIN_NODE_MIN_H, r.oh + dh),
      });
    };
    const onUp = () => {
      onEndDrag?.();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [node.id, node.w, node.h, zoom, onUpdate, onBeginDrag, onEndDrag]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(node.id);
  }, [node.id, onRemove]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEnter(node.id, node.title ?? 'Knowledge Graph');
  }, [node.id, node.title, onEnter]);

  const rootClassNames = [
    'fm-brain-card',
    isSelected ? 'is-selected' : '',
    isMultiSelected ? 'is-multi-selected' : '',
  ].filter(Boolean).join(' ');

  const docCount = graph?.docCount ?? 0;
  const linkCount = graph?.links.length ?? 0;

  return (
    <div
      className={rootClassNames}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onMouseDown={handleCardMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="fm-brain-card-header">
        <span className="fm-brain-card-header-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2" />
            <circle cx="18" cy="6" r="2" />
            <circle cx="6" cy="18" r="2" />
            <circle cx="18" cy="18" r="2" />
            <circle cx="12" cy="12" r="2.5" />
            <path d="M8 7l2.5 3M16 7l-2.5 3M8 17l2.5-3M16 17l-2.5-3" />
          </svg>
        </span>
        <span className="fm-brain-card-header-title">
          {node.title ?? 'Knowledge Graph'}
        </span>
        <span className="fm-brain-card-header-spacer" />

        <button
          type="button"
          className="fm-brain-card-header-btn"
          title="Open explorer"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEnter(node.id, node.title ?? 'Knowledge Graph'); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
            <path d="M14 21H5a2 2 0 01-2-2V8a2 2 0 012-2h5" />
          </svg>
        </button>

        <button
          type="button"
          className="fm-brain-card-header-btn fm-brain-card-header-btn-danger"
          title="Delete"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="fm-brain-card-body" onDoubleClick={handleDoubleClick}>
        {loading && docCount === 0 ? (
          <div className="fm-brain-card-loading">Indexing knowledge…</div>
        ) : docCount === 0 ? (
          <div className="fm-brain-card-empty">
            No documents in <code>documentation/</code> yet.
          </div>
        ) : (
          <svg
            width={previewW}
            height={previewH}
            viewBox={`0 0 ${previewW} ${previewH}`}
            className="fm-brain-card-preview"
            style={{ pointerEvents: 'none' }}
          >
            {preview.edges.map((e, i) => {
              const a = preview.points[e.a];
              const b = preview.points[e.b];
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="rgba(255,107,53,0.35)" strokeWidth={1}
                />
              );
            })}
            {preview.points.map((p, i) => (
              <circle
                key={i}
                cx={p.x} cy={p.y} r={4}
                fill="#FF6B35" fillOpacity={0.85}
                stroke="rgba(255,255,255,0.4)" strokeWidth={0.5}
              />
            ))}
          </svg>
        )}
      </div>

      <div className="fm-brain-card-footer">
        <span>{docCount} docs</span>
        <span className="fm-brain-card-footer-dot">·</span>
        <span>{linkCount} links</span>
        <span className="fm-brain-card-footer-spacer" />
        <span className="fm-brain-card-footer-hint">Double-click to explore</span>
      </div>

      <div
        className="fm-brain-card-resize"
        onMouseDown={handleResizeDown}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M22 2L2 22M22 10L10 22M22 18L18 22" />
        </svg>
      </div>
    </div>
  );
}
