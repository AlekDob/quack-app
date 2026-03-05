import { useCallback, memo } from "react";
import { TILE_W, TILE_H } from "./officeLayout";
import type { BreakRoomPosition } from "./officeLayout";

const WALL_H = 50;

// Warm color palette for break room
const FLOOR_COLOR = 0x2a1f1a;
const FLOOR_STROKE = 0x4a3a2a;
const WALL_LEFT = 0x1a3a3a;
const WALL_RIGHT = 0x163333;

// Furniture colors
const SOFA_TOP = 0x9c2d5e;
const SOFA_FRONT = 0x7a1e48;
const SOFA_SIDE = 0x6b1a3e;
const SOFA_BACK_TOP = 0x8b2252;
const SOFA_BACK_FRONT = 0x6b1a3e;

const TV_FRAME = 0x1a1a1a;
const TV_SCREEN = 0x1e3a5c;
const TV_GLOW = 0x2a5080;

const VENDING_TOP = 0x4a4a5a;
const VENDING_FRONT = 0x3a3a4a;
const VENDING_SIDE = 0x2e2e3e;
const VENDING_DISPLAY = 0x00cc88;

// Isometric unit vectors (2:1 ratio diamond)
// East axis: runs top→right along right wall edge
const EX = 2;
const EY = 1;
// South axis: runs top→left along left wall edge
const SX = -2;
const SY = 1;

type G = import("pixi.js").Graphics;

/** Project a point from iso (east, south) to screen, offset by (ox, oy) */
function iso(ox: number, oy: number, e: number, s: number): [number, number] {
  return [ox + e * EX + s * SX, oy + e * EY + s * SY];
}

/** Draw a filled isometric parallelogram (top face) */
function isoQuad(
  g: G,
  ox: number,
  oy: number,
  eLen: number,
  sLen: number,
  color: number,
  alpha = 1,
) {
  const [x0, y0] = iso(ox, oy, 0, 0);
  const [x1, y1] = iso(ox, oy, eLen, 0);
  const [x2, y2] = iso(ox, oy, eLen, sLen);
  const [x3, y3] = iso(ox, oy, 0, sLen);
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.lineTo(x2, y2);
  g.lineTo(x3, y3);
  g.closePath();
  g.fill({ color, alpha });
}

/** Draw a full isometric box: top + south-facing front + east-facing side */
function isoBox(
  g: G,
  ox: number,
  oy: number,
  eLen: number,
  sLen: number,
  h: number,
  topColor: number,
  frontColor: number,
  sideColor: number,
) {
  // Compute all 4 top-face corners
  const [t0x, t0y] = iso(ox, oy, 0, 0);
  const [t1x, t1y] = iso(ox, oy, eLen, 0);
  const [t2x, t2y] = iso(ox, oy, eLen, sLen);
  const [t3x, t3y] = iso(ox, oy, 0, sLen);

  // Front face (south-facing: t3→t2 edge, extends down by h)
  g.moveTo(t3x, t3y);
  g.lineTo(t2x, t2y);
  g.lineTo(t2x, t2y + h);
  g.lineTo(t3x, t3y + h);
  g.closePath();
  g.fill({ color: frontColor });

  // Side face (east-facing: t1→t2 edge, extends down by h)
  g.moveTo(t1x, t1y);
  g.lineTo(t2x, t2y);
  g.lineTo(t2x, t2y + h);
  g.lineTo(t1x, t1y + h);
  g.closePath();
  g.fill({ color: sideColor });

  // Top face (drawn last so it's on top)
  g.moveTo(t0x, t0y);
  g.lineTo(t1x, t1y);
  g.lineTo(t2x, t2y);
  g.lineTo(t3x, t3y);
  g.closePath();
  g.fill({ color: topColor });
}

type BreakRoomLayer = "base" | "furniture";

interface OfficeBreakRoomProps {
  position: BreakRoomPosition;
  layer: BreakRoomLayer;
}

/**
 * Draw an isometric sofa oriented along the east axis.
 * (ox, oy) = screen origin of the sofa's back-left corner.
 * eLen = length along east axis (seat width).
 * If `faceSouth` is true, the backrest is on the north side (facing south).
 */
function drawSofa(
  g: G,
  ox: number,
  oy: number,
  eLen: number,
  faceSouth: boolean,
) {
  const depth = 12; // south-axis depth of seat
  const seatH = 6;
  const backD = 4; // backrest depth (south axis)
  const backH = 12; // backrest height

  if (faceSouth) {
    // Backrest on the north side (behind the seat)
    isoBox(
      g,
      ox,
      oy - backH,
      eLen,
      backD,
      backH,
      SOFA_BACK_TOP,
      SOFA_BACK_FRONT,
      SOFA_SIDE,
    );
    // Seat cushion in front of backrest
    const [, shiftY] = iso(0, 0, 0, backD);
    isoBox(
      g,
      ox + backD * SX,
      oy - seatH + shiftY,
      eLen,
      depth,
      seatH,
      SOFA_TOP,
      SOFA_FRONT,
      SOFA_SIDE,
    );
    // Cushion stitch lines on top face
    const cushions = 3;
    const step = eLen / cushions;
    for (let i = 1; i < cushions; i++) {
      const [lx, ly] = iso(ox + backD * SX, oy - seatH + shiftY, step * i, 0);
      const [lx2, ly2] = iso(
        ox + backD * SX,
        oy - seatH + shiftY,
        step * i,
        depth,
      );
      g.moveTo(lx, ly);
      g.lineTo(lx2, ly2);
      g.stroke({ color: SOFA_FRONT, width: 0.7 });
    }
  } else {
    // Backrest on the south side (facing north) — seat first, then backrest behind
    isoBox(
      g,
      ox,
      oy - seatH,
      eLen,
      depth,
      seatH,
      SOFA_TOP,
      SOFA_FRONT,
      SOFA_SIDE,
    );
    // Backrest behind the seat (further south)
    const [bx, by] = iso(ox, oy, 0, depth);
    isoBox(
      g,
      bx,
      by - backH,
      eLen,
      backD,
      backH,
      SOFA_BACK_TOP,
      SOFA_BACK_FRONT,
      SOFA_SIDE,
    );
    // Cushion lines
    const cushions = 3;
    const step = eLen / cushions;
    for (let i = 1; i < cushions; i++) {
      const [lx, ly] = iso(ox, oy - seatH, step * i, 0);
      const [lx2, ly2] = iso(ox, oy - seatH, step * i, depth);
      g.moveTo(lx, ly);
      g.lineTo(lx2, ly2);
      g.stroke({ color: SOFA_FRONT, width: 0.7 });
    }
  }
}

/**
 * Draw a wall-mounted TV as a thin isometric panel.
 * Oriented along the east axis (flat against the left wall).
 */
function drawTV(g: G, ox: number, oy: number) {
  const tw = 22; // east-axis width
  const depth = 2; // south-axis depth (thin panel)
  const screenH = 18;
  const standH = 5;

  // Stand: small box below TV
  const standE = 4;
  const standOx = ox + (tw - standE) * EX;
  const standOy = oy + (tw - standE) * EY;
  isoBox(
    g,
    standOx,
    standOy,
    standE,
    depth + 2,
    standH,
    0x333333,
    0x2a2a2a,
    0x222222,
  );

  // Frame: slightly larger than screen
  isoBox(
    g,
    ox,
    oy - screenH - standH,
    tw,
    depth + 1,
    screenH + 2,
    TV_FRAME,
    TV_FRAME,
    0x111111,
  );

  // Screen surface (top face used as the visible screen — it's the "front" in iso)
  // We draw the screen as a quad on the south-facing front of the TV box
  const [s0x, s0y] = iso(
    ox + 1 * EX,
    oy - screenH - standH + 1 * EY + 2,
    0,
    depth + 1,
  );
  const [s1x, s1y] = iso(
    ox + 1 * EX,
    oy - screenH - standH + 1 * EY + 2,
    tw - 2,
    depth + 1,
  );
  g.moveTo(s0x, s0y);
  g.lineTo(s1x, s1y);
  g.lineTo(s1x, s1y + screenH - 2);
  g.lineTo(s0x, s0y + screenH - 2);
  g.closePath();
  g.fill({ color: TV_SCREEN });

  // Screen glow band
  g.moveTo(s0x + 2, s0y + 2);
  g.lineTo(s1x - 2, s1y + 2);
  g.lineTo(s1x - 2, s1y + 6);
  g.lineTo(s0x + 2, s0y + 6);
  g.closePath();
  g.fill({ color: TV_GLOW, alpha: 0.3 });

  // Power LED
  g.circle(s1x - 3, s1y + screenH - 5, 1.5);
  g.fill({ color: 0x00ff66, alpha: 0.8 });
}

/**
 * Draw a vending machine as a tall isometric box.
 * (ox, oy) = screen origin of the top-back corner.
 */
function drawVendingMachine(g: G, ox: number, oy: number) {
  const eLen = 10; // east width
  const sLen = 8; // south depth
  const h = 40; // height

  // Main body
  isoBox(
    g,
    ox,
    oy - h,
    eLen,
    sLen,
    h,
    VENDING_TOP,
    VENDING_FRONT,
    VENDING_SIDE,
  );

  // Product display window on front face (south-facing)
  const [f0x, f0y] = iso(ox, oy, 0, sLen);
  const [f1x, f1y] = iso(ox, oy, eLen, sLen);
  // Display area: a rectangle on the front face
  const dispTop = f0y - h + 6;
  const dispBot = f0y - h + 22;
  g.moveTo(f0x + 2, dispTop);
  g.lineTo(f1x + 2, dispTop + (f1y - f0y));
  g.lineTo(f1x + 2, dispBot + (f1y - f0y));
  g.lineTo(f0x + 2, dispBot);
  g.closePath();
  g.fill({ color: 0x222233 });

  // Product dots in the display
  const colors = [0xff6b35, 0x00d9ff, 0xf7931e, 0x00cc88];
  const slope = (f1y - f0y) / (f1x - f0x);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const cx = f0x + 5 + col * 8;
      const cy = dispTop + 4 + row * 5 + (cx - f0x) * slope;
      g.circle(cx, cy, 2);
      g.fill({ color: colors[(row + col) % colors.length], alpha: 0.9 });
    }
  }

  // Green display screen
  const screenTop = dispBot + 4;
  g.moveTo(f0x + 3, screenTop);
  g.lineTo(f1x - 1, screenTop + (f1y - f0y));
  g.lineTo(f1x - 1, screenTop + 5 + (f1y - f0y));
  g.lineTo(f0x + 3, screenTop + 5);
  g.closePath();
  g.fill({ color: 0x001a0a });
  g.moveTo(f0x + 4, screenTop + 1);
  g.lineTo(f1x - 2, screenTop + 1 + (f1y - f0y));
  g.lineTo(f1x - 2, screenTop + 4 + (f1y - f0y));
  g.lineTo(f0x + 4, screenTop + 4);
  g.closePath();
  g.fill({ color: VENDING_DISPLAY, alpha: 0.7 });

  // Pickup slot at bottom
  const slotTop = f0y - 10;
  g.moveTo(f0x + 3, slotTop);
  g.lineTo(f1x - 1, slotTop + (f1y - f0y));
  g.lineTo(f1x - 1, slotTop + 7 + (f1y - f0y));
  g.lineTo(f0x + 3, slotTop + 7);
  g.closePath();
  g.fill({ color: 0x1a1a1a });
}

function OfficeBreakRoom({ position, layer }: OfficeBreakRoomProps) {
  const drawFloor = useCallback((g: G) => {
    g.clear();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.lineTo(0, TILE_H / 2);
    g.closePath();
    g.fill({ color: FLOOR_COLOR, alpha: 0.9 });
    g.stroke({ color: FLOOR_STROKE, width: 1.5 });
  }, []);

  const drawWalls = useCallback((g: G) => {
    g.clear();
    // Left wall (teal)
    g.moveTo(0, TILE_H / 2);
    g.lineTo(TILE_W / 2, 0);
    g.lineTo(TILE_W / 2, -WALL_H);
    g.lineTo(0, TILE_H / 2 - WALL_H);
    g.closePath();
    g.fill({ color: WALL_LEFT, alpha: 0.85 });
    g.stroke({ color: FLOOR_STROKE, width: 1 });
    // Right wall (darker teal)
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W, TILE_H / 2 - WALL_H);
    g.lineTo(TILE_W / 2, -WALL_H);
    g.closePath();
    g.fill({ color: WALL_RIGHT, alpha: 0.7 });
    g.stroke({ color: FLOOR_STROKE, width: 1 });
  }, []);

  const drawFurniture = useCallback((g: G) => {
    g.clear();

    // Sofa 1: facing north toward TV (backrest on south)
    drawSofa(g, TILE_W * 0.18, TILE_H * 0.42, 28, false);

    // Sofa 2: same orientation, offset along iso diagonal
    drawSofa(g, TILE_W * 0.38, TILE_H * 0.58, 28, false);

    // TV centered on back wall (junction of left+right walls)
    drawTV(g, TILE_W * 0.48, TILE_H * 0.32);

    // Vending machine in right corner of diamond
    drawVendingMachine(g, TILE_W * 0.82, TILE_H * 0.38);
  }, []);

  if (layer === "base") {
    return (
      <pixiContainer x={position.screenX} y={position.screenY}>
        <pixiGraphics draw={drawWalls} />
        <pixiGraphics draw={drawFloor} />
      </pixiContainer>
    );
  }

  // Layer 'furniture'
  return (
    <pixiContainer x={position.screenX} y={position.screenY}>
      <pixiGraphics draw={drawFurniture} />
    </pixiContainer>
  );
}

export default memo(OfficeBreakRoom);
