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
  rooms: OfficeRoomCard[];  // one per project currently in terminals (reconciled on every mount)
  tags: OfficeTag[];
  activeTagIds: string[];
  breakRoom: { x: number; y: number };
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}
