import { memo } from 'react';
import { TILE_W, TILE_H } from './officeLayout';
import type { BreakRoomPosition } from './officeLayout';

const WALL_H = 50;
const WALL_ANGLE = Math.atan2(-TILE_H / 2, TILE_W / 2);

interface OfficeBreakRoomLabelProps {
  position: BreakRoomPosition;
}

function OfficeBreakRoomLabel({ position }: OfficeBreakRoomLabelProps) {
  return (
    <pixiContainer x={position.screenX} y={position.screenY}>
      <pixiText
        text="Break Room"
        x={TILE_W * 0.25}
        y={TILE_H * 0.25 - WALL_H * 0.45}
        anchor={0.5}
        rotation={WALL_ANGLE}
        style={{
          fill: '#ff6b35', // PixiJS requires resolved hex (no CSS variables) — accent fallback
          fontSize: 13,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: '700',
          letterSpacing: 1,
          dropShadow: {
            alpha: 0.6,
            angle: Math.PI / 4,
            blur: 3,
            color: '#000000',
            distance: 1,
          },
        }}
      />
    </pixiContainer>
  );
}

export default memo(OfficeBreakRoomLabel);
