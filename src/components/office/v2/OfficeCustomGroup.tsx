import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type { OfficeCustomGroup as GroupData } from './officeTypes';

interface Props {
  group: GroupData;
  onUpdate: (patch: Partial<Omit<GroupData, 'id'>>) => void;
  onDelete: () => void;
  onDragStart: (id: string, e: React.PointerEvent) => void;
  onResizeStart: (id: string, corner: 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) => void;
}

function OfficeCustomGroupImpl({ group, onUpdate, onDelete, onDragStart, onResizeStart }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.label);
  const inputRef = useRef<SVGForeignObjectElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setDraft(group.label);
  }, [group.label]);

  const commit = useCallback(() => {
    if (draft !== group.label) onUpdate({ label: draft });
    setEditing(false);
  }, [draft, group.label, onUpdate]);

  const corners = ['nw', 'ne', 'sw', 'se'] as const;

  return (
    <g
      className="office-cgroup"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <rect
        x={group.x}
        y={group.y}
        width={group.w}
        height={group.h}
        fill={`${group.color}14`}
        stroke={group.color}
        strokeWidth={1.5}
        strokeDasharray="6 4"
        rx={8}
        onPointerDown={(e) => { if (!editing) onDragStart(group.id, e); }}
      />

      {editing ? (
        <foreignObject ref={inputRef} x={group.x + 8} y={group.y + 4} width={Math.max(80, group.w - 32)} height={24}>
          <input
            autoFocus
            className="office-cgroup__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(group.label); setEditing(false); }
              if (e.key === 'Enter') commit();
            }}
          />
        </foreignObject>
      ) : (
        <text
          x={group.x + 10}
          y={group.y + 18}
          className="office-cgroup__label"
          fill={group.color}
          onDoubleClick={() => setEditing(true)}
        >
          {group.label || 'Group'}
        </text>
      )}

      {hovered && (
        <g
          className="office-cgroup__delete"
          transform={`translate(${group.x + group.w - 14}, ${group.y + 14})`}
          onClick={onDelete}
        >
          <circle r={8} fill="#dc2626" />
          <path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}

      {corners.map(corner => {
        const cx = corner.includes('w') ? group.x : group.x + group.w;
        const cy = corner.includes('n') ? group.y : group.y + group.h;
        return (
          <circle
            key={corner}
            cx={cx}
            cy={cy}
            r={5}
            className={`office-cgroup__handle office-cgroup__handle--${corner}`}
            onPointerDown={(e) => onResizeStart(group.id, corner, e)}
          />
        );
      })}
    </g>
  );
}

export const OfficeCustomGroup = memo(OfficeCustomGroupImpl);
