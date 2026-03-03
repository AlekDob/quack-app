import { memo } from 'react';
import OfficeRoom from './OfficeRoom';
import OfficeRoomLabel from './OfficeRoomLabel';
import OfficeBreakRoom from './OfficeBreakRoom';
import OfficeBreakRoomLabel from './OfficeBreakRoomLabel';
import type { RoomPosition, BreakRoomPosition } from './officeLayout';
import type { TooltipData } from './officeTypes';

interface OfficeSceneProps {
  rooms: RoomPosition[];
  breakRoom: BreakRoomPosition;
  viewport: { zoom: number; panX: number; panY: number };
  /** Pre-computed session dot colors per agent (from DOM tree where Zustand works) */
  agentDotColors?: Map<string, number[]>;
  onRoomClick?: (projectPath: string) => void;
  onDuckHover?: (data: TooltipData | null) => void;
  onDuckClick?: (agentId: string, screenX: number, screenY: number) => void;
}

/**
 * 5-layer render order (children rendered bottom→top, hit-tested top→bottom):
 * 1. Base: walls, floor (project rooms + break room)
 * 2. Labels: project name text + break room label (non-interactive)
 * 3. Furniture: break room sofas, TV, vending machine (non-interactive)
 * 3b. Desks: workstations with diamond mask (non-interactive passthrough)
 * 4. Ducks: avatars (interactive — click opens menu)
 *
 * No sortableChildren/zIndex — JSX child order is the render order.
 */
function OfficeScene({
  rooms,
  breakRoom,
  viewport,
  agentDotColors,
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
      {/* Layer 1: Room bases (walls, floor) + break room base */}
      <pixiContainer>
        {rooms.map(room => (
          <OfficeRoom
            key={`base-${room.projectPath}`}
            room={room}
            layer="base"
            onRoomClick={onRoomClick}
          />
        ))}
        <OfficeBreakRoom position={breakRoom} layer="base" />
      </pixiContainer>

      {/* Layer 2: Labels (non-interactive) */}
      <pixiContainer interactiveChildren={false}>
        {rooms.map(room => (
          <OfficeRoomLabel
            key={`label-${room.projectPath}`}
            room={room}
          />
        ))}
        <OfficeBreakRoomLabel position={breakRoom} />
      </pixiContainer>

      {/* Layer 3: Desks + break room furniture (non-interactive) */}
      <pixiContainer interactiveChildren={false}>
        {rooms.map(room => (
          <OfficeRoom
            key={`desks-${room.projectPath}`}
            room={room}
            layer="desks"
          />
        ))}
        <OfficeBreakRoom position={breakRoom} layer="furniture" />
      </pixiContainer>

      {/* Layer 4: Duck avatars (interactive — topmost for click events) */}
      <pixiContainer>
        {rooms.map(room => (
          <OfficeRoom
            key={`ducks-${room.projectPath}`}
            room={room}
            layer="ducks"
            agentDotColors={agentDotColors}
            onDuckHover={onDuckHover}
            onDuckClick={onDuckClick}
          />
        ))}
      </pixiContainer>
    </pixiContainer>
  );
}

export default memo(OfficeScene);
