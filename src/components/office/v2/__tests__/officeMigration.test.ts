import { describe, it, expect } from 'vitest';
import {
  bootstrapLayoutFromTerminals,
  reconcileLayoutWithTerminals,
  normaliseLayout,
} from '../officeMigration';
import type { TerminalInfo } from '../../../../types';

let agentCounter = 0;
const terminal = (cwd: string, id?: string): TerminalInfo => ({
  id: id ?? `agent-${++agentCounter}`,
  label: cwd.split('/').pop() ?? cwd,
  cwd,
  color: '#ff6b35',
  branch: 'main',
} as TerminalInfo);

describe('bootstrapLayoutFromTerminals', () => {
  it('creates a v2 layout with rooms in grid and empty annotations', () => {
    const terminals = [
      terminal('/Users/a/Desktop/Dev/Personal/quack-app'),
      terminal('/Users/a/Desktop/Dev/flow-app'),
    ];
    const layout = bootstrapLayoutFromTerminals(terminals);
    expect(layout.version).toBe(2);
    expect(layout.rooms).toHaveLength(2);
    expect(layout.customGroups).toEqual([]);
    expect(layout.postIts).toEqual([]);
    expect(layout.stickers).toEqual([]);
  });

  it('builds tags from inferred project tags', () => {
    const layout = bootstrapLayoutFromTerminals([
      terminal('/Users/a/Desktop/Dev/Personal/quack-app'),
      terminal('/Users/a/Desktop/Dev/flow-app'),
    ]);
    const tagIds = layout.tags.map(t => t.id).sort();
    expect(tagIds).toContain('personal');
    expect(tagIds).toContain('cc');
  });

  it('deduplicates N terminals on the same cwd into one room', () => {
    const cwd = '/Users/a/Desktop/Dev/Personal/quack-app';
    const terminals = [terminal(cwd, 'alex'), terminal(cwd, 'jack'), terminal(cwd, 'sophie')];
    const layout = bootstrapLayoutFromTerminals(terminals);
    expect(layout.rooms.filter(r => r.projectPath === cwd)).toHaveLength(1);
  });
});

describe('reconcileLayoutWithTerminals', () => {
  it('adds a RoomCard for a new terminal', () => {
    const existing = bootstrapLayoutFromTerminals([terminal('/Users/a/Desktop/Dev/Personal/quack-app')]);
    const withNew = reconcileLayoutWithTerminals(existing, [
      terminal('/Users/a/Desktop/Dev/Personal/quack-app'),
      terminal('/Users/a/Desktop/Dev/Personal/new-project'),
    ]);
    expect(withNew.rooms.map(r => r.projectPath)).toContain('/Users/a/Desktop/Dev/Personal/new-project');
  });

  it('preserves existing RoomCard positions (does not rewrite x/y)', () => {
    const existing = bootstrapLayoutFromTerminals([terminal('/Users/a/Desktop/Dev/Personal/quack-app')]);
    existing.rooms[0].x = 999;
    existing.rooms[0].y = 888;
    const same = reconcileLayoutWithTerminals(existing, [terminal('/Users/a/Desktop/Dev/Personal/quack-app')]);
    expect(same.rooms[0].x).toBe(999);
    expect(same.rooms[0].y).toBe(888);
  });

  it('keeps rooms whose terminal has disappeared (non-destructive)', () => {
    const existing = bootstrapLayoutFromTerminals([terminal('/Users/a/Desktop/Dev/Personal/quack-app')]);
    const empty = reconcileLayoutWithTerminals(existing, []);
    expect(empty.rooms).toHaveLength(1);
  });

  it('dedups multiple terminals on same cwd into a single new room', () => {
    const existing = bootstrapLayoutFromTerminals([terminal('/Users/a/Desktop/Dev/Personal/quack-app')]);
    const cwd = '/Users/a/Desktop/Dev/Personal/new-project';
    const merged = reconcileLayoutWithTerminals(existing, [
      terminal('/Users/a/Desktop/Dev/Personal/quack-app'),
      terminal(cwd, 'alex'),
      terminal(cwd, 'jack'),
      terminal(cwd, 'sophie'),
    ]);
    expect(merged.rooms.filter(r => r.projectPath === cwd)).toHaveLength(1);
  });

  it('retroactively dedups a persisted layout with duplicate rooms', () => {
    const existing = bootstrapLayoutFromTerminals([terminal('/Users/a/Desktop/Dev/Personal/quack-app')]);
    existing.rooms = [
      { ...existing.rooms[0] },
      { ...existing.rooms[0], x: 100 },
      { ...existing.rooms[0], x: 200 },
    ];
    const reconciled = reconcileLayoutWithTerminals(existing, [
      terminal('/Users/a/Desktop/Dev/Personal/quack-app'),
    ]);
    expect(reconciled.rooms).toHaveLength(1);
  });
});

describe('normaliseLayout', () => {
  it('returns null for non-object input', () => {
    expect(normaliseLayout(null)).toBeNull();
    expect(normaliseLayout('string')).toBeNull();
    expect(normaliseLayout(42)).toBeNull();
  });

  it('returns null for missing/invalid version', () => {
    expect(normaliseLayout({ version: 0 })).toBeNull();
    expect(normaliseLayout({})).toBeNull();
  });

  it('migrates a v1 payload by dropping zones and breakRoom, normalising to v2', () => {
    const v1 = {
      version: 1,
      rooms: [
        { projectPath: '/a', x: 10, y: 20, tagIds: ['personal'], zoneId: 'zone-personal' },
      ],
      zones: [{ id: 'zone-personal', label: 'PERSONAL', color: '#f0f', x: 0, y: 0, w: 100, h: 100, tagId: 'personal' }],
      tags: [{ id: 'personal', label: 'Personal', color: '#c084fc', source: 'auto' }],
      activeTagIds: [],
      breakRoom: { x: 500, y: 0 },
    };
    const out = normaliseLayout(v1);
    expect(out).not.toBeNull();
    expect(out!.version).toBe(2);
    expect(out!.rooms).toHaveLength(1);
    expect(out!.rooms[0].x).toBe(10);
    expect((out as unknown as Record<string, unknown>).zones).toBeUndefined();
    expect((out as unknown as Record<string, unknown>).breakRoom).toBeUndefined();
    expect(out!.customGroups).toEqual([]);
    expect(out!.postIts).toEqual([]);
    expect(out!.stickers).toEqual([]);
  });

  it('passes a v2 payload through untouched', () => {
    const v2 = {
      version: 2,
      rooms: [{ projectPath: '/a', x: 0, y: 0, tagIds: [] }],
      tags: [],
      activeTagIds: [],
      customGroups: [{ id: 'g1', x: 10, y: 10, w: 200, h: 100, label: 'My group', color: '#ff0' }],
      postIts: [{ id: 'p1', x: 0, y: 0, w: 160, h: 120, text: 'Hello', color: '#fde68a' }],
      stickers: [{ id: 's1', x: 0, y: 0, w: 40, h: 40, rot: 0, kind: 'plant' }],
    };
    const out = normaliseLayout(v2);
    expect(out).not.toBeNull();
    expect(out!.customGroups).toHaveLength(1);
    expect(out!.postIts[0].text).toBe('Hello');
    expect(out!.stickers[0].kind).toBe('plant');
  });
});
