// src/components/office/v2/officeMigration.ts
import type { OfficeLayout, OfficeRoomCard, OfficeTag, OfficeZone } from './officeTypes';
import { inferTagFromPath, defaultZonePositions, packRoomsInZone } from './officeLayout';
import { DEFAULT_TAGS } from './officeConstants';
import type { TerminalInfo } from '../../../types';

function buildRoomsForZone(zone: OfficeZone, terminals: TerminalInfo[], tagByProject: Map<string, string>): OfficeRoomCard[] {
  const projectsInZone = terminals.filter(t => tagByProject.get(t.cwd) === zone.tagId);
  const unpacked = projectsInZone.map<OfficeRoomCard>(t => ({
    projectPath: t.cwd,
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
