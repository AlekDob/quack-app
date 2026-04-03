/**
 * Feature Map — Group rectangle annotation (SVG)
 * Draggable body, resizable via corner handles, editable label.
 */

import { useRef, useState, useCallback } from 'react';
import type { GroupRect } from './annotationTypes';
import { GROUP_MIN_W, GROUP_MIN_H, GROUP_COLORS } from './annotationTypes';

const DRAG_T = 4;
const HANDLE_R = 6;

interface Props {
  group: GroupRect;
  zoom: number;
  isSelected: boolean;
  onUpdate: (id: string, partial: Partial<GroupRect>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export default function CanvasGroupRect({ group, zoom, isSelected, onUpdate, onRemove, onSelect }: Props) {
  const [hov, setHov] = useState(false);
  const [editLabel, setEditLabel] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; did: boolean } | null>(null);
  const resizeRef = useRef<{
    corner: Corner; sx: number; sy: number;
    ox: number; oy: number; ow: number; oh: number;
  } | null>(null);

  // Body drag
  const handleBodyDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: group.x, oy: group.y, did: false };
    onSelect(group.id);
  }, [group.x, group.y, group.id, onSelect]);

  const handleMove = useCallback((e: React.MouseEvent) => {
    // Resize
    const r = resizeRef.current;
    if (r) {
      const dx = (e.clientX - r.sx) / zoom;
      const dy = (e.clientY - r.sy) / zoom;
      let { ox, oy, ow, oh } = r;
      if (r.corner === 'br') { ow += dx; oh += dy; }
      else if (r.corner === 'bl') { ox += dx; ow -= dx; oh += dy; }
      else if (r.corner === 'tr') { oy += dy; ow += dx; oh -= dy; }
      else { ox += dx; oy += dy; ow -= dx; oh -= dy; }
      onUpdate(group.id, {
        x: ow >= GROUP_MIN_W ? ox : group.x,
        y: oh >= GROUP_MIN_H ? oy : group.y,
        w: Math.max(GROUP_MIN_W, ow),
        h: Math.max(GROUP_MIN_H, oh),
      });
      return;
    }
    // Body drag
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) d.did = true;
    if (d.did) onUpdate(group.id, { x: d.ox + dx / zoom, y: d.oy + dy / zoom });
  }, [group.id, group.x, group.y, zoom, onUpdate]);

  const handleUp = useCallback(() => {
    if (dragRef.current && !dragRef.current.did) setEditLabel(true);
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  const handleResizeDown = useCallback((corner: Corner, e: React.MouseEvent) => {
    e.stopPropagation();
    resizeRef.current = {
      corner, sx: e.clientX, sy: e.clientY,
      ox: group.x, oy: group.y, ow: group.w, oh: group.h,
    };
  }, [group.x, group.y, group.w, group.h]);

  const cycleColor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = GROUP_COLORS.indexOf(group.color);
    onUpdate(group.id, { color: GROUP_COLORS[(idx + 1) % GROUP_COLORS.length] });
  }, [group.id, group.color, onUpdate]);

  const corners: { key: Corner; cx: number; cy: number; cursor: string }[] = [
    { key: 'tl', cx: group.x, cy: group.y, cursor: 'nwse-resize' },
    { key: 'tr', cx: group.x + group.w, cy: group.y, cursor: 'nesw-resize' },
    { key: 'bl', cx: group.x, cy: group.y + group.h, cursor: 'nesw-resize' },
    { key: 'br', cx: group.x + group.w, cy: group.y + group.h, cursor: 'nwse-resize' },
  ];

  return (
    <g
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); dragRef.current = null; resizeRef.current = null; }}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
    >
      {/* Body rect */}
      <rect
        x={group.x} y={group.y} width={group.w} height={group.h}
        rx={12} fill={group.color} fillOpacity={0.07}
        stroke={group.color} strokeWidth={isSelected ? 2 : 1.5}
        strokeOpacity={isSelected ? 0.7 : 0.35}
        strokeDasharray={isSelected ? 'none' : '8 4'}
        style={{ cursor: 'move' }}
        onMouseDown={handleBodyDown}
      />

      {/* Label */}
      {editLabel ? (
        <foreignObject x={group.x + 12} y={group.y + 6} width={group.w - 50} height={24}>
          <input
            autoFocus
            value={group.label}
            onChange={(e) => onUpdate(group.id, { label: e.target.value })}
            onBlur={() => setEditLabel(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditLabel(false)}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              outline: 'none', color: group.color, fontSize: 12,
              fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif',
            }}
          />
        </foreignObject>
      ) : (
        <text x={group.x + 14} y={group.y + 20}
          fill={group.color} fontSize={12} fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif" opacity={0.8}>
          {group.label}
        </text>
      )}

      {/* Controls on hover */}
      {hov && (
        <>
          <g onClick={(e) => { e.stopPropagation(); onRemove(group.id); }}
            style={{ cursor: 'pointer' }}>
            <circle cx={group.x + group.w - 8} cy={group.y - 8} r={8} fill="#ef4444" />
            <text x={group.x + group.w - 8} y={group.y - 5} textAnchor="middle"
              fill="#fff" fontSize={10} fontWeight="bold">×</text>
          </g>
          <g onClick={cycleColor} style={{ cursor: 'pointer' }}>
            <circle cx={group.x + group.w - 26} cy={group.y - 8} r={8}
              fill={group.color} stroke="#fff" strokeWidth={1.5} />
          </g>
        </>
      )}

      {/* Resize handles (when selected) */}
      {isSelected && corners.map(c => (
        <circle key={c.key} cx={c.cx} cy={c.cy} r={HANDLE_R}
          fill="#fff" stroke={group.color} strokeWidth={2}
          style={{ cursor: c.cursor }}
          onMouseDown={(e) => handleResizeDown(c.key, e)}
        />
      ))}
    </g>
  );
}
