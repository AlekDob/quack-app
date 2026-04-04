/**
 * Feature Map — Annotation types (post-its, group rectangles, images)
 */

export type AnnotationMode = 'select' | 'lasso' | 'postit' | 'group' | 'image';

export interface PostIt {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  parentComponentId?: string;
}

export interface GroupRect {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  isComponent?: boolean;
  parentComponentId?: string;
}

export interface CanvasImage {
  id: string;
  src: string;   // relative path: "images/screenshot.png"
  x: number;
  y: number;
  w: number;
  h: number;
  parentComponentId?: string;
}

/** Navigation state for nested components (ephemeral, not persisted) */
export interface ComponentNavigation {
  currentComponentId: string | null;
  breadcrumb: Array<{ id: string; label: string }>;
}

/** Lasso selection rectangle (ephemeral) */
export interface LassoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasAnnotations {
  postIts: PostIt[];
  groups: GroupRect[];
  images: CanvasImage[];
}

/** File-based whiteboard state (replaces localStorage) */
export interface WhiteboardFile {
  version: 1;
  annotations: CanvasAnnotations;
  positions: Record<string, { x: number; y: number }>;
}

export const POST_IT_COLORS = ['#fbbf24', '#4ade80', '#f472b6', '#60a5fa', '#c084fc', '#fb923c'];
export const GROUP_COLORS = ['#00d9ff', '#a855f7', '#f97316', '#22c55e', '#ef4444', '#64748b'];

export const POST_IT_W = 160;
export const POST_IT_H = 100;
export const GROUP_MIN_W = 100;
export const GROUP_MIN_H = 80;
export const IMAGE_DEFAULT_W = 240;
export const IMAGE_DEFAULT_H = 160;
