import { describe, it, expect } from 'vitest';
import { bootstrapLayoutFromTerminals, reconcileLayoutWithTerminals } from '../officeMigration';
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
  it('creates zones per distinct inferred tag', () => {
    const terminals = [
      terminal('/Users/a/Desktop/Dev/Personal/quack-app'),
      terminal('/Users/a/Desktop/Dev/flow-app'),
      terminal('/Users/a/Desktop/Dev/flow-bi'),
    ];
    const layout = bootstrapLayoutFromTerminals(terminals);
    expect(layout.version).toBe(1);
    const zoneTagIds = layout.zones.map(z => z.tagId);
    expect(zoneTagIds).toContain('personal');
    expect(zoneTagIds).toContain('cc');
  });

  it('creates one room per distinct project assigned to the matching zone', () => {
    const terminals = [
      terminal('/Users/a/Desktop/Dev/Personal/quack-app'),
      terminal('/Users/a/Desktop/Dev/flow-app'),
    ];
    const layout = bootstrapLayoutFromTerminals(terminals);
    expect(layout.rooms).toHaveLength(2);
    const personalZoneId = layout.zones.find(z => z.tagId === 'personal')?.id;
    const personalRoom = layout.rooms.find(r => r.projectPath.includes('Personal'));
    expect(personalRoom?.zoneId).toBe(personalZoneId);
  });

  it('deduplicates N terminals on the same cwd into one room', () => {
    const cwd = '/Users/a/Desktop/Dev/Personal/quack-app';
    const terminals = [terminal(cwd, 'alex'), terminal(cwd, 'jack'), terminal(cwd, 'sophie')];
    const layout = bootstrapLayoutFromTerminals(terminals);
    const matches = layout.rooms.filter(r => r.projectPath === cwd);
    expect(matches).toHaveLength(1);
  });

  it('is idempotent (running twice yields equivalent shape)', () => {
    const terminals = [terminal('/Users/a/Desktop/Dev/Personal/quack-app')];
    const first = bootstrapLayoutFromTerminals(terminals);
    const second = bootstrapLayoutFromTerminals(terminals);
    expect(second.zones.map(z => z.tagId).sort()).toEqual(first.zones.map(z => z.tagId).sort());
    expect(second.rooms.map(r => r.projectPath).sort()).toEqual(first.rooms.map(r => r.projectPath).sort());
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
    // Simulate a corrupted persisted layout: 3 rooms with same projectPath
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
