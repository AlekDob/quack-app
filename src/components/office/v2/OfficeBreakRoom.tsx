import { memo } from 'react';

interface Props {
  x: number;
  y: number;
  w?: number;
  h?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
}

const DEFAULT_W = 320;
const DEFAULT_H = 200;

function OfficeBreakRoomImpl({ x, y, w = DEFAULT_W, h = DEFAULT_H, onPointerDown }: Props) {
  return (
    <g className="office-break-room" onPointerDown={onPointerDown}>
      <rect x={x} y={y} width={w} height={h} fill="#2a1f1a" stroke="#1a3a3a" strokeWidth={1.5} strokeDasharray="6 4" rx={8} />
      <text x={x + 10} y={y + 16} fill="#ff6b35" className="office-break-room__label">BREAK ROOM</text>

      <rect x={x + 20} y={y + 50} width={100} height={22} rx={6} fill="#3d2a1e" />
      <rect x={x + 20} y={y + 90} width={100} height={22} rx={6} fill="#3d2a1e" />

      <rect x={x + 160} y={y + 50} width={70} height={40} rx={3} fill="#0a0a0a" stroke="#1a3a3a" />
      <circle cx={x + 195} cy={y + 70} r={2} fill="#00d9ff" />

      <rect x={x + 250} y={y + 50} width={50} height={130} rx={4} fill="#1a2a3a" stroke="#2a4a5a" />
      <rect x={x + 258} y={y + 60} width={34} height={20} rx={2} fill="#22c55e" />
      {[0, 1, 2, 3].map(i => (
        <circle key={i} cx={x + 267 + (i % 2) * 14} cy={y + 95 + Math.floor(i / 2) * 14} r={3} fill="rgba(255,255,255,0.3)" />
      ))}
    </g>
  );
}

export const OfficeBreakRoom = memo(OfficeBreakRoomImpl);
