/**
 * Feature Map — Single post-it note rendered in SVG
 * Draggable, editable text, deletable on hover.
 */

import { useRef, useState, useCallback } from 'react';
import type { PostIt } from './annotationTypes';
import { POST_IT_W, POST_IT_H, POST_IT_COLORS } from './annotationTypes';

const DRAG_T = 4;

interface Props {
  postIt: PostIt;
  zoom: number;
  isSelected: boolean;
  onUpdate: (id: string, partial: Partial<PostIt>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
}

export default function CanvasPostIt({ postIt, zoom, isSelected, onUpdate, onRemove, onSelect }: Props) {
  const [hov, setHov] = useState(false);
  const [editing, setEditing] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; did: boolean } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: postIt.x, oy: postIt.y, did: false };
    onSelect(postIt.id);
  }, [postIt.x, postIt.y, postIt.id, onSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) d.did = true;
    if (d.did) onUpdate(postIt.id, { x: d.ox + dx / zoom, y: d.oy + dy / zoom });
  }, [postIt.id, zoom, onUpdate]);

  const handleMouseUp = useCallback(() => {
    const d = dragRef.current;
    if (d && !d.did) {
      // Click → start editing
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    dragRef.current = null;
  }, []);

  const handleTextBlur = useCallback(() => {
    setEditing(false);
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(postIt.id, { text: e.target.value });
  }, [postIt.id, onUpdate]);

  const cycleColor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = POST_IT_COLORS.indexOf(postIt.color);
    const next = POST_IT_COLORS[(idx + 1) % POST_IT_COLORS.length];
    onUpdate(postIt.id, { color: next });
  }, [postIt.id, postIt.color, onUpdate]);

  return (
    <g
      transform={`translate(${postIt.x}, ${postIt.y})`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); dragRef.current = null; }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor: dragRef.current?.did ? 'grabbing' : 'grab' }}
    >
      {/* Shadow */}
      <rect x={2} y={3} width={POST_IT_W} height={POST_IT_H}
        rx={4} fill="rgba(0,0,0,0.25)" />
      {/* Background */}
      <rect width={POST_IT_W} height={POST_IT_H} rx={4}
        fill={postIt.color} opacity={0.9}
        stroke={isSelected ? '#fff' : 'transparent'} strokeWidth={isSelected ? 2 : 0} />
      {/* Folded corner */}
      <path d={`M${POST_IT_W - 16},0 L${POST_IT_W},16 L${POST_IT_W - 16},16 Z`}
        fill="rgba(0,0,0,0.15)" />

      {/* Text area */}
      <foreignObject x={8} y={8} width={POST_IT_W - 16} height={POST_IT_H - 16}>
        <textarea
          ref={inputRef}
          value={postIt.text}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          readOnly={!editing}
          placeholder="Scrivi..."
          style={{
            width: '100%', height: '100%', resize: 'none',
            background: 'transparent', border: 'none', outline: 'none',
            color: '#1a1a2e', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif',
            lineHeight: 1.4, cursor: editing ? 'text' : 'inherit',
          }}
        />
      </foreignObject>

      {/* Controls (visible on hover) */}
      {hov && (
        <>
          {/* Delete button */}
          <g onClick={(e) => { e.stopPropagation(); onRemove(postIt.id); }}
            style={{ cursor: 'pointer' }}>
            <circle cx={POST_IT_W - 6} cy={-6} r={8} fill="#ef4444" />
            <text x={POST_IT_W - 6} y={-3} textAnchor="middle" fill="#fff"
              fontSize={10} fontWeight="bold" fontFamily="sans-serif">×</text>
          </g>
          {/* Color cycle button */}
          <g onClick={cycleColor} style={{ cursor: 'pointer' }}>
            <circle cx={-6} cy={-6} r={8} fill={postIt.color} stroke="#fff" strokeWidth={1.5} />
          </g>
        </>
      )}
    </g>
  );
}
