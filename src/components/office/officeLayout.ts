import type { TerminalInfo } from '../../types';

// Uniform tile dimensions (2:1 ratio for isometric).
// All rooms share the same size → diamonds perfectly adjacent.
export const TILE_W = 450;
export const TILE_H = 225;

export interface WorkstationPos {
  deskX: number;
  deskY: number;
  duckX: number;
  duckY: number;
}

export interface RoomPosition {
  projectPath: string;
  projectName: string;
  col: number;
  row: number;
  screenX: number;
  screenY: number;
  agents: TerminalInfo[];
}

/** Convert grid (col, row) to isometric screen coordinates */
export function gridToIso(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

function extractProjectName(projectPath: string): string {
  const segments = projectPath.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'unknown';
}

/**
 * Compact rectangular grid: rooms fill row-major in a growing rectangle.
 * 1→(0,0)  2→+(1,0)  3→+(0,1)  4→+(1,1)  5→+(2,0) etc.
 * Width grows first, then height, keeping rooms tightly packed.
 */
function getCompactSeats(count: number): Array<{ col: number; row: number }> {
  if (count <= 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const seats: Array<{ col: number; row: number }> = [];
  for (let i = 0; i < count; i++) {
    seats.push({ col: i % cols, row: Math.floor(i / cols) });
  }
  return seats;
}

/** Group terminals by project and assign compact grid positions */
export function computeRoomPositions(terminals: TerminalInfo[]): RoomPosition[] {
  const projectMap = new Map<string, TerminalInfo[]>();
  for (const t of terminals) {
    const key = t.cwd || 'unknown';
    if (!projectMap.has(key)) projectMap.set(key, []);
    projectMap.get(key)!.push(t);
  }

  const seats = getCompactSeats(projectMap.size);
  const rooms: RoomPosition[] = [];
  let index = 0;

  for (const [projectPath, agents] of projectMap) {
    const seat = seats[index];
    const { x, y } = gridToIso(seat.col, seat.row);
    rooms.push({
      projectPath,
      projectName: extractProjectName(projectPath),
      col: seat.col,
      row: seat.row,
      screenX: x,
      screenY: y,
      agents,
    });
    index++;
  }

  return rooms;
}

/**
 * Compute workstation positions for each agent inside a room.
 * Each agent gets: desk + avatar behind it.
 * All positions relative to room origin (0,0), within the fixed TILE_W×TILE_H.
 */
export function getWorkstationPositions(agentCount: number): WorkstationPos[] {
  if (agentCount === 0) return [];

  const deskW = 40;
  const duckBehindDesk = -30; // duck Y offset behind desk

  // Usable floor area (inset from diamond edges)
  const marginX = TILE_W * 0.15;
  const marginY = TILE_H * 0.2;
  const floorW = TILE_W - marginX * 2;
  const floorH = TILE_H - marginY * 2;

  const positions: WorkstationPos[] = [];

  if (agentCount === 1) {
    const dx = marginX + floorW * 0.5 - deskW / 2;
    const dy = marginY + floorH * 0.5;
    positions.push({
      deskX: dx, deskY: dy,
      duckX: dx + deskW / 2 - 15, duckY: dy + duckBehindDesk,
    });
  } else if (agentCount === 2) {
    const spots = [
      { fx: 0.3, fy: 0.35 },
      { fx: 0.65, fy: 0.6 },
    ];
    for (const s of spots) {
      const dx = marginX + floorW * s.fx - deskW / 2;
      const dy = marginY + floorH * s.fy;
      positions.push({
        deskX: dx, deskY: dy,
        duckX: dx + deskW / 2 - 15, duckY: dy + duckBehindDesk,
      });
    }
  } else {
    // 3+ agents: distribute in rows within the diamond
    const cols = Math.min(agentCount, 3);
    const rows = Math.ceil(agentCount / cols);

    for (let i = 0; i < agentCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const colsInRow = Math.min(agentCount - row * cols, cols);

      const rowSpacing = floorH / (rows + 1);
      const colSpacing = floorW / (colsInRow + 1);
      // Stagger odd rows for isometric feel
      const stagger = row % 2 === 1 ? colSpacing * 0.3 : 0;

      const dx = marginX + colSpacing * (col + 1) + stagger - deskW / 2;
      const dy = marginY + rowSpacing * (row + 1);
      positions.push({
        deskX: dx, deskY: dy,
        duckX: dx + deskW / 2 - 15, duckY: dy + duckBehindDesk,
      });
    }
  }

  return positions;
}

export interface BreakRoomPosition {
  col: number;
  row: number;
  screenX: number;
  screenY: number;
}

/** Place the break room at the next available grid slot after project rooms */
export function computeBreakRoomPosition(projectCount: number): BreakRoomPosition {
  const cols = Math.max(1, Math.ceil(Math.sqrt(projectCount)));
  const nextIndex = projectCount;
  const col = nextIndex % cols;
  const row = Math.floor(nextIndex / cols);
  const { x, y } = gridToIso(col, row);
  return { col, row, screenX: x, screenY: y };
}
