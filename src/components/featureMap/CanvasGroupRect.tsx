/**
 * Feature Map — Group rectangle annotation (SVG)
 * Draggable body, resizable via corner handles, editable label.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { GroupRect, CanvasAnnotations } from './annotationTypes';
import { GROUP_MIN_W, GROUP_MIN_H, GROUP_COLORS, POST_IT_W, POST_IT_H } from './annotationTypes';

const DRAG_T = 4;
const HANDLE_R = 4;

interface Props {
  group: GroupRect;
  zoom: number;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onUpdate: (id: string, partial: Partial<GroupRect>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
  onMultiToggle?: (id: string) => void;
  onGroupDragStart?: (clientX: number, clientY: number) => void;
  onBeginDrag?: () => void;
  onEndDrag?: () => void;
  onEnterComponent?: (id: string, label: string) => void;
  childCount?: number;
  childAnnotations?: CanvasAnnotations;
  isDropTarget?: boolean;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export default function CanvasGroupRect({ group, zoom, isSelected, isMultiSelected, onUpdate, onRemove, onSelect, onMultiToggle, onGroupDragStart, onBeginDrag, onEndDrag, onEnterComponent, childCount = 0, childAnnotations, isDropTarget }: Props) {
  const isComp = group.isComponent === true;
  const [hov, setHov] = useState(false);
  const [editLabel, setEditLabel] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; did: boolean } | null>(null);
  const resizeRef = useRef<{
    corner: Corner; sx: number; sy: number;
    ox: number; oy: number; ow: number; oh: number;
  } | null>(null);

  // Brain: fix-group-resize-mouse-escape — stable ref for props used in window listeners
  const propsRef = useRef({ zoom, groupId: group.id, groupX: group.x, groupY: group.y, onUpdate, onEndDrag });
  propsRef.current = { zoom, groupId: group.id, groupX: group.x, groupY: group.y, onUpdate, onEndDrag };

  // Stable window-level handlers (no deps = never recreated = never stale-removed)
  const handleWindowMove = useCallback((e: MouseEvent) => {
    const { zoom: z, groupId, groupX, groupY, onUpdate: update } = propsRef.current;
    const r = resizeRef.current;
    if (r) {
      const dx = (e.clientX - r.sx) / z;
      const dy = (e.clientY - r.sy) / z;
      let { ox, oy, ow, oh } = r;
      if (r.corner === 'br') { ow += dx; oh += dy; }
      else if (r.corner === 'bl') { ox += dx; ow -= dx; oh += dy; }
      else if (r.corner === 'tr') { oy += dy; ow += dx; oh -= dy; }
      else { ox += dx; oy += dy; ow -= dx; oh -= dy; }
      update(groupId, {
        x: ow >= GROUP_MIN_W ? ox : groupX,
        y: oh >= GROUP_MIN_H ? oy : groupY,
        w: Math.max(GROUP_MIN_W, ow),
        h: Math.max(GROUP_MIN_H, oh),
      });
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > DRAG_T || Math.abs(dy) > DRAG_T) d.did = true;
    if (d.did) update(groupId, { x: d.ox + dx / z, y: d.oy + dy / z });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWindowUp = useCallback(() => {
    if (dragRef.current && !dragRef.current.did) setEditLabel(true);
    else if (dragRef.current?.did || resizeRef.current) propsRef.current.onEndDrag?.();
    dragRef.current = null;
    resizeRef.current = null;
    window.removeEventListener('mousemove', handleWindowMove);
    window.removeEventListener('mouseup', handleWindowUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup only on unmount
  useEffect(() => () => {
    window.removeEventListener('mousemove', handleWindowMove);
    window.removeEventListener('mouseup', handleWindowUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Body drag
  const handleBodyDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (e.shiftKey && onMultiToggle) { onMultiToggle(group.id); return; }
    if (isMultiSelected && onGroupDragStart) { onGroupDragStart(e.clientX, e.clientY); return; }
    onBeginDrag?.();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: group.x, oy: group.y, did: false };
    onSelect(group.id);
    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
  }, [group.x, group.y, group.id, onSelect, onMultiToggle, isMultiSelected, onGroupDragStart, handleWindowMove, handleWindowUp]);

  const handleResizeDown = useCallback((corner: Corner, e: React.MouseEvent) => {
    e.stopPropagation();
    resizeRef.current = {
      corner, sx: e.clientX, sy: e.clientY,
      ox: group.x, oy: group.y, ow: group.w, oh: group.h,
    };
    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
  }, [group.x, group.y, group.w, group.h, handleWindowMove, handleWindowUp]);

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
      onMouseLeave={() => { if (!dragRef.current && !resizeRef.current) setHov(false); }}
    >
      {/* Invisible hover extension — captures mouse above body for delete/color buttons */}
      <rect
        x={group.x} y={group.y - 24} width={group.w} height={24}
        fill="transparent" />

      {/* Body rect */}
      <rect
        x={group.x} y={group.y} width={group.w} height={group.h}
        rx={12} fill={group.color} fillOpacity={isDropTarget ? 0.18 : isComp ? 0.1 : 0.07}
        stroke={isDropTarget ? '#f59e0b' : isMultiSelected ? '#3b82f6' : group.color}
        strokeWidth={isDropTarget ? 3 : isMultiSelected || isSelected ? 2 : isComp ? 2 : 1.5}
        strokeOpacity={isDropTarget ? 0.9 : isMultiSelected ? 0.8 : isSelected ? 0.7 : isComp ? 0.5 : 0.35}
        strokeDasharray={isDropTarget || isMultiSelected || isSelected || isComp ? 'none' : '8 4'}
        style={{ cursor: 'move' }}
        onMouseDown={handleBodyDown}
        onDoubleClick={() => isComp && onEnterComponent?.(group.id, group.label)}
      />

      {/* Component icon (layers) */}
      {isComp && (
        <g transform={`translate(${group.x + 10}, ${group.y + 10})`} opacity={0.6}>
          <rect x={0} y={0} width={10} height={6} rx={1} fill={group.color} />
          <rect x={0} y={8} width={10} height={6} rx={1} fill={group.color} />
        </g>
      )}

      {/* Label — text hidden when editing to prevent overlap */}
      {!editLabel && (
        <text x={group.x + (isComp ? 28 : 14)} y={group.y + 20}
          fill={group.color} fontSize={12} fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif" opacity={0.8}>
          {group.label}
        </text>
      )}
      {editLabel && (
        <foreignObject x={group.x + (isComp ? 24 : 10)} y={group.y + 6} width={group.w - 50} height={24}>
          <input
            autoFocus
            value={group.label}
            onChange={(e) => onUpdate(group.id, { label: e.target.value })}
            onBlur={() => setEditLabel(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditLabel(false)}
            style={{
              width: '100%', background: '#111827', border: '1px solid ' + group.color,
              borderRadius: 4, outline: 'none', color: group.color, fontSize: 12,
              fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif',
              padding: '1px 4px',
            }}
          />
        </foreignObject>
      )}

      {/* Child count badge (components only) */}
      {isComp && childCount > 0 && (
        <g>
          <rect x={group.x + group.w - 32} y={group.y + 6} width={24} height={16} rx={8}
            fill={group.color} fillOpacity={0.2} stroke={group.color} strokeWidth={0.5} strokeOpacity={0.4} />
          <text x={group.x + group.w - 20} y={group.y + 14} textAnchor="middle"
            dominantBaseline="central" fill={group.color} fontSize={9} fontWeight="bold"
            fontFamily="Inter, system-ui, sans-serif">{childCount}</text>
        </g>
      )}

      {/* Mini-preview of children (components only, at parent level) */}
      {isComp && childAnnotations && childCount > 0 && (() => {
        const pad = 12;
        const topOff = 32; // space for label
        const areaW = group.w - pad * 2;
        const areaH = group.h - topOff - pad;
        if (areaW < 40 || areaH < 30) return null;
        // Compute children bounding box
        const all = [
          ...childAnnotations.postIts.map(p => ({ x: p.x, y: p.y, w: POST_IT_W, h: POST_IT_H, color: p.color, type: 'p' as const })),
          ...childAnnotations.groups.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h, color: g.color, type: 'g' as const })),
          ...childAnnotations.images.map(i => ({ x: i.x, y: i.y, w: i.w, h: i.h, color: '#475569', type: 'i' as const })),
        ];
        if (all.length === 0) return null;
        const maxItems = 12;
        const shown = all.slice(0, maxItems);
        const extra = all.length - maxItems;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of all) {
          minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
          maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h);
        }
        const bw = maxX - minX || 1;
        const bh = maxY - minY || 1;
        const scale = Math.min(areaW / bw, areaH / bh, 1);
        const ox = group.x + pad + (areaW - bw * scale) / 2;
        const oy = group.y + topOff + (areaH - bh * scale) / 2;
        return (
          <g opacity={0.45} style={{ pointerEvents: 'none' }}>
            {shown.map((c, i) => (
              <rect key={i}
                x={ox + (c.x - minX) * scale} y={oy + (c.y - minY) * scale}
                width={c.w * scale} height={c.h * scale}
                rx={2} fill={c.color} fillOpacity={c.type === 'p' ? 0.6 : 0.3}
                stroke={c.color} strokeWidth={0.5} strokeOpacity={0.5} />
            ))}
            {extra > 0 && (
              <text x={group.x + group.w - pad} y={group.y + group.h - 8}
                textAnchor="end" fill={group.color} fontSize={9} opacity={0.6}
                fontFamily="Inter, system-ui, sans-serif">+{extra} more</text>
            )}
          </g>
        );
      })()}

      {/* Controls on hover — spaced apart */}
      {hov && (
        <>
          <g onClick={(e) => { e.stopPropagation(); onRemove(group.id); }}
            style={{ cursor: 'pointer' }}>
            <circle cx={group.x + group.w - 10} cy={group.y - 12} r={7} fill="#ef4444" />
            <text x={group.x + group.w - 10} y={group.y - 9} textAnchor="middle"
              fill="#fff" fontSize={9} fontWeight="bold">x</text>
          </g>
          <g onClick={cycleColor} style={{ cursor: 'pointer' }}>
            <circle cx={group.x + group.w - 30} cy={group.y - 12} r={7}
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
