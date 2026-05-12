export type TagSource = 'auto' | 'manual';

export interface OfficeTag {
  id: string;
  label: string;
  color: string;
  source: TagSource;
}

export interface OfficeRoomCard {
  projectPath: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  tagIds: string[];
}

export interface OfficeCustomGroup {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}

export interface OfficePostIt {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
}

export interface OfficeSticker {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  kind: string;
}

/** Free-form title/heading annotation on the office canvas */
export interface OfficeText {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number; // px, defaults to TEXT_DEFAULT_FONT
}

export interface OfficeLayout {
  version: 2;
  rooms: OfficeRoomCard[];
  tags: OfficeTag[];
  activeTagIds: string[];
  customGroups: OfficeCustomGroup[];
  postIts: OfficePostIt[];
  stickers: OfficeSticker[];
  texts: OfficeText[];
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}
