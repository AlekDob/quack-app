import { CARD_DEFAULT_W, CARD_DEFAULT_H, ZONE_MIN_W, ZONE_MIN_H, ZONE_PADDING, DEFAULT_TAGS } from './officeConstants';
import type { OfficeRoomCard, OfficeZone } from './officeTypes';

const ZONE_LABEL_H = 24;
const ZONE_GUTTER = 40;
const CARD_GAP = 12;

export function inferTagFromPath(cwd: string): string {
  const lower = cwd.toLowerCase();
  if (lower.includes('/desktop/dev/personal/')) return 'personal';
  if (lower.includes('/desktop/dev/')) return 'cc';
  return 'other';
}

export function packRoomsInZone(zone: OfficeZone, rooms: OfficeRoomCard[]): OfficeRoomCard[] {
  const startX = zone.x + ZONE_PADDING;
  const startY = zone.y + ZONE_PADDING + ZONE_LABEL_H;
  const innerW = zone.w - ZONE_PADDING * 2;
  const cardW = CARD_DEFAULT_W;
  const cardH = CARD_DEFAULT_H;
  const cols = Math.max(1, Math.floor((innerW + CARD_GAP) / (cardW + CARD_GAP)));

  return rooms.map((room, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      ...room,
      x: startX + col * (cardW + CARD_GAP),
      y: startY + row * (cardH + CARD_GAP),
      zoneId: zone.id,
    };
  });
}

export function defaultZonePositions(tagIds: string[]): OfficeZone[] {
  const palette = new Map(DEFAULT_TAGS.map(t => [t.id, t]));
  let cursorX = 0;
  return tagIds.map((tagId) => {
    const meta = palette.get(tagId) ?? { id: tagId, label: tagId, color: '#94a3b8' };
    const zone: OfficeZone = {
      id: `zone-${tagId}`,
      label: `${meta.label.toUpperCase()} WING`,
      color: meta.color,
      tagId,
      x: cursorX,
      y: 0,
      w: ZONE_MIN_W + CARD_DEFAULT_W, // fits two rooms wide
      h: ZONE_MIN_H,
    };
    cursorX += zone.w + ZONE_GUTTER;
    return zone;
  });
}

export function sessionDotColor(flags: { awaiting: boolean; working: boolean; ready: boolean }): string {
  if (flags.awaiting) return '#a855f7';
  if (flags.working) return '#f59e0b';
  if (flags.ready) return '#22c55e';
  return '#6b7280';
}
