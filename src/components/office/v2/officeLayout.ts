import {
  CARD_DEFAULT_W,
  CARD_DEFAULT_H,
  GRID_COLS,
  GRID_GAP,
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
} from './officeConstants';
import type { OfficeRoomCard } from './officeTypes';

export function inferTagFromPath(cwd: string): string {
  const lower = cwd.toLowerCase();
  if (lower.includes('/desktop/dev/personal/')) return 'personal';
  if (lower.includes('/desktop/dev/')) return 'cc';
  return 'other';
}

export function packRoomsInGrid(rooms: OfficeRoomCard[]): OfficeRoomCard[] {
  const cardW = CARD_DEFAULT_W;
  const cardH = CARD_DEFAULT_H;
  return rooms.map((room, idx) => {
    const col = idx % GRID_COLS;
    const row = Math.floor(idx / GRID_COLS);
    return {
      ...room,
      x: GRID_ORIGIN_X + col * (cardW + GRID_GAP),
      y: GRID_ORIGIN_Y + row * (cardH + GRID_GAP),
    };
  });
}

export function projectNameFromPath(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

export function sessionDotColor(flags: { awaiting: boolean; working: boolean; ready: boolean }): string {
  if (flags.awaiting) return '#a855f7';
  if (flags.working) return '#f59e0b';
  if (flags.ready) return '#22c55e';
  return '#6b7280';
}
