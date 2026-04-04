/**
 * Feature Map — Canvas image annotation (SVG)
 * Draggable, resizable (corner handle, aspect-ratio locked), delete on hover.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CanvasImage as CanvasImageType } from './annotationTypes';
import { normalizeToForwardSlash } from '../../utils/platform';

const DRAG_T = 4;
const HANDLE_SIZE = 10;
const BORDER_COLOR = '#00d9ff';
const BORDER_SELECTED = '#ff6b35';

interface Props {
  image: CanvasImageType;
  zoom: number;
  projectPath: string;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onUpdate: (id: string, partial: Partial<CanvasImageType>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
  onMultiToggle?: (id: string) => void;
  onGroupDragStart?: (clientX: number, clientY: number) => void;
}

export default function CanvasImage({ image, zoom, projectPath, isSelected, isMultiSelected, onUpdate, onRemove, onSelect, onMultiToggle, onGroupDragStart }: Props) {
  const [hov, setHov] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; did: boolean } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number; ratio: number } | null>(null);

  // Load image from filesystem as blob URL
  useEffect(() => {
    let revoke: string | null = null;
    const normProject = normalizeToForwardSlash(projectPath);
    const absPath = `${normProject}/documentation/features/${image.src}`;
    invoke<number[]>('read_binary_file', { path: absPath })
      .then(bytes => {
        const ext = image.src.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'gif' ? 'image/gif'
          : ext === 'webp' ? 'image/webp'
          : ext === 'svg' ? 'image/svg+xml'
          : 'image/png';
        const blob = new Blob([new Uint8Array(bytes)], { type: mime });
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(() => setBlobUrl(null));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [projectPath, image.src]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    // Shift+click toggles multi-select
    if (e.shiftKey && onMultiToggle) { onMultiToggle(image.id); return; }
    // If multi-selected, start group drag (Canvas handles all selected items)
    if (isMultiSelected && onGroupDragStart) { onGroupDragStart(e.clientX, e.clientY); return; }
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: image.x, oy: image.y, did: false };
    onSelect(image.id);
  }, [image.x, image.y, image.id, onSelect, onMultiToggle, isMultiSelected, onGroupDragStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Resize
    const rs = resizeRef.current;
    if (rs) {
      const dx = (e.clientX - rs.sx) / zoom;
      const newW = Math.max(60, rs.ow + dx);
      const newH = newW / rs.ratio;
      onUpdate(image.id, { w: newW, h: newH });
      return;
    }
    // Drag
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) d.did = true;
    if (d.did) onUpdate(image.id, { x: d.ox + dx / zoom, y: d.oy + dy / zoom });
  }, [image.id, zoom, onUpdate]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: image.w, oh: image.h, ratio: image.w / image.h };
    onSelect(image.id);
  }, [image.w, image.h, image.id, onSelect]);

  const border = isMultiSelected ? '#3b82f6' : isSelected ? BORDER_SELECTED : hov ? BORDER_COLOR : 'transparent';

  return (
    <g
      transform={`translate(${image.x}, ${image.y})`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); dragRef.current = null; resizeRef.current = null; }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor: dragRef.current?.did ? 'grabbing' : 'grab' }}
    >
      {/* Shadow */}
      <rect x={2} y={3} width={image.w} height={image.h} rx={6} fill="rgba(0,0,0,0.3)" />

      {/* Border */}
      <rect width={image.w} height={image.h} rx={6}
        fill="none" stroke={border} strokeWidth={isSelected || hov ? 2 : 0} />

      {/* Image */}
      {blobUrl ? (
        <image href={blobUrl} x={0} y={0} width={image.w} height={image.h}
          preserveAspectRatio="xMidYMid slice" clipPath={`inset(0 round 6px)`}
          style={{ pointerEvents: 'none' }} />
      ) : (
        <rect width={image.w} height={image.h} rx={6}
          fill="#1e293b" stroke="#334155" strokeWidth={1} />
      )}

      {/* Placeholder icon when no blob */}
      {!blobUrl && (
        <g transform={`translate(${image.w / 2 - 12}, ${image.h / 2 - 12})`} opacity={0.3}>
          <rect x={2} y={2} width={20} height={20} rx={4}
            fill="none" stroke="#94a3b8" strokeWidth={1.5} />
          <circle cx={8} cy={8} r={2} fill="#94a3b8" />
          <path d="M2 18l5-6 3 3 4-5 8 8" stroke="#94a3b8" strokeWidth={1.5} fill="none" />
        </g>
      )}

      {/* Controls on hover */}
      {hov && (
        <>
          {/* Delete button */}
          <g onClick={(e) => { e.stopPropagation(); onRemove(image.id); }}
            style={{ cursor: 'pointer' }}>
            <circle cx={image.w - 6} cy={-6} r={8} fill="#ef4444" />
            <text x={image.w - 6} y={-3} textAnchor="middle" fill="#fff"
              fontSize={10} fontWeight="bold" fontFamily="sans-serif">x</text>
          </g>
          {/* Resize handle (bottom-right) */}
          <rect
            x={image.w - HANDLE_SIZE} y={image.h - HANDLE_SIZE}
            width={HANDLE_SIZE} height={HANDLE_SIZE}
            rx={2} fill={BORDER_COLOR} opacity={0.8}
            style={{ cursor: 'nwse-resize' }}
            onMouseDown={handleResizeDown}
          />
        </>
      )}
    </g>
  );
}
