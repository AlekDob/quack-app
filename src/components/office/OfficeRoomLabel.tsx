import { memo } from 'react';
import { TILE_W, TILE_H } from './officeLayout';
import type { RoomPosition } from './officeLayout';

const WALL_H = 50;

/** Isometric wall angle: atan2(-H/2, W/2) ≈ -26.57° */
const WALL_ANGLE = Math.atan2(-TILE_H / 2, TILE_W / 2);

interface OfficeRoomLabelProps {
  room: RoomPosition;
}

/**
 * Project name text overlay only.
 * Left wall is now drawn in the base layer (OfficeRoom).
 * This layer renders ONLY the text above everything.
 */
function OfficeRoomLabel({ room }: OfficeRoomLabelProps) {
  return (
    <pixiContainer x={room.screenX} y={room.screenY}>
      <pixiText
        text={room.projectName}
        x={TILE_W * 0.25}
        y={TILE_H * 0.25 - WALL_H * 0.45}
        anchor={0.5}
        rotation={WALL_ANGLE}
        style={{
          fill: '#ffffff',
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

export default memo(OfficeRoomLabel);
