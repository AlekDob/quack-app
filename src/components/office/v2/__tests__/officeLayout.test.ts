import { describe, it, expect } from 'vitest';
import {
  inferTagFromPath,
  packRoomsInZone,
  defaultZonePositions,
  sessionDotColor,
} from '../officeLayout';
import type { OfficeRoomCard } from '../officeTypes';

describe('inferTagFromPath', () => {
  it('returns "personal" for Desktop/Dev/Personal subtrees', () => {
    expect(inferTagFromPath('/Users/alek/Desktop/Dev/Personal/quack-app')).toBe('personal');
  });

  it('returns "cc" for Desktop/Dev paths outside Personal', () => {
    expect(inferTagFromPath('/Users/alek/Desktop/Dev/flow-app')).toBe('cc');
  });

  it('returns "other" for unrelated paths', () => {
    expect(inferTagFromPath('/tmp/unrelated')).toBe('other');
  });

  it('is case-insensitive on segment match', () => {
    expect(inferTagFromPath('/users/alek/desktop/dev/personal/foo')).toBe('personal');
  });
});

describe('packRoomsInZone', () => {
  it('lays out rooms in a grid inside the zone bounds', () => {
    const rooms: OfficeRoomCard[] = [
      { projectPath: 'a', x: 0, y: 0, tagIds: [] },
      { projectPath: 'b', x: 0, y: 0, tagIds: [] },
      { projectPath: 'c', x: 0, y: 0, tagIds: [] },
    ];
    const packed = packRoomsInZone({ id: 'z', label: 'Z', color: '#000', x: 100, y: 200, w: 800, h: 400 }, rooms);
    expect(packed).toHaveLength(3);
    // first card sits at zone origin + padding
    expect(packed[0].x).toBe(100 + 16);
    expect(packed[0].y).toBe(200 + 16 + 24); // padding + zone label height
    // second card to the right of first
    expect(packed[1].x).toBeGreaterThan(packed[0].x);
    expect(packed[1].y).toBe(packed[0].y);
  });

  it('wraps to a new row when the zone width is exceeded', () => {
    const zone = { id: 'z', label: 'Z', color: '#000', x: 0, y: 0, w: 280, h: 400 };
    const rooms: OfficeRoomCard[] = [
      { projectPath: 'a', x: 0, y: 0, tagIds: [] },
      { projectPath: 'b', x: 0, y: 0, tagIds: [] },
    ];
    const packed = packRoomsInZone(zone, rooms);
    expect(packed[0].y).toBeLessThan(packed[1].y);
  });
});

describe('defaultZonePositions', () => {
  it('lays out N zones in a horizontal strip', () => {
    const zones = defaultZonePositions(['personal', 'cc', 'consulting']);
    expect(zones).toHaveLength(3);
    expect(zones[0].x).toBe(0);
    expect(zones[0].y).toBe(0);
    expect(zones[1].x).toBeGreaterThan(zones[0].x + zones[0].w); // 40px gutter
  });
});

describe('sessionDotColor', () => {
  it('returns purple hex for awaiting priority', () => {
    expect(sessionDotColor({ awaiting: true, working: false, ready: false })).toBe('#a855f7');
  });

  it('returns yellow for working when not awaiting', () => {
    expect(sessionDotColor({ awaiting: false, working: true, ready: false })).toBe('#f59e0b');
  });

  it('returns green for ready', () => {
    expect(sessionDotColor({ awaiting: false, working: false, ready: true })).toBe('#22c55e');
  });

  it('returns gray fallback', () => {
    expect(sessionDotColor({ awaiting: false, working: false, ready: false })).toBe('#6b7280');
  });
});
