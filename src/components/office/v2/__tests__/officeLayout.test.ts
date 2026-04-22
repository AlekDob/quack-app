import { describe, it, expect } from 'vitest';
import {
  inferTagFromPath,
  packRoomsInGrid,
  projectNameFromPath,
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

describe('packRoomsInGrid', () => {
  it('lays out rooms in a 4-column grid', () => {
    const rooms: OfficeRoomCard[] = Array.from({ length: 5 }, (_, i) => ({
      projectPath: `p${i}`,
      x: 0,
      y: 0,
      tagIds: [],
    }));
    const packed = packRoomsInGrid(rooms);
    expect(packed).toHaveLength(5);
    expect(packed[0].y).toBe(packed[3].y);      // same row
    expect(packed[4].y).toBeGreaterThan(packed[0].y); // wraps to next row
    expect(packed[1].x).toBeGreaterThan(packed[0].x); // columns progress right
  });
});

describe('projectNameFromPath', () => {
  it('returns the final segment', () => {
    expect(projectNameFromPath('/Users/alek/Desktop/Dev/Personal/quack-app')).toBe('quack-app');
  });

  it('handles trailing slash', () => {
    expect(projectNameFromPath('/home/user/proj/')).toBe('proj');
  });

  it('handles windows-like separators', () => {
    expect(projectNameFromPath('C:\\Users\\alek\\proj')).toBe('proj');
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
