import { useCallback, memo } from 'react';
import OfficeDuck from './OfficeDuck';
import { TILE_W, TILE_H, getDuckLocalPosition } from './officeLayout';
import type { RoomPosition } from './officeLayout';
import type { TooltipData } from './officeTypes';

const WALL_H = 50;
const FLOOR_COLOR = 0x1e1e3a;
const FLOOR_STROKE = 0x3a3a5c;
const WALL_LEFT_COLOR = 0x2a2a4a;
const WALL_RIGHT_COLOR = 0x242444;
const DESK_COLOR = 0x5c3d2e;
const MONITOR_COLOR = 0x3498db;

interface OfficeRoomProps {
  room: RoomPosition;
  onRoomClick?: (projectPath: string) => void;
  onDuckHover?: (data: TooltipData | null) => void;
  onDuckClick?: (agentId: string, screenX: number, screenY: number) => void;
}

function OfficeRoom({ room, onRoomClick, onDuckHover, onDuckClick }: OfficeRoomProps) {
  // Isometric floor diamond
  const drawFloor = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.lineTo(0, TILE_H / 2);
    g.closePath();
    g.fill({ color: FLOOR_COLOR, alpha: 0.9 });
    g.stroke({ color: FLOOR_STROKE, width: 1.5 });
  }, []);

  // Left wall (back-left)
  const drawLeftWall = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    g.moveTo(0, TILE_H / 2);
    g.lineTo(TILE_W / 2, 0);
    g.lineTo(TILE_W / 2, -WALL_H);
    g.lineTo(0, TILE_H / 2 - WALL_H);
    g.closePath();
    g.fill({ color: WALL_LEFT_COLOR, alpha: 0.7 });
    g.stroke({ color: FLOOR_STROKE, width: 1 });
  }, []);

  // Right wall (back-right)
  const drawRightWall = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W, TILE_H / 2 - WALL_H);
    g.lineTo(TILE_W / 2, -WALL_H);
    g.closePath();
    g.fill({ color: WALL_RIGHT_COLOR, alpha: 0.7 });
    g.stroke({ color: FLOOR_STROKE, width: 1 });
  }, []);

  // Desk furniture
  const drawDesk = useCallback((g: import('pixi.js').Graphics) => {
    g.clear();
    // Desk surface (small isometric rectangle)
    const dw = 60, dh = 20;
    const dx = TILE_W / 2 - dw / 2, dy = TILE_H / 2 - 10;
    g.rect(dx, dy, dw, dh);
    g.fill({ color: DESK_COLOR });
    g.stroke({ color: 0x4a2e1a, width: 1 });
    // Monitor on desk
    g.rect(dx + dw / 2 - 8, dy - 12, 16, 12);
    g.fill({ color: MONITOR_COLOR, alpha: 0.8 });
    g.stroke({ color: 0x2980b9, width: 1 });
  }, []);

  return (
    <pixiContainer
      x={room.screenX}
      y={room.screenY}
      eventMode="static"
      cursor="pointer"
      onclick={() => onRoomClick?.(room.projectPath)}
    >
      {/* Room structure */}
      <pixiGraphics draw={drawLeftWall} />
      <pixiGraphics draw={drawRightWall} />
      <pixiGraphics draw={drawFloor} />
      <pixiGraphics draw={drawDesk} />

      {/* Project name label */}
      <pixiText
        text={room.projectName}
        x={TILE_W / 2}
        y={TILE_H + 8}
        anchor={0.5}
        style={{
          fill: '#aaaacc',
          fontSize: 11,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: '600',
        }}
      />

      {/* Agent count badge */}
      {room.agents.length > 0 && (
        <pixiText
          text={`${room.agents.length}`}
          x={TILE_W - 15}
          y={-WALL_H + 5}
          anchor={0.5}
          style={{
            fill: '#00D9FF',
            fontSize: 10,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 'bold',
          }}
        />
      )}

      {/* Duck agents */}
      {room.agents.map((agent, i) => {
        const pos = getDuckLocalPosition(i, room.agents.length);
        return (
          <OfficeDuck
            key={agent.id}
            agent={agent}
            localX={pos.x}
            localY={pos.y}
            onHover={onDuckHover}
            onClick={onDuckClick}
          />
        );
      })}
    </pixiContainer>
  );
}

export default memo(OfficeRoom);
