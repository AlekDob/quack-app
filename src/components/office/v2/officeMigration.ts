import type { OfficeLayout, OfficeRoomCard, OfficeTag } from './officeTypes';
import { inferTagFromPath, packRoomsInGrid } from './officeLayout';
import { DEFAULT_TAGS } from './officeConstants';
import type { TerminalInfo } from '../../../types';

function uniqueProjectPaths(terminals: TerminalInfo[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terminals) {
    if (seen.has(t.cwd)) continue;
    seen.add(t.cwd);
    out.push(t.cwd);
  }
  return out;
}

function buildTagsFromProjects(projectPaths: string[]): OfficeTag[] {
  const tagIds = new Set<string>();
  for (const cwd of projectPaths) tagIds.add(inferTagFromPath(cwd));
  return DEFAULT_TAGS
    .filter(t => tagIds.has(t.id))
    .map(t => ({ ...t, source: 'auto' as const }));
}

export function bootstrapLayoutFromTerminals(terminals: TerminalInfo[]): OfficeLayout {
  const projectPaths = uniqueProjectPaths(terminals);
  const rooms: OfficeRoomCard[] = projectPaths.map(cwd => ({
    projectPath: cwd,
    x: 0,
    y: 0,
    tagIds: [inferTagFromPath(cwd)],
  }));

  return {
    version: 2,
    rooms: packRoomsInGrid(rooms),
    tags: buildTagsFromProjects(projectPaths),
    activeTagIds: [],
    customGroups: [],
    postIts: [],
    stickers: [],
  };
}

/**
 * Accepts v1 or v2 persisted JSON and normalises to v2.
 * Drops `zones` and `breakRoom` from v1 (decision: 2026-04-22).
 */
export function normaliseLayout(raw: unknown): OfficeLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const version = r.version;
  if (version !== 1 && version !== 2) return null;

  const roomsIn = Array.isArray(r.rooms) ? r.rooms as Record<string, unknown>[] : [];
  const rooms: OfficeRoomCard[] = roomsIn
    .filter(r => typeof r.projectPath === 'string')
    .map(r => ({
      projectPath: r.projectPath as string,
      x: typeof r.x === 'number' ? r.x : 0,
      y: typeof r.y === 'number' ? r.y : 0,
      w: typeof r.w === 'number' ? r.w : undefined,
      h: typeof r.h === 'number' ? r.h : undefined,
      tagIds: Array.isArray(r.tagIds) ? (r.tagIds as unknown[]).filter(x => typeof x === 'string') as string[] : [],
    }));

  const tagsIn = Array.isArray(r.tags) ? r.tags as Record<string, unknown>[] : [];
  const tags: OfficeTag[] = tagsIn
    .filter(t => typeof t.id === 'string' && typeof t.label === 'string' && typeof t.color === 'string')
    .map(t => ({
      id: t.id as string,
      label: t.label as string,
      color: t.color as string,
      source: (t.source === 'manual' ? 'manual' : 'auto'),
    }));

  const activeTagIds = Array.isArray(r.activeTagIds)
    ? (r.activeTagIds as unknown[]).filter(x => typeof x === 'string') as string[]
    : [];

  const customGroups = Array.isArray(r.customGroups) ? r.customGroups as OfficeLayout['customGroups'] : [];
  const postIts = Array.isArray(r.postIts) ? r.postIts as OfficeLayout['postIts'] : [];
  const stickers = Array.isArray(r.stickers) ? r.stickers as OfficeLayout['stickers'] : [];

  return {
    version: 2,
    rooms,
    tags,
    activeTagIds,
    customGroups,
    postIts,
    stickers,
  };
}

export function reconcileLayoutWithTerminals(layout: OfficeLayout, terminals: TerminalInfo[]): OfficeLayout {
  const dedupedExisting: OfficeRoomCard[] = [];
  const seenExisting = new Set<string>();
  for (const r of layout.rooms) {
    if (seenExisting.has(r.projectPath)) continue;
    seenExisting.add(r.projectPath);
    dedupedExisting.push(r);
  }

  const existingPaths = new Set(dedupedExisting.map(r => r.projectPath));
  const newRooms: OfficeRoomCard[] = [...dedupedExisting];
  const toAdd: OfficeRoomCard[] = [];

  for (const cwd of uniqueProjectPaths(terminals)) {
    if (existingPaths.has(cwd)) continue;
    toAdd.push({
      projectPath: cwd,
      x: 0,
      y: 0,
      tagIds: [inferTagFromPath(cwd)],
    });
  }

  if (toAdd.length > 0) {
    const packedFresh = packRoomsInGrid([...toAdd]);
    const maxY = newRooms.length > 0
      ? Math.max(...newRooms.map(r => r.y))
      : 0;
    const offsetY = newRooms.length > 0 ? maxY + 160 : 0;
    for (const r of packedFresh) {
      r.y += offsetY;
      newRooms.push(r);
    }
  }

  const tags = layout.tags.length > 0 ? layout.tags : buildTagsFromProjects(uniqueProjectPaths(terminals));

  return { ...layout, rooms: newRooms, tags };
}
