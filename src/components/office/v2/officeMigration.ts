// src/components/office/v2/officeMigration.ts
import type { OfficeLayout, OfficeRoomCard, OfficeTag, OfficeZone } from './officeTypes';
import { inferTagFromPath, defaultZonePositions, packRoomsInZone } from './officeLayout';
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

function buildRoomsForZone(zone: OfficeZone, terminals: TerminalInfo[], tagByProject: Map<string, string>): OfficeRoomCard[] {
  const projectPaths = uniqueProjectPaths(terminals).filter(cwd => tagByProject.get(cwd) === zone.tagId);
  const unpacked = projectPaths.map<OfficeRoomCard>(cwd => ({
    projectPath: cwd,
    x: 0,
    y: 0,
    zoneId: zone.id,
    tagIds: zone.tagId ? [zone.tagId] : [],
  }));
  return packRoomsInZone(zone, unpacked);
}

export function bootstrapLayoutFromTerminals(terminals: TerminalInfo[]): OfficeLayout {
  const tagIds = new Set<string>();
  const tagByProject = new Map<string, string>();

  for (const t of terminals) {
    const tag = inferTagFromPath(t.cwd);
    tagIds.add(tag);
    tagByProject.set(t.cwd, tag);
  }

  const zones = defaultZonePositions([...tagIds]);

  const rooms: OfficeRoomCard[] = [];
  for (const zone of zones) {
    rooms.push(...buildRoomsForZone(zone, terminals, tagByProject));
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
  const dedupedExisting: OfficeRoomCard[] = [];
  const seenExisting = new Set<string>();
  for (const r of layout.rooms) {
    if (seenExisting.has(r.projectPath)) continue;
    seenExisting.add(r.projectPath);
    dedupedExisting.push(r);
  }

  const existingPaths = new Set(dedupedExisting.map(r => r.projectPath));
  const newRooms: OfficeRoomCard[] = [...dedupedExisting];
  const addedPaths = new Set<string>();

  for (const cwd of uniqueProjectPaths(terminals)) {
    if (existingPaths.has(cwd) || addedPaths.has(cwd)) continue;
    addedPaths.add(cwd);

    const tag = inferTagFromPath(cwd);
    const zone = layout.zones.find(z => z.tagId === tag);
    const card: OfficeRoomCard = {
      projectPath: cwd,
      x: 0,
      y: 0,
      zoneId: zone?.id,
      tagIds: [tag],
    };

    if (zone) {
      const otherInZone = newRooms.filter(r => r.zoneId === zone.id);
      const packed = packRoomsInZone(zone, [...otherInZone, card]);
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
