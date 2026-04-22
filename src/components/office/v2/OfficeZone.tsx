import { memo } from 'react';
import type { OfficeZone as ZoneData } from './officeTypes';

interface Props {
  zone: ZoneData;
  dragActive?: boolean;
  hoverTarget?: boolean;
  onLabelPointerDown?: (zoneId: string, e: React.PointerEvent) => void;
  onResizeHandlePointerDown?: (zoneId: string, corner: 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) => void;
}

function OfficeZoneImpl({ zone, dragActive, hoverTarget, onLabelPointerDown, onResizeHandlePointerDown }: Props) {
  const stroke = hoverTarget ? '#f59e0b' : zone.color;
  const strokeWidth = hoverTarget ? 3 : 1.5;

  return (
    <g className={`office-zone ${dragActive ? 'office-zone--dragging' : ''}`}>
      <defs>
        <linearGradient id={`zone-grad-${zone.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={zone.color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={zone.color} stopOpacity="0.03" />
        </linearGradient>
      </defs>

      <rect
        x={zone.x}
        y={zone.y}
        width={zone.w}
        height={zone.h}
        fill={`url(#zone-grad-${zone.id})`}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray="6 4"
        rx={8}
      />

      <text
        x={zone.x + 10}
        y={zone.y + 16}
        className="office-zone__label"
        fill={zone.color}
        onPointerDown={(e) => onLabelPointerDown?.(zone.id, e)}
      >
        {zone.label.toUpperCase()}
      </text>

      {(['nw', 'ne', 'sw', 'se'] as const).map(corner => {
        const cx = corner.includes('w') ? zone.x : zone.x + zone.w;
        const cy = corner.includes('n') ? zone.y : zone.y + zone.h;
        return (
          <circle
            key={corner}
            cx={cx}
            cy={cy}
            r={5}
            className={`office-zone__handle office-zone__handle--${corner}`}
            onPointerDown={(e) => onResizeHandlePointerDown?.(zone.id, corner, e)}
          />
        );
      })}
    </g>
  );
}

export const OfficeZone = memo(OfficeZoneImpl);
