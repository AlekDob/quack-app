import { useCallback, useEffect, useRef, memo, useMemo } from "react";
import OfficeDuck from "./OfficeDuck";
import { TILE_W, TILE_H, getWorkstationPositions } from "./officeLayout";
import type { RoomPosition } from "./officeLayout";
const WALL_H = 50;
const FLOOR_COLOR = 0x1e1e3a;
const FLOOR_STROKE = 0x3a3a5c;
const WALL_LEFT = 0x2a2a4a;
const WALL_RIGHT = 0x242444;
const DESK_TOP = 0x6b4226;
const DESK_FRONT = 0x5c3a22;
const DESK_SIDE = 0x4e3020;
const MONITOR_BEZEL = 0x222222;
const KEYBOARD_COLOR = 0x333333;

// Desk depth direction: rotated 10° CCW from default isometric (10, -10)
const DEPTH_ANGLE = ((-95 - 10) * Math.PI) / 180;
const DEPTH_LEN = Math.SQRT2 * 10;
const DPX = Math.round(DEPTH_LEN * Math.cos(DEPTH_ANGLE));
const DPY = Math.round(DEPTH_LEN * Math.sin(DEPTH_ANGLE));


type RenderLayer = "base" | "ducks" | "desks";

interface OfficeRoomProps {
  room: RoomPosition;
  layer: RenderLayer;
  /** Pre-computed session dot colors per agent (from DOM tree) */
  agentDotColors?: Map<string, number[]>;
  onRoomClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string, screenX: number, screenY: number) => void;
}

/** Draw a single workstation (desk + monitor back + keyboard) */
function drawWorkstation(
  g: import("pixi.js").Graphics,
  baseX: number,
  baseY: number,
) {
  const dw = 40,
    dh = 12;
  const frontY = -DPY;

  // Desk top surface (parallelogram)
  g.moveTo(baseX, baseY + frontY);
  g.lineTo(baseX + DPX, baseY + frontY + DPY);
  g.lineTo(baseX + dw + DPX, baseY + frontY + DPY);
  g.lineTo(baseX + dw, baseY + frontY);
  g.closePath();
  g.fill({ color: DESK_TOP });
  g.stroke({ color: 0x7a5030, width: 0.5 });

  // Desk front face
  g.moveTo(baseX, baseY + frontY);
  g.lineTo(baseX + dw, baseY + frontY);
  g.lineTo(baseX + dw, baseY + frontY + dh);
  g.lineTo(baseX, baseY + frontY + dh);
  g.closePath();
  g.fill({ color: DESK_FRONT, alpha: 0.9 });

  // Desk side face (right)
  g.moveTo(baseX + dw, baseY + frontY);
  g.lineTo(baseX + dw + DPX, baseY + frontY + DPY);
  g.lineTo(baseX + dw + DPX, baseY + frontY + DPY + dh);
  g.lineTo(baseX + dw, baseY + frontY + dh);
  g.closePath();
  g.fill({ color: DESK_SIDE, alpha: 0.9 });

  // Desk legs
  g.rect(baseX + 2, baseY + frontY, 3, dh);
  g.fill({ color: DESK_SIDE });
  g.rect(baseX + dw - 5, baseY + frontY, 3, dh);
  g.fill({ color: DESK_SIDE });

  // Monitor (back view)
  const mw = 18,
    mh = 14;
  const mx = baseX + dw / 2 - mw / 2 + DPX / 2;
  const my = baseY + frontY + DPY / 2 - mh;

  g.rect(mx + mw / 2 - 1.5, my + mh, 3, 4);
  g.fill({ color: MONITOR_BEZEL });
  g.roundRect(mx + mw / 2 - 5, my + mh + 3, 10, 3, 1);
  g.fill({ color: MONITOR_BEZEL });
  g.roundRect(mx - 1, my - 1, mw + 2, mh + 2, 1.5);
  g.fill({ color: 0x333333 });
  g.stroke({ color: 0x444444, width: 0.5 });
  g.roundRect(mx + mw / 2 - 5, my + mh / 2 - 3, 10, 6, 1);
  g.fill({ color: 0x3a3a3a });
  for (let s = 0; s < 3; s++) {
    g.rect(mx + 3 + s * 5, my + 2, 3, 1);
    g.fill({ color: 0x2a2a2a });
  }

  // Keyboard
  const kw = 16,
    kh = 6;
  const kx = baseX + dw / 2 - kw / 2 + DPX / 4;
  const ky = baseY + frontY + DPY / 4 - kh;
  g.roundRect(kx, ky, kw, kh, 1);
  g.fill({ color: KEYBOARD_COLOR, alpha: 0.8 });
  g.stroke({ color: 0x444444, width: 0.5 });
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      g.rect(kx + 2 + c * 3.5, ky + 1.5 + r * 2.5, 2, 1.2);
      g.fill({ color: 0x555555, alpha: 0.6 });
    }
  }
}

function OfficeRoom({
  room,
  layer,
  agentDotColors,
  onRoomClick,
  onDuckClick,
}: OfficeRoomProps) {
  const workstations = useMemo(
    () => getWorkstationPositions(room.agents.length),
    [room.agents.length],
  );

  const drawFloor = useCallback((g: import("pixi.js").Graphics) => {
    g.clear();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.lineTo(0, TILE_H / 2);
    g.closePath();
    g.fill({ color: FLOOR_COLOR, alpha: 0.9 });
    g.stroke({ color: FLOOR_STROKE, width: 1.5 });
  }, []);

  const drawWalls = useCallback((g: import("pixi.js").Graphics) => {
    g.clear();
    // Left wall
    g.moveTo(0, TILE_H / 2);
    g.lineTo(TILE_W / 2, 0);
    g.lineTo(TILE_W / 2, -WALL_H);
    g.lineTo(0, TILE_H / 2 - WALL_H);
    g.closePath();
    g.fill({ color: WALL_LEFT, alpha: 0.85 });
    g.stroke({ color: FLOOR_STROKE, width: 1 });
    // Right wall
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W, TILE_H / 2 - WALL_H);
    g.lineTo(TILE_W / 2, -WALL_H);
    g.closePath();
    g.fill({ color: WALL_RIGHT, alpha: 0.7 });
    g.stroke({ color: FLOOR_STROKE, width: 1 });
  }, []);

  const drawAllDesks = useCallback(
    (g: import("pixi.js").Graphics) => {
      g.clear();
      for (const ws of workstations) {
        drawWorkstation(g, ws.deskX, ws.deskY);
      }
    },
    [workstations],
  );

  // Diamond mask for desks layer — room boundary (floor + walls)
  const drawRoomMask = useCallback((g: import("pixi.js").Graphics) => {
    g.clear();
    g.moveTo(0, TILE_H / 2);
    g.lineTo(0, TILE_H / 2 - WALL_H);
    g.lineTo(TILE_W / 2, -WALL_H);
    g.lineTo(TILE_W, TILE_H / 2 - WALL_H);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.closePath();
    g.fill({ color: 0xffffff });
  }, []);

  // Brain: fix-office-view-snaps-back-to-chat
  // Guard against stale PixiJS click events. PixiJS v8 EventBoundary.mapPointerUp
  // does NOT clear pressTargetsByButton after a normal click (only for pointerupoutside).
  // Since pointerup is listened on globalThis, ANY pointerup anywhere on the page
  // can trigger a stale click on the room. This flag ensures onRoomClick only fires
  // when a genuine pointerdown was received on THIS canvas container first.
  const pointerDownOnRoom = useRef(false);

  // Mask ref for desks layer (hooks must be unconditional)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deskContainerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deskMaskRef = useRef<any>(null);

  useEffect(() => {
    if (layer !== "desks") return;
    const container = deskContainerRef.current;
    const mask = deskMaskRef.current;
    if (container && mask) {
      container.mask = mask;
    }
    return () => {
      if (container) container.mask = null;
    };
  }, [layer]);

  // Layer 'base': walls, floor
  if (layer === "base") {
    return (
      <pixiContainer
        x={room.screenX}
        y={room.screenY}
        eventMode="static"
        cursor="pointer"
        onPointerDown={() => { pointerDownOnRoom.current = true; }}
        onClick={() => {
          if (pointerDownOnRoom.current) {
            onRoomClick?.(room.projectPath);
          }
          pointerDownOnRoom.current = false;
        }}
      >
        <pixiGraphics draw={drawWalls} />
        <pixiGraphics draw={drawFloor} />
      </pixiContainer>
    );
  }

  // Layer 'ducks': avatars only (no mask — never clipped)
  if (layer === "ducks") {
    return (
      <pixiContainer x={room.screenX} y={room.screenY}>
        {room.agents.map((agent, i) => {
          const ws = workstations[i];
          if (!ws) return null;
          return (
            <OfficeDuck
              key={agent.id}
              agent={agent}
              localX={ws.duckX}
              localY={ws.duckY}
              dotColors={agentDotColors?.get(agent.id) ?? []}
              onClick={onDuckClick}
            />
          );
        })}
      </pixiContainer>
    );
  }

  // Layer 'desks': workstations with diamond mask (clipped to room boundary)
  // eventMode="none" so clicks pass through to the duck layer below
  return (
    <pixiContainer
      ref={deskContainerRef}
      x={room.screenX}
      y={room.screenY}
      eventMode="none"
    >
      <pixiGraphics ref={deskMaskRef} draw={drawRoomMask} />
      <pixiGraphics draw={drawAllDesks} />
    </pixiContainer>
  );
}

export default memo(OfficeRoom);
