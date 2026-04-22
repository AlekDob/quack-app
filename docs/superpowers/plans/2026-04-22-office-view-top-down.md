# Office View v2 — Top-Down Floor Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PixiJS isometric Office View with a draggable top-down workspace built on SVG + HTML/CSS, featuring labeled zones, project cards, a tag filter, and a floor-plan overlay for zoom-in.

**Architecture:** Full-DOM rewrite (γ from the spec). Overview renders as SVG canvas (pan/zoom) holding zone rectangles, plus HTML-overlay room cards that mirror the canvas transform (same pattern as Whiteboard MD Preview Cards). Layout is persisted in `~/.quack/office-layout.json` via Tauri `read_file_content`/`write_file_content`. PixiJS is removed entirely after P3 cleanup.

**Tech Stack:** React 18, TypeScript strict, SVG, HTML/CSS (CSS keyframes), Tauri v2 commands (`get_home_directory`, `read_file_content`, `write_file_content`), Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-04-22-office-view-top-down-design.md` — read first.

---

## Phase 1 — Overview (P1)

### Task 1: Data types + feature flag scaffold

**Files:**
- Create: `src/components/office/v2/officeTypes.ts`
- Create: `src/components/office/v2/officeConstants.ts`
- Create: `src/components/office/v2/index.ts`
- Modify: `src/components/office/v2/featureFlag.ts` (new)

> Note: all v2 work lives in `src/components/office/v2/` until P3 deletes the v1 folder contents. This keeps diffs reviewable and allows the feature flag to swap which implementation renders.

- [ ] **Step 1: Write `officeTypes.ts`**

```ts
// src/components/office/v2/officeTypes.ts
export type TagSource = 'auto' | 'manual';

export interface OfficeTag {
  id: string;
  label: string;
  color: string;
  source: TagSource;
}

export interface OfficeZone {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tagId?: string;
}

export interface OfficeRoomCard {
  projectPath: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  zoneId?: string;
  tagIds: string[];
}

export interface OfficeLayout {
  version: 1;
  zones: OfficeZone[];
  rooms: OfficeRoomCard[];
  tags: OfficeTag[];
  activeTagIds: string[];
  breakRoom: { x: number; y: number };
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}
```

- [ ] **Step 2: Write `officeConstants.ts`**

```ts
// src/components/office/v2/officeConstants.ts
export const CARD_DEFAULT_W = 220;
export const CARD_DEFAULT_H = 140;
export const ZONE_MIN_W = 260;
export const ZONE_MIN_H = 180;
export const ZONE_PADDING = 16;
export const FLOOR_PLAN_OVERLAY_MAX_W = 1100;
export const FLOOR_PLAN_OVERLAY_MAX_H = 720;
export const DRAG_THRESHOLD_PX = 4;
export const WRITE_DEBOUNCE_MS = 500;
export const DEFAULT_TAGS: Array<{ id: string; label: string; color: string }> = [
  { id: 'personal', label: 'Personal', color: '#c084fc' },
  { id: 'cc', label: 'C&C', color: '#00D9FF' },
  { id: 'consulting', label: 'Consulting', color: '#F7931E' },
  { id: 'other', label: 'Other', color: '#94a3b8' },
];
export const LAYOUT_FILE_NAME = 'office-layout.json';
```

- [ ] **Step 3: Write `featureFlag.ts`**

```ts
// src/components/office/v2/featureFlag.ts
const LEGACY_LOCAL_STORAGE_KEY = 'quack:forceOfficeV1';

export function isOfficeV2Enabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY) !== 'true';
}
```

- [ ] **Step 4: Write `index.ts` barrel**

```ts
// src/components/office/v2/index.ts
export * from './officeTypes';
export * from './officeConstants';
export { isOfficeV2Enabled } from './featureFlag';
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: passes cleanly (no errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/office/v2/
git commit -m "feat(office-v2): add data types, constants, and feature flag scaffold"
```

---

### Task 2: Pure layout math (TDD)

**Files:**
- Create: `src/components/office/v2/officeLayout.ts`
- Create: `src/components/office/v2/__tests__/officeLayout.test.ts`

Pure functions with no React and no Tauri dependencies — perfect for TDD.

- [ ] **Step 1: Write failing tests**

```ts
// src/components/office/v2/__tests__/officeLayout.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/office/v2/__tests__/officeLayout.test.ts`
Expected: FAIL — "Cannot find module '../officeLayout'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/office/v2/officeLayout.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/office/v2/__tests__/officeLayout.test.ts`
Expected: PASS (all 10 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/office/v2/officeLayout.ts src/components/office/v2/__tests__/
git commit -m "feat(office-v2): add pure layout math with TDD coverage"
```

---

### Task 3: Storage service (TDD)

**Files:**
- Create: `src/components/office/v2/officeStorage.ts`
- Create: `src/components/office/v2/__tests__/officeStorage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/components/office/v2/__tests__/officeStorage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OfficeLayout } from '../officeTypes';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Dynamic import AFTER mocks are installed
const { readOfficeLayout, writeOfficeLayout, OFFICE_LAYOUT_PATH_CACHE_KEY } = await import('../officeStorage');

beforeEach(() => {
  mockInvoke.mockReset();
});

const sampleLayout: OfficeLayout = {
  version: 1,
  zones: [],
  rooms: [],
  tags: [],
  activeTagIds: [],
  breakRoom: { x: 0, y: 0 },
};

describe('readOfficeLayout', () => {
  it('returns null when the file does not exist', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'read_file_content') return Promise.reject(new Error('ENOENT'));
      throw new Error('unexpected cmd: ' + cmd);
    });

    const result = await readOfficeLayout();
    expect(result).toBeNull();
  });

  it('parses a valid version-1 layout', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'read_file_content') return Promise.resolve(JSON.stringify(sampleLayout));
      throw new Error('unexpected cmd: ' + cmd);
    });

    const result = await readOfficeLayout();
    expect(result).toEqual(sampleLayout);
  });

  it('returns null and renames corrupt file', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = [];
    mockInvoke.mockImplementation((cmd: string, args: unknown) => {
      calls.push({ cmd, args });
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'read_file_content') return Promise.resolve('{{ not json }}');
      if (cmd === 'rename_file') return Promise.resolve();
      throw new Error('unexpected cmd: ' + cmd);
    });

    const result = await readOfficeLayout();
    expect(result).toBeNull();
    expect(calls.some(c => c.cmd === 'rename_file')).toBe(true);
  });
});

describe('writeOfficeLayout', () => {
  it('writes JSON to the expected path', async () => {
    const writes: unknown[] = [];
    mockInvoke.mockImplementation((cmd: string, args: unknown) => {
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'write_file_content') {
        writes.push(args);
        return Promise.resolve();
      }
      throw new Error('unexpected cmd: ' + cmd);
    });

    await writeOfficeLayout(sampleLayout);
    expect(writes).toHaveLength(1);
    const call = writes[0] as { path: string; content: string };
    expect(call.path).toBe('/Users/alek/.quack/office-layout.json');
    expect(JSON.parse(call.content)).toEqual(sampleLayout);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/office/v2/__tests__/officeStorage.test.ts`
Expected: FAIL — "Cannot find module '../officeStorage'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/office/v2/officeStorage.ts
import { invoke } from '@tauri-apps/api/core';
import { normalizeToForwardSlash } from '../../../utils/platform';
import { LAYOUT_FILE_NAME } from './officeConstants';
import type { OfficeLayout } from './officeTypes';

export const OFFICE_LAYOUT_PATH_CACHE_KEY = '__office_layout_path__';

async function resolveLayoutPath(): Promise<string> {
  const home = await invoke<string>('get_home_directory');
  return normalizeToForwardSlash(`${home}/.quack/${LAYOUT_FILE_NAME}`);
}

export async function readOfficeLayout(): Promise<OfficeLayout | null> {
  const path = await resolveLayoutPath();
  let raw: string;
  try {
    raw = await invoke<string>('read_file_content', { path });
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as OfficeLayout;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    const corruptPath = path.replace(/\.json$/, `.corrupt-${new Date().toISOString().slice(0,10)}.json`);
    try {
      await invoke('rename_file', { from: path, to: corruptPath });
    } catch {/* swallow */}
    return null;
  }
}

export async function writeOfficeLayout(layout: OfficeLayout): Promise<void> {
  const path = await resolveLayoutPath();
  const content = JSON.stringify(layout, null, 2);
  await invoke('write_file_content', { path, content });
}
```

- [ ] **Step 4: Verify `rename_file` Tauri command exists**

Run: `grep -rn "rename_file" /Users/alekdob/Desktop/Dev/Personal/quack-app/src-tauri/src | head -5`
Expected: at least one match in a `#[tauri::command]` block. If missing, open `src-tauri/src/main.rs` (or the relevant `files.rs`/`filesystem.rs`) and add:

```rust
#[tauri::command]
async fn rename_file(from: String, to: String) -> Result<(), String> {
    std::fs::rename(&from, &to).map_err(|e| e.to_string())
}
```

Then register in `invoke_handler!` macro. Rebuild with `cargo check` inside `src-tauri/`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/components/office/v2/__tests__/officeStorage.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/office/v2/officeStorage.ts src/components/office/v2/__tests__/officeStorage.test.ts src-tauri/
git commit -m "feat(office-v2): add storage service with corrupt-file recovery"
```

---

### Task 4: Auto-migration (TDD)

**Files:**
- Create: `src/components/office/v2/officeMigration.ts`
- Create: `src/components/office/v2/__tests__/officeMigration.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/components/office/v2/__tests__/officeMigration.test.ts
import { describe, it, expect } from 'vitest';
import { bootstrapLayoutFromTerminals, reconcileLayoutWithTerminals } from '../officeMigration';
import type { TerminalInfo } from '../../../../types';

const terminal = (cwd: string): TerminalInfo => ({
  id: cwd,
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

  it('creates one room per terminal assigned to the matching zone', () => {
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/office/v2/__tests__/officeMigration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/office/v2/officeMigration.ts
import type { OfficeLayout, OfficeRoomCard, OfficeTag, OfficeZone } from './officeTypes';
import { inferTagFromPath, defaultZonePositions, packRoomsInZone } from './officeLayout';
import { DEFAULT_TAGS } from './officeConstants';
import type { TerminalInfo } from '../../../types';

export function bootstrapLayoutFromTerminals(terminals: TerminalInfo[]): OfficeLayout {
  const tagIds = new Set<string>();
  const tagByProject = new Map<string, string>();

  for (const t of terminals) {
    const tag = inferTagFromPath(t.cwd);
    tagIds.add(tag);
    tagByProject.set(t.cwd, tag);
  }

  const zones = defaultZonePositions([...tagIds]);
  const zoneByTag = new Map(zones.map(z => [z.tagId!, z]));

  // Group rooms by zone and pack inside
  const rooms: OfficeRoomCard[] = [];
  for (const zone of zones) {
    const projectsInZone = terminals.filter(t => tagByProject.get(t.cwd) === zone.tagId);
    const unpacked = projectsInZone.map<OfficeRoomCard>(t => ({
      projectPath: t.cwd,
      x: 0,
      y: 0,
      zoneId: zone.id,
      tagIds: [zone.tagId!],
    }));
    rooms.push(...packRoomsInZone(zone, unpacked));
  }

  const tags: OfficeTag[] = DEFAULT_TAGS
    .filter(t => tagIds.has(t.id))
    .map(t => ({ ...t, source: 'auto' as const }));

  const lastZone = zones[zones.length - 1];
  const breakRoom = {
    x: lastZone ? lastZone.x + lastZone.w + 40 : 0,
    y: 0,
  };

  return {
    version: 1,
    zones,
    rooms,
    tags,
    activeTagIds: [],
    breakRoom,
  };
}

export function reconcileLayoutWithTerminals(layout: OfficeLayout, terminals: TerminalInfo[]): OfficeLayout {
  const existingPaths = new Set(layout.rooms.map(r => r.projectPath));
  const newRooms: OfficeRoomCard[] = [...layout.rooms];

  for (const t of terminals) {
    if (existingPaths.has(t.cwd)) continue;

    const tag = inferTagFromPath(t.cwd);
    const zone = layout.zones.find(z => z.tagId === tag);
    const card: OfficeRoomCard = {
      projectPath: t.cwd,
      x: 0,
      y: 0,
      zoneId: zone?.id,
      tagIds: [tag],
    };

    if (zone) {
      const otherInZone = newRooms.filter(r => r.zoneId === zone.id);
      const packed = packRoomsInZone(zone, [...otherInZone, card]);
      // Replace zone members with packed versions
      for (let i = newRooms.length - 1; i >= 0; i--) {
        if (newRooms[i].zoneId === zone.id) newRooms.splice(i, 1);
      }
      newRooms.push(...packed);
    } else {
      newRooms.push(card);
    }
  }

  return { ...layout, rooms: newRooms };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/components/office/v2/__tests__/officeMigration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/office/v2/officeMigration.ts src/components/office/v2/__tests__/officeMigration.test.ts
git commit -m "feat(office-v2): add auto-migration (bootstrap + reconcile) with TDD"
```

---

### Task 5: `useOfficeLayout` hook

**Files:**
- Create: `src/components/office/v2/useOfficeLayout.ts`

React hook that owns the layout state, reads once on mount, debounces writes, exposes CRUD helpers.

- [ ] **Step 1: Implement**

```ts
// src/components/office/v2/useOfficeLayout.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { readOfficeLayout, writeOfficeLayout } from './officeStorage';
import { bootstrapLayoutFromTerminals, reconcileLayoutWithTerminals } from './officeMigration';
import { WRITE_DEBOUNCE_MS } from './officeConstants';
import type { OfficeLayout, OfficeRoomCard, OfficeZone } from './officeTypes';
import type { TerminalInfo } from '../../../types';

interface UseOfficeLayoutResult {
  layout: OfficeLayout | null;
  setRoomPosition: (projectPath: string, x: number, y: number, zoneId?: string) => void;
  setZonePosition: (zoneId: string, x: number, y: number) => void;
  setZoneSize: (zoneId: string, w: number, h: number) => void;
  toggleTag: (tagId: string) => void;
  setBreakRoomPosition: (x: number, y: number) => void;
  ready: boolean;
}

export function useOfficeLayout(terminals: TerminalInfo[]): UseOfficeLayoutResult {
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [ready, setReady] = useState(false);
  const writeTimerRef = useRef<number | null>(null);

  // Initial load — once only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = await readOfficeLayout();
      if (cancelled) return;
      const base = persisted ?? bootstrapLayoutFromTerminals(terminals);
      const reconciled = reconcileLayoutWithTerminals(base, terminals);
      setLayout(reconciled);
      setReady(true);
      if (!persisted) {
        // first-run: persist the bootstrap
        await writeOfficeLayout(reconciled);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally once

  // Reconcile when terminals change (after first load)
  useEffect(() => {
    if (!ready || !layout) return;
    const reconciled = reconcileLayoutWithTerminals(layout, terminals);
    if (reconciled.rooms.length !== layout.rooms.length) {
      setLayout(reconciled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminals, ready]);

  // Debounced write
  useEffect(() => {
    if (!ready || !layout) return;
    if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(() => {
      writeOfficeLayout(layout).catch(err => console.error('[office-v2] write failed', err));
    }, WRITE_DEBOUNCE_MS);
    return () => {
      if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    };
  }, [layout, ready]);

  const setRoomPosition = useCallback((projectPath: string, x: number, y: number, zoneId?: string) => {
    setLayout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rooms: prev.rooms.map(r =>
          r.projectPath === projectPath ? { ...r, x, y, zoneId } : r
        ),
      };
    });
  }, []);

  const setZonePosition = useCallback((zoneId: string, x: number, y: number) => {
    setLayout(prev => {
      if (!prev) return prev;
      const zone = prev.zones.find(z => z.id === zoneId);
      if (!zone) return prev;
      const dx = x - zone.x;
      const dy = y - zone.y;
      return {
        ...prev,
        zones: prev.zones.map(z => z.id === zoneId ? { ...z, x, y } : z),
        rooms: prev.rooms.map(r => r.zoneId === zoneId ? { ...r, x: r.x + dx, y: r.y + dy } : r),
      };
    });
  }, []);

  const setZoneSize = useCallback((zoneId: string, w: number, h: number) => {
    setLayout(prev => prev ? {
      ...prev,
      zones: prev.zones.map(z => z.id === zoneId ? { ...z, w, h } : z),
    } : prev);
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setLayout(prev => {
      if (!prev) return prev;
      const active = new Set(prev.activeTagIds);
      if (active.has(tagId)) active.delete(tagId); else active.add(tagId);
      return { ...prev, activeTagIds: [...active] };
    });
  }, []);

  const setBreakRoomPosition = useCallback((x: number, y: number) => {
    setLayout(prev => prev ? { ...prev, breakRoom: { x, y } } : prev);
  }, []);

  return { layout, setRoomPosition, setZonePosition, setZoneSize, toggleTag, setBreakRoomPosition, ready };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/office/v2/useOfficeLayout.ts
git commit -m "feat(office-v2): add useOfficeLayout hook (state + debounced persistence)"
```

---

### Task 6: Duck avatar component

**Files:**
- Create: `src/components/office/v2/OfficeDuckAvatar.tsx`
- Create: `src/components/office/v2/OfficeView.css` (starts here, grows each task)

- [ ] **Step 1: Write component**

```tsx
// src/components/office/v2/OfficeDuckAvatar.tsx
import { memo } from 'react';
import { sessionDotColor } from './officeLayout';

export type DuckStatus = 'busy' | 'idle' | 'waiting';

interface DuckProps {
  agentId: string;
  color: string;
  avatarUrl?: string;
  initial: string;
  status: DuckStatus;
  sessionDots: Array<{ awaiting: boolean; working: boolean; ready: boolean }>;
  onClick?: (agentId: string, e: React.MouseEvent) => void;
}

const AVATAR_RADIUS = 18;
const SESSION_DOT_RADIUS = 3;

function OfficeDuckAvatarImpl({ agentId, color, avatarUrl, initial, status, sessionDots, onClick }: DuckProps) {
  const visibleDots = sessionDots.slice(0, 5);
  return (
    <button
      type="button"
      className={`office-duck office-duck--${status}`}
      style={{ '--duck-color': color } as React.CSSProperties}
      onClick={(e) => onClick?.(agentId, e)}
      aria-label={`Agent ${initial}`}
    >
      <span className="office-duck__avatar">
        {avatarUrl
          ? <img src={avatarUrl} alt="" />
          : <span className="office-duck__initial">{initial}</span>}
      </span>

      {status === 'busy' && (
        <span className="office-duck__particles" aria-hidden>
          <span /><span /><span />
        </span>
      )}

      {visibleDots.length > 0 && (
        <span className="office-duck__session-dots" aria-hidden>
          {visibleDots.map((dot, i) => {
            const angle = -45 + i * 18; // arc along the top-right
            return (
              <span
                key={i}
                className="office-duck__dot"
                style={{
                  background: sessionDotColor(dot),
                  transform: `rotate(${angle}deg) translate(0, -${AVATAR_RADIUS + 4}px) rotate(${-angle}deg)`,
                  width: SESSION_DOT_RADIUS * 2,
                  height: SESSION_DOT_RADIUS * 2,
                }}
              />
            );
          })}
        </span>
      )}
    </button>
  );
}

export const OfficeDuckAvatar = memo(OfficeDuckAvatarImpl);
```

- [ ] **Step 2: Write CSS (start `OfficeView.css`)**

```css
/* src/components/office/v2/OfficeView.css */
.office-duck {
  position: relative;
  width: 36px;
  height: 36px;
  border: 0;
  padding: 0;
  border-radius: 50%;
  background: var(--duck-color);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.office-duck__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.85);
  background: var(--duck-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0a0a18;
  font-weight: 700;
  font-size: 13px;
}

.office-duck__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  clip-path: circle(50%);
}

@keyframes office-duck-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.office-duck--busy { animation: office-duck-bob 0.4s ease-in-out infinite; }
.office-duck--waiting { animation: office-duck-bob 1.2s ease-in-out infinite; }
.office-duck--idle { animation: office-duck-bob 2s ease-in-out infinite; }

.office-duck__particles {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 3px;
}

@keyframes office-duck-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.office-duck__particles span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  animation: office-duck-pulse 0.8s ease-in-out infinite;
}

.office-duck__particles span:nth-child(2) { animation-delay: 0.2s; }
.office-duck__particles span:nth-child(3) { animation-delay: 0.4s; }

.office-duck__session-dots {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.office-duck__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.35);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/office/v2/OfficeDuckAvatar.tsx src/components/office/v2/OfficeView.css
git commit -m "feat(office-v2): add OfficeDuckAvatar with CSS animations"
```

---

### Task 7: Room card component

**Files:**
- Create: `src/components/office/v2/OfficeRoomCard.tsx`
- Modify: `src/components/office/v2/OfficeView.css` (append)

- [ ] **Step 1: Write component**

```tsx
// src/components/office/v2/OfficeRoomCard.tsx
import { memo } from 'react';
import type { OfficeRoomCard as RoomCardData, OfficeTag } from './officeTypes';
import { CARD_DEFAULT_W, CARD_DEFAULT_H } from './officeConstants';
import { OfficeDuckAvatar, type DuckStatus } from './OfficeDuckAvatar';
import type { TerminalInfo } from '../../../types';

export interface DuckViewModel {
  agentId: string;
  color: string;
  avatarUrl?: string;
  initial: string;
  status: DuckStatus;
  sessionDots: Array<{ awaiting: boolean; working: boolean; ready: boolean }>;
}

interface Props {
  card: RoomCardData;
  terminal: TerminalInfo;
  ducks: DuckViewModel[];
  doorPlateColor: string;
  busyRatio: number;
  counts: { busy: number; idle: number; dormant: number };
  tags: OfficeTag[];
  dimmed: boolean;
  onDragStart?: (projectPath: string, e: React.PointerEvent) => void;
  onDoubleClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string, e: React.MouseEvent) => void;
}

const MAX_VISIBLE = 5;

function OfficeRoomCardImpl({
  card, terminal, ducks, doorPlateColor, busyRatio, counts, tags, dimmed,
  onDragStart, onDoubleClick, onDuckClick,
}: Props) {
  const w = card.w ?? CARD_DEFAULT_W;
  const h = card.h ?? CARD_DEFAULT_H;
  const visibleDucks = ducks.slice(0, MAX_VISIBLE);
  const overflow = ducks.length - visibleDucks.length;
  const relevantTags = tags.filter(t => card.tagIds.includes(t.id));

  return (
    <div
      className={`office-room-card ${dimmed ? 'office-room-card--dimmed' : ''}`}
      style={{
        width: w,
        height: h,
        transform: `translate(${card.x}px, ${card.y}px)`,
      }}
      onDoubleClick={() => onDoubleClick?.(card.projectPath)}
    >
      <div
        className="office-room-card__plate"
        onPointerDown={(e) => onDragStart?.(card.projectPath, e)}
      >
        <span className="office-room-card__status-dot" style={{ background: doorPlateColor }} />
        <span className="office-room-card__name">{terminal.label}</span>
      </div>

      <div className="office-room-card__body">
        <div className="office-room-card__meta">
          {relevantTags.map(t => (
            <span key={t.id} className="office-room-card__tag" style={{ background: t.color }}>{t.label}</span>
          ))}
          <span className="office-room-card__branch">{terminal.branch ?? 'main'}</span>
        </div>

        <div className="office-room-card__ducks">
          {visibleDucks.map(d => (
            <OfficeDuckAvatar key={d.agentId} {...d} onClick={onDuckClick} />
          ))}
          {overflow > 0 && <span className="office-room-card__overflow">+{overflow}</span>}
        </div>

        <div className="office-room-card__counts">
          <span style={{ color: '#F7931E' }}>● {counts.busy}</span>
          <span style={{ color: '#22c55e' }}>● {counts.idle}</span>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>● {counts.dormant}</span>
        </div>

        <div className="office-room-card__activity">
          <div className="office-room-card__activity-fill" style={{ width: `${Math.round(busyRatio * 100)}%` }} />
        </div>
      </div>

      <div className="office-room-card__wall office-room-card__wall--bl" aria-hidden />
      <div className="office-room-card__wall office-room-card__wall--br" aria-hidden />
    </div>
  );
}

export const OfficeRoomCard = memo(OfficeRoomCardImpl);
```

- [ ] **Step 2: Append CSS**

```css
/* Append to OfficeView.css */
.office-room-card {
  position: absolute;
  top: 0;
  left: 0;
  background: #14142a;
  border: 1.5px solid #2a2a4a;
  border-radius: 6px;
  padding: 14px 14px 12px;
  color: rgba(255, 255, 255, 0.85);
  transition: opacity 0.15s ease;
  will-change: transform;
}

.office-room-card--dimmed { opacity: 0.3; }

.office-room-card__plate {
  position: absolute;
  top: -12px;
  left: 12px;
  right: 12px;
  height: 22px;
  background: #1a1a3a;
  border: 1px solid #2a2a4a;
  border-radius: 3px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: grab;
  user-select: none;
}

.office-room-card__plate:active { cursor: grabbing; }

.office-room-card__status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
}

.office-room-card__name {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.office-room-card__body {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.office-room-card__meta {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 9px;
}

.office-room-card__tag {
  padding: 1px 6px;
  border-radius: 8px;
  color: #0a0a18;
  font-weight: 600;
}

.office-room-card__branch {
  color: rgba(255, 255, 255, 0.45);
  font-family: 'Fira Code', monospace;
  font-size: 10px;
}

.office-room-card__ducks {
  display: flex;
  gap: 4px;
  align-items: center;
}

.office-room-card__overflow {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-left: 4px;
}

.office-room-card__counts {
  display: flex;
  gap: 10px;
  font-size: 10px;
}

.office-room-card__activity {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

.office-room-card__activity-fill {
  height: 100%;
  background: #ff6b35;
  transition: width 0.25s ease;
}

.office-room-card__wall {
  position: absolute;
  bottom: 3px;
  width: 10px;
  height: 10px;
}
.office-room-card__wall--bl { left: 3px; border-left: 2px solid #2a2a4a; border-bottom: 2px solid #2a2a4a; }
.office-room-card__wall--br { right: 3px; border-right: 2px solid #2a2a4a; border-bottom: 2px solid #2a2a4a; }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/office/v2/OfficeRoomCard.tsx src/components/office/v2/OfficeView.css
git commit -m "feat(office-v2): add OfficeRoomCard HTML overlay component"
```

---

### Task 8: Zone component

**Files:**
- Create: `src/components/office/v2/OfficeZone.tsx`
- Modify: `src/components/office/v2/OfficeView.css` (append)

- [ ] **Step 1: Write component**

```tsx
// src/components/office/v2/OfficeZone.tsx
import { memo } from 'react';
import type { OfficeZone as ZoneData } from './officeTypes';

interface Props {
  zone: ZoneData;
  dragActive?: boolean;
  hoverTarget?: boolean;
  onLabelPointerDown?: (zoneId: string, e: React.PointerEvent) => void;
  onResizeHandlePointerDown?: (zoneId: string, corner: 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) => void;
}

function OfficeZoneImpl({ zone, dragActive, hoverTarget, onLabelPointerDown, onResizeHandlePointerDown }: Props) {
  const stroke = hoverTarget ? '#f59e0b' : zone.color;
  const strokeWidth = hoverTarget ? 3 : 1.5;

  return (
    <g className={`office-zone ${dragActive ? 'office-zone--dragging' : ''}`}>
      <defs>
        <linearGradient id={`zone-grad-${zone.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={zone.color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={zone.color} stopOpacity="0.03" />
        </linearGradient>
      </defs>

      <rect
        x={zone.x}
        y={zone.y}
        width={zone.w}
        height={zone.h}
        fill={`url(#zone-grad-${zone.id})`}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray="6 4"
        rx={8}
      />

      <text
        x={zone.x + 10}
        y={zone.y + 16}
        className="office-zone__label"
        fill={zone.color}
        onPointerDown={(e) => onLabelPointerDown?.(zone.id, e)}
      >
        {zone.label.toUpperCase()}
      </text>

      {(['nw', 'ne', 'sw', 'se'] as const).map(corner => {
        const cx = corner.includes('w') ? zone.x : zone.x + zone.w;
        const cy = corner.includes('n') ? zone.y : zone.y + zone.h;
        return (
          <circle
            key={corner}
            cx={cx}
            cy={cy}
            r={5}
            className={`office-zone__handle office-zone__handle--${corner}`}
            onPointerDown={(e) => onResizeHandlePointerDown?.(zone.id, corner, e)}
          />
        );
      })}
    </g>
  );
}

export const OfficeZone = memo(OfficeZoneImpl);
```

- [ ] **Step 2: Append CSS**

```css
/* Append to OfficeView.css */
.office-zone__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: grab;
  user-select: none;
  font-family: 'Inter', -apple-system, sans-serif;
}

.office-zone--dragging .office-zone__label { cursor: grabbing; }

.office-zone__handle {
  fill: rgba(255, 255, 255, 0.2);
  stroke: rgba(255, 255, 255, 0.4);
  stroke-width: 1;
}
.office-zone__handle:hover { fill: rgba(255, 255, 255, 0.5); }
.office-zone__handle--nw, .office-zone__handle--se { cursor: nwse-resize; }
.office-zone__handle--ne, .office-zone__handle--sw { cursor: nesw-resize; }
```

- [ ] **Step 3: Type-check & commit**

Run: `npx tsc --noEmit`
Commit:

```bash
git add src/components/office/v2/OfficeZone.tsx src/components/office/v2/OfficeView.css
git commit -m "feat(office-v2): add OfficeZone SVG component with resize handles"
```

---

### Task 9: Break Room component

**Files:**
- Create: `src/components/office/v2/OfficeBreakRoom.tsx`
- Modify: `src/components/office/v2/OfficeView.css` (append)

- [ ] **Step 1: Write component**

```tsx
// src/components/office/v2/OfficeBreakRoom.tsx
import { memo } from 'react';

interface Props {
  x: number;
  y: number;
  w?: number;
  h?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
}

const DEFAULT_W = 320;
const DEFAULT_H = 200;

function OfficeBreakRoomImpl({ x, y, w = DEFAULT_W, h = DEFAULT_H, onPointerDown }: Props) {
  return (
    <g className="office-break-room" onPointerDown={onPointerDown}>
      <rect x={x} y={y} width={w} height={h} fill="#2a1f1a" stroke="#1a3a3a" strokeWidth={1.5} strokeDasharray="6 4" rx={8} />
      <text x={x + 10} y={y + 16} fill="#ff6b35" className="office-break-room__label">BREAK ROOM</text>

      {/* 2 sofas */}
      <rect x={x + 20} y={y + 50} width={100} height={22} rx={6} fill="#3d2a1e" />
      <rect x={x + 20} y={y + 90} width={100} height={22} rx={6} fill="#3d2a1e" />

      {/* TV */}
      <rect x={x + 160} y={y + 50} width={70} height={40} rx={3} fill="#0a0a0a" stroke="#1a3a3a" />
      <circle cx={x + 195} cy={y + 70} r={2} fill="#00d9ff" />

      {/* Vending machine */}
      <rect x={x + 250} y={y + 50} width={50} height={130} rx={4} fill="#1a2a3a" stroke="#2a4a5a" />
      <rect x={x + 258} y={y + 60} width={34} height={20} rx={2} fill="#22c55e" />
      {[0, 1, 2, 3].map(i => (
        <circle key={i} cx={x + 267 + (i % 2) * 14} cy={y + 95 + Math.floor(i / 2) * 14} r={3} fill="rgba(255,255,255,0.3)" />
      ))}
    </g>
  );
}

export const OfficeBreakRoom = memo(OfficeBreakRoomImpl);
```

- [ ] **Step 2: Append CSS**

```css
.office-break-room__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: grab;
  user-select: none;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/office/v2/OfficeBreakRoom.tsx src/components/office/v2/OfficeView.css
git commit -m "feat(office-v2): add OfficeBreakRoom (flat top-down furniture)"
```

---

### Task 10: Tag filter component

**Files:**
- Create: `src/components/office/v2/OfficeTagFilter.tsx`
- Modify: `src/components/office/v2/OfficeView.css` (append)

- [ ] **Step 1: Write component**

```tsx
// src/components/office/v2/OfficeTagFilter.tsx
import { memo } from 'react';
import type { OfficeTag } from './officeTypes';

interface Props {
  tags: OfficeTag[];
  activeTagIds: string[];
  onToggle: (tagId: string) => void;
}

function OfficeTagFilterImpl({ tags, activeTagIds, onToggle }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="office-tag-filter">
      {tags.map(tag => {
        const active = activeTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            className={`office-tag-filter__pill ${active ? 'office-tag-filter__pill--active' : ''}`}
            style={{ '--tag-color': tag.color } as React.CSSProperties}
            onClick={() => onToggle(tag.id)}
          >
            {tag.label}
          </button>
        );
      })}
    </div>
  );
}

export const OfficeTagFilter = memo(OfficeTagFilterImpl);
```

- [ ] **Step 2: Append CSS**

```css
.office-tag-filter {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.office-tag-filter__pill {
  border: 1px solid var(--tag-color);
  background: color-mix(in srgb, var(--tag-color) 15%, transparent);
  color: var(--tag-color);
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.office-tag-filter__pill--active {
  background: var(--tag-color);
  color: #0a0a18;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/office/v2/OfficeTagFilter.tsx src/components/office/v2/OfficeView.css
git commit -m "feat(office-v2): add OfficeTagFilter (top-bar filter pills)"
```

---

### Task 11: Action menu (port from v1)

**Files:**
- Copy: `src/components/office/OfficeActionMenu.tsx` → `src/components/office/v2/OfficeActionMenu.tsx`
- Modify: new copy to remove PixiJS-specific props and wire to portal + DOM events

- [ ] **Step 1: Copy the file**

Run:
```bash
cp src/components/office/OfficeActionMenu.tsx src/components/office/v2/OfficeActionMenu.tsx
```

- [ ] **Step 2: Inspect and adapt**

Open `src/components/office/v2/OfficeActionMenu.tsx`. Remove any `FederatedPointerEvent` types or PixiJS references. If the component already uses DOM events (`screenX/Y` from a `MouseEvent`), leave logic intact — only the render is affected. Ensure:

- Import paths still resolve (adjust relative paths `../../../` → `../../../` stays the same since both versions live 3 folders deep).
- Keep the React Portal wrapping (`createPortal(menu, document.body)`) if it exists; add it if not — the menu must escape overflow clipping.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Fix any import path errors introduced by the copy.

- [ ] **Step 4: Commit**

```bash
git add src/components/office/v2/OfficeActionMenu.tsx
git commit -m "feat(office-v2): port OfficeActionMenu from v1 (DOM-only, no PixiJS)"
```

---

### Task 12: Drag hook

**Files:**
- Create: `src/components/office/v2/useOfficeDrag.ts`

Single hook that handles card drag, zone drag, and drag-into-zone hit testing. Mirrors the pattern from `FeatureMapCanvas` drag logic.

- [ ] **Step 1: Implement hook**

```ts
// src/components/office/v2/useOfficeDrag.ts
import { useCallback, useRef, useState } from 'react';
import { DRAG_THRESHOLD_PX } from './officeConstants';
import type { OfficeZone, Viewport } from './officeTypes';

interface DragState {
  kind: 'card' | 'zone';
  id: string;           // projectPath or zoneId
  startPointerX: number;
  startPointerY: number;
  startX: number;
  startY: number;
  active: boolean;
  hoverZoneId?: string; // for card → zone
}

interface Handlers {
  onCardMove: (projectPath: string, x: number, y: number) => void;
  onZoneMove: (zoneId: string, x: number, y: number) => void;
  onCardDrop: (projectPath: string, x: number, y: number, zoneId: string | undefined) => void;
}

export function useOfficeDrag(viewport: Viewport, zones: OfficeZone[], handlers: Handlers) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const hitTestZone = useCallback((x: number, y: number): string | undefined => {
    for (const z of zones) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return z.id;
    }
    return undefined;
  }, [zones]);

  const screenToCanvas = useCallback((sx: number, sy: number) => ({
    x: (sx - viewport.panX) / viewport.zoom,
    y: (sy - viewport.panY) / viewport.zoom,
  }), [viewport]);

  const startCardDrag = useCallback((projectPath: string, startX: number, startY: number, e: React.PointerEvent) => {
    setDrag({
      kind: 'card', id: projectPath,
      startPointerX: e.clientX, startPointerY: e.clientY,
      startX, startY, active: false,
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const startZoneDrag = useCallback((zoneId: string, startX: number, startY: number, e: React.PointerEvent) => {
    setDrag({
      kind: 'zone', id: zoneId,
      startPointerX: e.clientX, startPointerY: e.clientY,
      startX, startY, active: false,
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startPointerX) / viewport.zoom;
    const dy = (e.clientY - d.startPointerY) / viewport.zoom;

    if (!d.active) {
      const pxDelta = Math.hypot(e.clientX - d.startPointerX, e.clientY - d.startPointerY);
      if (pxDelta < DRAG_THRESHOLD_PX) return;
      setDrag({ ...d, active: true });
    }

    const nx = d.startX + dx;
    const ny = d.startY + dy;

    if (d.kind === 'card') {
      handlers.onCardMove(d.id, nx, ny);
      const { x: cx, y: cy } = screenToCanvas(e.clientX, e.clientY);
      const hoverZoneId = hitTestZone(cx, cy);
      if (hoverZoneId !== d.hoverZoneId) setDrag({ ...d, active: true, hoverZoneId });
    } else {
      handlers.onZoneMove(d.id, nx, ny);
    }
  }, [viewport.zoom, screenToCanvas, hitTestZone, handlers]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'card' && d.active) {
      const dx = (e.clientX - d.startPointerX) / viewport.zoom;
      const dy = (e.clientY - d.startPointerY) / viewport.zoom;
      handlers.onCardDrop(d.id, d.startX + dx, d.startY + dy, d.hoverZoneId);
    }
    setDrag(null);
  }, [viewport.zoom, handlers]);

  return {
    drag,
    startCardDrag,
    startZoneDrag,
    onPointerMove,
    onPointerUp,
  };
}
```

- [ ] **Step 2: Type-check & commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/office/v2/useOfficeDrag.ts
git commit -m "feat(office-v2): add useOfficeDrag hook (card + zone drag with threshold)"
```

---

### Task 13: Office canvas (SVG root + pan/zoom)

**Files:**
- Create: `src/components/office/v2/OfficeCanvas.tsx`
- Modify: `src/components/office/v2/OfficeView.css` (append)

- [ ] **Step 1: Implement canvas**

```tsx
// src/components/office/v2/OfficeCanvas.tsx
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { OfficeLayout, Viewport } from './officeTypes';
import { OfficeZone } from './OfficeZone';
import { OfficeBreakRoom } from './OfficeBreakRoom';
import { OfficeRoomCard } from './OfficeRoomCard';
import { useOfficeDrag } from './useOfficeDrag';
import type { TerminalInfo } from '../../../types';
import type { DuckViewModel } from './OfficeRoomCard';

interface Props {
  layout: OfficeLayout;
  terminals: TerminalInfo[];
  ducksByProject: Map<string, DuckViewModel[]>;
  doorPlateColorByProject: Map<string, string>;
  busyRatioByProject: Map<string, number>;
  countsByProject: Map<string, { busy: number; idle: number; dormant: number }>;
  onRoomMoved: (projectPath: string, x: number, y: number, zoneId: string | undefined) => void;
  onZoneMoved: (zoneId: string, x: number, y: number) => void;
  onBreakRoomMoved: (x: number, y: number) => void;
  onDuckClick: (agentId: string, e: React.MouseEvent) => void;
  onCardDoubleClick: (projectPath: string) => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

function OfficeCanvasImpl(props: Props) {
  const { layout, terminals, ducksByProject, doorPlateColorByProject, busyRatioByProject, countsByProject } = props;
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const drag = useOfficeDrag(viewport, layout.zones, {
    onCardMove: (projectPath, x, y) => {
      // optimistic visual move — OfficeView is not re-rendering per move; we write a temp layout on drop
      // For simplicity in v1, we defer visual feedback to drop.
      // (If a follow-up task needs per-move re-render, promote to useReducer in OfficeView.)
      props.onRoomMoved(projectPath, x, y, undefined);
    },
    onZoneMove: (zoneId, x, y) => props.onZoneMoved(zoneId, x, y),
    onCardDrop: (projectPath, x, y, zoneId) => props.onRoomMoved(projectPath, x, y, zoneId),
  });

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setViewport(v => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom + delta)) }));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Middle-click or space+drag = pan
    if (e.button === 1) {
      setPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
    }
  }, [viewport.panX, viewport.panY]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (panning && panStartRef.current) {
      setViewport(v => ({ ...v, panX: panStartRef.current!.panX + (e.clientX - panStartRef.current!.x), panY: panStartRef.current!.panY + (e.clientY - panStartRef.current!.y) }));
    } else {
      drag.onPointerMove(e);
    }
  }, [panning, drag]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setPanning(false);
    panStartRef.current = null;
    drag.onPointerUp(e);
  }, [drag]);

  // Cmd/Ctrl+1 zoom-to-fit — basic version
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        // naive: reset
        setViewport({ zoom: 0.8, panX: 50, panY: 50 });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setViewport({ zoom: 1, panX: 0, panY: 0 });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeTagIds = layout.activeTagIds;
  const hoverZoneId = drag.drag?.kind === 'card' ? drag.drag.hoverZoneId : undefined;
  const terminalByPath = new Map(terminals.map(t => [t.cwd, t]));

  return (
    <div
      className="office-canvas"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ cursor: panning ? 'grabbing' : 'default' }}
    >
      <svg className="office-canvas__svg">
        <g transform={`translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`}>
          {layout.zones.map(z => (
            <OfficeZone
              key={z.id}
              zone={z}
              hoverTarget={hoverZoneId === z.id}
              onLabelPointerDown={(zoneId, e) => drag.startZoneDrag(zoneId, z.x, z.y, e)}
            />
          ))}
          <OfficeBreakRoom x={layout.breakRoom.x} y={layout.breakRoom.y} />
        </g>
      </svg>

      <div
        className="office-canvas__cards"
        style={{ transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}
      >
        {layout.rooms.map(card => {
          const terminal = terminalByPath.get(card.projectPath);
          if (!terminal) return null;
          const ducks = ducksByProject.get(card.projectPath) ?? [];
          const dimmed = activeTagIds.length > 0 && !card.tagIds.some(id => activeTagIds.includes(id));
          return (
            <OfficeRoomCard
              key={card.projectPath}
              card={card}
              terminal={terminal}
              ducks={ducks}
              doorPlateColor={doorPlateColorByProject.get(card.projectPath) ?? '#6b7280'}
              busyRatio={busyRatioByProject.get(card.projectPath) ?? 0}
              counts={countsByProject.get(card.projectPath) ?? { busy: 0, idle: 0, dormant: 0 }}
              tags={layout.tags}
              dimmed={dimmed}
              onDragStart={(projectPath, e) => drag.startCardDrag(projectPath, card.x, card.y, e)}
              onDoubleClick={props.onCardDoubleClick}
              onDuckClick={props.onDuckClick}
            />
          );
        })}
      </div>
    </div>
  );
}

export const OfficeCanvas = memo(OfficeCanvasImpl);
```

- [ ] **Step 2: Append CSS**

```css
.office-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0f0f1a;
}

.office-canvas__svg,
.office-canvas__cards {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.office-canvas__cards {
  pointer-events: none;
}

.office-canvas__cards > * {
  pointer-events: auto;
}
```

- [ ] **Step 3: Type-check & commit**

```bash
git add src/components/office/v2/OfficeCanvas.tsx src/components/office/v2/OfficeView.css
git commit -m "feat(office-v2): add OfficeCanvas (SVG+HTML overlay pan/zoom)"
```

---

### Task 14: Root OfficeView + view-model selectors

**Files:**
- Create: `src/components/office/v2/OfficeView.tsx`
- Create: `src/components/office/v2/officeViewModels.ts`

- [ ] **Step 1: Write view-model selectors**

Port the session-dot and status aggregation logic from the v1 `OfficeView.tsx` into `officeViewModels.ts` as pure functions taking `terminals`, `sessions`, `chatLoadingMap`, `pendingQuestionsMap` as inputs and returning maps keyed by `projectPath`.

```ts
// src/components/office/v2/officeViewModels.ts
import { sessionDotColor } from './officeLayout';
import type { TerminalInfo } from '../../../types';
import type { DuckViewModel } from './OfficeRoomCard';

interface Inputs {
  terminals: TerminalInfo[];
  sessions: Record<string, { agentId: string; status?: string; lastAssistantCompleted?: boolean }>;
  chatLoadingMap: Record<string, boolean>;
  pendingQuestionsMap: Record<string, boolean>;
}

export function buildViewModels(inputs: Inputs) {
  const ducksByProject = new Map<string, DuckViewModel[]>();
  const doorPlateByProject = new Map<string, string>();
  const busyRatioByProject = new Map<string, number>();
  const countsByProject = new Map<string, { busy: number; idle: number; dormant: number }>();

  // Group terminals by cwd
  const byPath = new Map<string, TerminalInfo[]>();
  for (const t of inputs.terminals) {
    const arr = byPath.get(t.cwd) ?? [];
    arr.push(t);
    byPath.set(t.cwd, arr);
  }

  for (const [projectPath, agents] of byPath.entries()) {
    const ducks: DuckViewModel[] = [];
    let busy = 0, idle = 0, dormant = 0;
    let worstAwaiting = false, worstWorking = false, worstReady = false;

    for (const agent of agents) {
      // Gather sessions for this agent
      const agentSessions = Object.values(inputs.sessions).filter(s => s.agentId === agent.id);
      const sessionDots = agentSessions.slice(0, 5).map(s => ({
        awaiting: !!inputs.pendingQuestionsMap[`${agent.id}:${s.agentId}`],
        working: !!inputs.chatLoadingMap[agent.id],
        ready: s.lastAssistantCompleted === true,
      }));

      const isBusy = sessionDots.some(d => d.working);
      const isAwaiting = sessionDots.some(d => d.awaiting);
      const isReady = sessionDots.some(d => d.ready);

      const status: 'busy' | 'idle' | 'waiting' = isBusy ? 'busy' : isAwaiting ? 'waiting' : 'idle';
      if (isBusy) busy++; else if (agentSessions.length === 0) dormant++; else idle++;
      worstAwaiting = worstAwaiting || isAwaiting;
      worstWorking = worstWorking || isBusy;
      worstReady = worstReady || isReady;

      ducks.push({
        agentId: agent.id,
        color: agent.color,
        avatarUrl: agent.avatarUrl,
        initial: (agent.label?.[0] ?? '?').toUpperCase(),
        status,
        sessionDots,
      });
    }

    ducksByProject.set(projectPath, ducks);
    doorPlateByProject.set(projectPath, sessionDotColor({ awaiting: worstAwaiting, working: worstWorking, ready: worstReady }));
    busyRatioByProject.set(projectPath, agents.length ? busy / agents.length : 0);
    countsByProject.set(projectPath, { busy, idle, dormant });
  }

  return { ducksByProject, doorPlateByProject, busyRatioByProject, countsByProject };
}
```

> Note: the key shapes used by `pendingQuestionsMap` and `chatLoadingMap` in the actual project may differ — check `src/stores/chatStore.ts` before finalising. The shape above mirrors v1's `getSessionDotHex()` usage. If the real keys are different, adjust the lookups in `buildViewModels`.

- [ ] **Step 2: Write `OfficeView.tsx`**

```tsx
// src/components/office/v2/OfficeView.tsx
import { memo, useMemo, useState } from 'react';
import { useOfficeLayout } from './useOfficeLayout';
import { buildViewModels } from './officeViewModels';
import { OfficeCanvas } from './OfficeCanvas';
import { OfficeTagFilter } from './OfficeTagFilter';
import { OfficeActionMenu } from './OfficeActionMenu';
import { useSessionStore } from '../../../stores/sessionStore';
import { useChatStore } from '../../../stores/chatStore';
import type { TerminalInfo } from '../../../types';
import './OfficeView.css';

interface Props {
  terminals: TerminalInfo[];
  isActive: boolean;
  onSessionClick?: (sessionId: string) => void;
}

function OfficeViewImpl({ terminals, isActive, onSessionClick }: Props) {
  const { layout, setRoomPosition, setZonePosition, setBreakRoomPosition, toggleTag, ready } = useOfficeLayout(terminals);
  const sessions = useSessionStore(s => s.sessions);
  const chatLoadingMap = useChatStore(s => s.chatLoadingMap);
  const pendingQuestionsMap = useChatStore(s => s.pendingQuestionsMap);

  const viewModels = useMemo(
    () => buildViewModels({ terminals, sessions, chatLoadingMap, pendingQuestionsMap }),
    [terminals, sessions, chatLoadingMap, pendingQuestionsMap]
  );

  const [actionMenu, setActionMenu] = useState<{ agentId: string; x: number; y: number } | null>(null);

  if (!ready || !layout) {
    return <div className="office-view office-view--loading">Loading…</div>;
  }

  return (
    <div className="office-view" data-active={isActive}>
      <OfficeTagFilter tags={layout.tags} activeTagIds={layout.activeTagIds} onToggle={toggleTag} />

      <OfficeCanvas
        layout={layout}
        terminals={terminals}
        ducksByProject={viewModels.ducksByProject}
        doorPlateColorByProject={viewModels.doorPlateByProject}
        busyRatioByProject={viewModels.busyRatioByProject}
        countsByProject={viewModels.countsByProject}
        onRoomMoved={setRoomPosition}
        onZoneMoved={setZonePosition}
        onBreakRoomMoved={setBreakRoomPosition}
        onDuckClick={(agentId, e) => setActionMenu({ agentId, x: e.clientX, y: e.clientY })}
        onCardDoubleClick={(_projectPath) => {
          // P1: toast. P2: open OfficeFloorPlanOverlay.
          console.info('[office-v2] Floor plan overlay coming in v0.9.5');
        }}
      />

      {actionMenu && (
        <OfficeActionMenu
          agentId={actionMenu.agentId}
          x={actionMenu.x}
          y={actionMenu.y}
          onSessionClick={onSessionClick}
          onClose={() => setActionMenu(null)}
        />
      )}
    </div>
  );
}

export default memo(OfficeViewImpl);
```

> Note: check the prop shape of the ported `OfficeActionMenu` and adjust `{ agentId, x, y, onSessionClick, onClose }` to match. If v1 passes more props (e.g. `agentDotColors`), pass them through.

- [ ] **Step 3: Commit**

```bash
git add src/components/office/v2/OfficeView.tsx src/components/office/v2/officeViewModels.ts
git commit -m "feat(office-v2): add root OfficeView + view-model selectors"
```

---

### Task 15: Wire v2 into OfficeTabView behind the feature flag

**Files:**
- Modify: `src/views/OfficeTabView.tsx`

- [ ] **Step 1: Replace import to dispatch on flag**

Edit `src/views/OfficeTabView.tsx`:

```tsx
import { memo, useRef } from 'react';
import type { Tab } from '../components/TabBar';
import OfficeViewV1 from '../components/office/OfficeView';
import OfficeViewV2 from '../components/office/v2/OfficeView';
import { isOfficeV2Enabled } from '../components/office/v2/featureFlag';
import type { TerminalInfo } from '../types';

interface OfficeTabViewProps {
  tab: Tab;
  isActive: boolean;
  terminals: TerminalInfo[];
  onRoomClick?: (projectPath: string) => void;
  onDuckClick?: (agentId: string) => void;
  onSessionClick?: (sessionId: string) => void;
  onExitOffice?: () => void;
}

function OfficeTabView(props: OfficeTabViewProps) {
  const hasBeenActive = useRef(false);
  if (props.isActive) hasBeenActive.current = true;
  if (props.tab.type !== 'office') return null;
  if (!hasBeenActive.current) return null;

  if (isOfficeV2Enabled()) {
    return (
      <div className="office-tab-view" style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(!props.isActive ? { position: 'absolute' as const, inset: 0, opacity: 0, zIndex: -1, pointerEvents: 'none' as const } : {}),
      }}>
        <OfficeViewV2 terminals={props.terminals} isActive={props.isActive} onSessionClick={props.onSessionClick} />
      </div>
    );
  }

  return (
    <div className="office-tab-view" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      ...(!props.isActive ? { position: 'absolute' as const, inset: 0, opacity: 0, zIndex: -1, pointerEvents: 'none' as const } : {}),
    }}>
      <OfficeViewV1
        terminals={props.terminals}
        isActive={props.isActive}
        onRoomClick={props.onRoomClick}
        onDuckClick={props.onDuckClick}
        onSessionClick={props.onSessionClick}
        onExitOffice={props.onExitOffice}
      />
    </div>
  );
}

export default memo(OfficeTabView);
```

- [ ] **Step 2: Build + run dev**

```bash
npm run dev:mac
```

Open Quack → Office tab. Expect:
- v2 renders (default feature flag on) with zones + cards + ducks
- Drag a card → moves, persists (reload tab, position kept)
- Toggle a tag pill → matching cards stay, others dim
- Double-click card → console logs "Floor plan overlay coming in v0.9.5"
- Click duck → action menu shows, session click navigates to chat

If something breaks: set `localStorage.setItem('quack:forceOfficeV1', 'true')` in DevTools to revert to v1, debug, and iterate.

- [ ] **Step 3: Commit**

```bash
git add src/views/OfficeTabView.tsx
git commit -m "feat(office-v2): mount v2 behind OFFICE_V2_ENABLED flag (default on)"
```

---

### Task 16: Manual test checklist for P1 (no code)

- [ ] **Run through the following manually:**

1. Open Office tab on fresh install (no `office-layout.json`) — verify auto-migration creates zones from existing cwds.
2. Drag a card from one zone into another — verify `zoneId` updates; reload, verify persistence.
3. Drag a card outside any zone — verify `zoneId = undefined`, card floats.
4. Resize a zone (corner handle) — verify bounds persist.
5. Drag a zone label — verify child rooms follow.
6. Click a tag pill → verify non-matching rooms dim to 30%.
7. Click a second tag pill → both active; cards matching either stay vivid.
8. Click the same pill again → deactivates.
9. Double-click a card → toast/console log.
10. Click a duck → action menu appears; click a session → navigates to chat.
11. Scroll wheel zoom in/out; middle-click drag to pan; `Cmd+0` resets.
12. Close and reopen Office tab — verify full state restored.
13. Set `localStorage.quack:forceOfficeV1='true'`, reload — v1 renders.

All pass → P1 ready for diary entry and merge.

- [ ] **Diary entry**

Append to `documentation/diary/YYYY-MM-DD.md` (today):
```
- [HH:MM] (Alek) Office View v2 (P1): top-down floor plan with zones + cards + tag filter + drag shipped behind OFFICE_V2_ENABLED. v1 reachable via localStorage escape hatch. Auto-migration from terminal cwds on first load.
```

- [ ] **Commit diary**

```bash
git add documentation/diary/
git commit -m "docs(diary): office-v2 P1 shipped"
```

---

## Phase 2 — Floor Plan Overlay (P2)

### Task 17: Floor Plan Overlay

**Files:**
- Create: `src/components/office/v2/OfficeFloorPlanOverlay.tsx`
- Modify: `src/components/office/v2/OfficeView.tsx` (wire double-click)
- Modify: `src/components/office/v2/OfficeView.css` (append)

- [ ] **Step 1: Write overlay**

```tsx
// src/components/office/v2/OfficeFloorPlanOverlay.tsx
import { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TerminalInfo } from '../../../types';
import type { DuckViewModel } from './OfficeRoomCard';
import { OfficeDuckAvatar } from './OfficeDuckAvatar';

interface Props {
  terminal: TerminalInfo;
  ducks: DuckViewModel[];
  onClose: () => void;
  onDuckClick: (agentId: string, e: React.MouseEvent) => void;
}

function OfficeFloorPlanOverlayImpl({ terminal, ducks, onClose, onDuckClick }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const cols = Math.max(1, Math.ceil(Math.sqrt(ducks.length)));
  const DESK_W = 64, DESK_H = 40, GAP_X = 80, GAP_Y = 100, TOP_PAD = 80, LEFT_PAD = 60;

  return createPortal(
    <div className="office-floor-plan" onClick={onClose}>
      <div className="office-floor-plan__panel" onClick={e => e.stopPropagation()}>
        <header className="office-floor-plan__header">
          <div>
            <h2>{terminal.label}</h2>
            <div className="office-floor-plan__branch">{terminal.branch ?? 'main'}</div>
          </div>
          <button onClick={onClose} className="office-floor-plan__close" aria-label="Close">×</button>
        </header>

        <svg className="office-floor-plan__svg">
          {ducks.map((d, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const dx = LEFT_PAD + col * (DESK_W + GAP_X);
            const dy = TOP_PAD + row * (DESK_H + GAP_Y);
            return (
              <g key={d.agentId} transform={`translate(${dx}, ${dy})`}>
                <rect x={0} y={0} width={DESK_W} height={DESK_H} rx={4} fill="#14142a" stroke="#2a2a4a" />
                <text x={DESK_W / 2} y={DESK_H + 56} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={11}>{d.initial}</text>
                <foreignObject x={DESK_W / 2 - 18} y={DESK_H + 4} width={36} height={36}>
                  <OfficeDuckAvatar {...d} onClick={onDuckClick} />
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>
    </div>,
    document.body,
  );
}

export const OfficeFloorPlanOverlay = memo(OfficeFloorPlanOverlayImpl);
```

- [ ] **Step 2: Append CSS**

```css
.office-floor-plan {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: office-fp-fadein 0.15s ease;
}

@keyframes office-fp-fadein { from { opacity: 0 } to { opacity: 1 } }

.office-floor-plan__panel {
  width: min(1100px, 92vw);
  height: min(720px, 86vh);
  background: #0f0f1a;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.office-floor-plan__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.office-floor-plan__header h2 {
  margin: 0;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.95);
}

.office-floor-plan__branch {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.office-floor-plan__close {
  background: none;
  border: 0;
  color: rgba(255, 255, 255, 0.65);
  font-size: 24px;
  cursor: pointer;
}

.office-floor-plan__svg {
  flex: 1;
  width: 100%;
  background: #14142a;
}
```

- [ ] **Step 3: Wire double-click**

In `OfficeView.tsx`, replace the `onCardDoubleClick` console log with state:

```tsx
const [floorPlanProject, setFloorPlanProject] = useState<string | null>(null);

// ...
onCardDoubleClick={setFloorPlanProject}
// ...

{floorPlanProject && (() => {
  const terminal = terminals.find(t => t.cwd === floorPlanProject);
  if (!terminal) return null;
  return (
    <OfficeFloorPlanOverlay
      terminal={terminal}
      ducks={viewModels.ducksByProject.get(floorPlanProject) ?? []}
      onClose={() => setFloorPlanProject(null)}
      onDuckClick={(agentId, e) => setActionMenu({ agentId, x: e.clientX, y: e.clientY })}
    />
  );
})()}
```

- [ ] **Step 4: Manual test**

1. Double-click a card → overlay opens, desks + seated ducks visible.
2. Click a duck → action menu overlays the floor plan.
3. Esc → overlay closes, action menu stays if open.
4. Click outside panel → overlay closes.
5. Break Room card double-click → for now, renders overlay with empty SVG. Extending Break-Room-specific layout is tracked as a follow-up: add a `BreakRoomFloorPlan.tsx` variant in Task 17b if user requests.

- [ ] **Step 5: Commit**

```bash
git add src/components/office/v2/OfficeFloorPlanOverlay.tsx src/components/office/v2/OfficeView.{tsx,css}
git commit -m "feat(office-v2): add Floor Plan Overlay on card double-click (P2)"
```

---

## Phase 3 — Cleanup (P3)

### Task 18: Remove v1 PixiJS code

**Files deleted:**
- `src/components/office/OfficeScene.tsx`
- `src/components/office/OfficeRoom.tsx`
- `src/components/office/OfficeDuck.tsx`
- `src/components/office/OfficeBreakRoom.tsx`
- `src/components/office/OfficeRoomLabel.tsx`
- `src/components/office/OfficeBreakRoomLabel.tsx`
- `src/components/office/OfficeTooltip.tsx`
- `src/components/office/OfficeView.tsx`
- `src/components/office/OfficeView.css`
- `src/components/office/officeLayout.ts`
- `src/components/office/officeTypes.ts`
- `src/components/office/useAvatarTexture.ts`

**File kept:**
- `src/components/office/OfficeActionMenu.tsx` — v1 reference; compare with v2 copy and delete v1's version if v2 is feature-equivalent. Otherwise leave and tackle in a follow-up.

- [ ] **Step 1: Delete files**

```bash
cd /Users/alekdob/Desktop/Dev/Personal/quack-app
git rm src/components/office/OfficeScene.tsx \
       src/components/office/OfficeRoom.tsx \
       src/components/office/OfficeDuck.tsx \
       src/components/office/OfficeBreakRoom.tsx \
       src/components/office/OfficeRoomLabel.tsx \
       src/components/office/OfficeBreakRoomLabel.tsx \
       src/components/office/OfficeTooltip.tsx \
       src/components/office/OfficeView.tsx \
       src/components/office/OfficeView.css \
       src/components/office/officeLayout.ts \
       src/components/office/officeTypes.ts \
       src/components/office/useAvatarTexture.ts
```

- [ ] **Step 2: Remove v1 from `OfficeTabView.tsx`**

Edit `src/views/OfficeTabView.tsx` to drop the v1 branch:

```tsx
import { memo, useRef } from 'react';
import type { Tab } from '../components/TabBar';
import OfficeView from '../components/office/v2/OfficeView';
import type { TerminalInfo } from '../types';

interface OfficeTabViewProps {
  tab: Tab;
  isActive: boolean;
  terminals: TerminalInfo[];
  onSessionClick?: (sessionId: string) => void;
}

function OfficeTabView({ tab, isActive, terminals, onSessionClick }: OfficeTabViewProps) {
  const hasBeenActive = useRef(false);
  if (isActive) hasBeenActive.current = true;
  if (tab.type !== 'office') return null;
  if (!hasBeenActive.current) return null;

  return (
    <div className="office-tab-view" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      ...(!isActive ? { position: 'absolute' as const, inset: 0, opacity: 0, zIndex: -1, pointerEvents: 'none' as const } : {}),
    }}>
      <OfficeView terminals={terminals} isActive={isActive} onSessionClick={onSessionClick} />
    </div>
  );
}

export default memo(OfficeTabView);
```

Fix the call site in `App.tsx`: remove `onRoomClick`, `onDuckClick`, `onExitOffice` props that no longer exist. Run:

```bash
grep -n "OfficeTabView" src/App.tsx
```

Edit the JSX to match the new signature.

- [ ] **Step 3: Remove v2 feature flag + escape hatch**

Delete `src/components/office/v2/featureFlag.ts`, remove the import from `OfficeTabView.tsx` (already done above), remove references from `src/components/office/v2/index.ts`.

- [ ] **Step 4: Build + manual smoke test**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

Run `npm run dev:mac` and verify Office tab still works.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(office-v2): delete v1 PixiJS implementation (P3 cleanup)"
```

---

### Task 19: Remove PixiJS dependencies

**Files modified:**
- `package.json`
- `package-lock.json` (auto)
- `src/components/office/v2/` (no more PixiJS imports expected, but double-check)
- `src/main.tsx` (remove `import 'pixi.js/unsafe-eval'` if present)

- [ ] **Step 1: Verify zero PixiJS imports**

```bash
grep -rn "pixi\.js\|@pixi/react" src/ --include="*.ts" --include="*.tsx"
```

Expected: no matches (only match possible is in `src/main.tsx` for the unsafe-eval polyfill).

- [ ] **Step 2: Remove the unsafe-eval polyfill**

If `src/main.tsx` has `import 'pixi.js/unsafe-eval';` at the top, delete it.

- [ ] **Step 3: Remove deps**

```bash
npm uninstall pixi.js @pixi/react
```

- [ ] **Step 4: Build + smoke test**

```bash
npm run build
npm run dev:mac
```

Verify Office works. Check the bundle size:

```bash
npm run build:size
```

Expected: smaller main bundle (PixiJS ~500KB gzipped removed).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.tsx
git commit -m "chore(office-v2): remove pixi.js + @pixi/react deps (~500KB bundle reduction)"
```

---

### Task 20: Archive gotcha docs + update feature doc

**Files:**
- Modify: `documentation/features/045-office-view.md` (replace with v2 spec)
- Modify: `documentation/gotchas/gotcha-pixi-csp-unsafe-eval.md` (mark archived)
- Modify: `CLAUDE.md` (remove line referencing `pixi-csp-unsafe-eval` if no longer relevant)

- [ ] **Step 1: Rewrite `documentation/features/045-office-view.md`**

Replace the entire content with the v2 feature doc, derived from the spec file. Use the spec `docs/superpowers/specs/2026-04-22-office-view-top-down-design.md` as source — copy key sections (Goal, Stack, Files table, Data Flow, Constants, Interactions) in the project's standard feature-doc frontmatter format:

```yaml
---
type: feature-doc
project: quack-app
stack: React 18 + TypeScript strict + SVG + HTML/CSS
created: 2026-04-06
last_verified: 2026-04-22
tags: [office, top-down, zones, cards, tags, floor-plan, drag, svg, v2]
---
```

Include the final file table showing `src/components/office/v2/*` and mention "v1 PixiJS implementation removed in v0.9.6".

- [ ] **Step 2: Mark gotcha as archived**

Prepend to `documentation/gotchas/gotcha-pixi-csp-unsafe-eval.md`:

```markdown
> **Archived (2026-04-22):** PixiJS was removed from Office View v2. This gotcha no longer applies to any active code path. Left here for historical reference only.
```

- [ ] **Step 3: Clean up CLAUDE.md references**

Remove the `- PixiJS CSP black screen: documentation/gotchas/gotcha-pixi-csp-unsafe-eval.md` line from the critical gotchas list (it's archived now).

- [ ] **Step 4: Commit**

```bash
git add documentation/ CLAUDE.md
git commit -m "docs(office-v2): update feature doc, archive PixiJS gotcha, clean CLAUDE.md"
```

- [ ] **Step 5: Final diary entry**

Append to today's diary:

```
- [HH:MM] (Alek) Office View v2 P3 complete: PixiJS fully removed. Bundle -500KB gzipped. CSP unsafe-eval polyfill and destroy patch retired. Feature doc + CLAUDE.md updated.
```

Commit:

```bash
git add documentation/diary/
git commit -m "docs(diary): office-v2 P3 cleanup complete"
```

---

## Self-Review Checklist

1. **Spec coverage**
   - ✓ Data model — Task 1
   - ✓ Pure layout math — Task 2
   - ✓ Storage — Task 3
   - ✓ Auto-migration — Task 4
   - ✓ State hook — Task 5
   - ✓ Duck avatar — Task 6
   - ✓ Room card — Task 7
   - ✓ Zone — Task 8
   - ✓ Break Room — Task 9
   - ✓ Tag filter — Task 10
   - ✓ Action menu port — Task 11
   - ✓ Drag hook — Task 12
   - ✓ Canvas — Task 13
   - ✓ Root OfficeView + view models — Task 14
   - ✓ Feature flag wiring — Task 15
   - ✓ P1 manual QA — Task 16
   - ✓ Floor Plan Overlay — Task 17
   - ✓ v1 deletion — Task 18
   - ✓ Dep removal — Task 19
   - ✓ Docs update — Task 20

2. **Placeholders**: scanned — the notes in Tasks 11 and 14 point the engineer to check the real shape of ported v1 files / Zustand store keys. These are pointers, not placeholders for missing code. Every step that changes code includes the code. OK.

3. **Type consistency**: `OfficeLayout`, `OfficeRoomCard`, `OfficeZone`, `OfficeTag`, `Viewport`, `DuckViewModel` names used consistently from Task 1 → Task 17. Hook names `useOfficeLayout`, `useOfficeDrag` consistent. Constants (`CARD_DEFAULT_W`, `WRITE_DEBOUNCE_MS`, `DRAG_THRESHOLD_PX`) imported from `officeConstants` throughout. OK.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-office-view-top-down.md`.
