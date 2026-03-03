import type { TerminalInfo } from '../../types';

export const TILE_W = 280;
export const TILE_H = 140;
export const ROOM_COLS = 4;
export const DESK_OFFSET_X = 80;
export const DESK_OFFSET_Y = 40;

export interface RoomPosition {
  projectPath: string;
  projectName: string;
  col: number;
  row: number;
  screenX: number;
  screenY: number;
  agents: TerminalInfo[];
}

/** Converte coordinate griglia in coordinate isometriche (diamante) */
export function gridToIso(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

/** Estrae il nome progetto dal path assoluto */
function extractProjectName(projectPath: string): string {
  const segments = projectPath.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'unknown';
}

/** Raggruppa terminali per progetto e calcola posizioni isometriche */
export function computeRoomPositions(
  terminals: TerminalInfo[]
): RoomPosition[] {
  const projectMap = new Map<string, TerminalInfo[]>();

  for (const t of terminals) {
    const key = t.cwd || 'unknown';
    if (!projectMap.has(key)) projectMap.set(key, []);
    projectMap.get(key)!.push(t);
  }

  const rooms: RoomPosition[] = [];
  let index = 0;

  for (const [projectPath, agents] of projectMap) {
    const col = index % ROOM_COLS;
    const row = Math.floor(index / ROOM_COLS);
    const { x, y } = gridToIso(col, row);
    rooms.push({
      projectPath,
      projectName: extractProjectName(projectPath),
      col,
      row,
      screenX: x,
      screenY: y,
      agents,
    });
    index++;
  }

  return rooms;
}

/** Calcola posizione locale di un duck dentro una stanza */
export function getDuckLocalPosition(
  localIndex: number,
  totalDucks: number
): { x: number; y: number } {
  const spacing = Math.min(50, (TILE_W - 80) / Math.max(totalDucks, 1));
  return {
    x: DESK_OFFSET_X + localIndex * spacing,
    y: DESK_OFFSET_Y + (localIndex % 2) * 15,
  };
}
