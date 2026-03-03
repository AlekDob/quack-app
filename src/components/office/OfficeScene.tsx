import { memo } from 'react';
import OfficeRoom from './OfficeRoom';
import type { RoomPosition } from './officeLayout';
import type { TooltipData } from './officeTypes';

interface OfficeSceneProps {
  rooms: RoomPosition[];
  viewport: { zoom: number; panX: number; panY: number };
  onRoomClick?: (projectPath: string) => void;
  onDuckHover?: (data: TooltipData | null) => void;
  onDuckClick?: (agentId: string, screenX: number, screenY: number) => void;
}

function OfficeScene({
  rooms,
  viewport,
  onRoomClick,
  onDuckHover,
  onDuckClick,
}: OfficeSceneProps) {
  return (
    <pixiContainer
      x={viewport.panX}
      y={viewport.panY}
      scale={viewport.zoom}
    >
      {rooms.map(room => (
        <OfficeRoom
          key={room.projectPath}
          room={room}
          onRoomClick={onRoomClick}
          onDuckHover={onDuckHover}
          onDuckClick={onDuckClick}
        />
      ))}
    </pixiContainer>
  );
}

export default memo(OfficeScene);
