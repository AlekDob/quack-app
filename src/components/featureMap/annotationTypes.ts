/**
 * Feature Map — Annotation types (post-its, group rectangles, images)
 */

export type AnnotationMode = 'select' | 'lasso' | 'postit' | 'group' | 'image' | 'mdcard' | 'text';

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

/**
 * Markdown Preview Card — renders rich markdown content inline on the canvas.
 * Supports inline markdown (content) OR file reference (filePath).
 * If filePath ends with .mmd, the file is rendered as a Mermaid diagram.
 * Heptabase-style: first-class whiteboard element, not a fat post-it.
 */
export interface MdCard {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Inline markdown content (mutually exclusive with filePath) */
  content?: string;
  /** Relative path to .md or .mmd file from project root (mutually exclusive with content) */
  filePath?: string;
  /** Optional title override. If omitted, falls back to first H1 or file name */
  title?: string;
  /** Collapsed state — shows only title bar */
  collapsed?: boolean;
  parentComponentId?: string;
}

/** Free-form title/heading text on the whiteboard canvas */
export interface CanvasText {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
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
  mdCards: MdCard[];
  texts?: CanvasText[];
}

/** File-based whiteboard state (replaces localStorage) */
export interface WhiteboardFile {
  version: 1;
  annotations: CanvasAnnotations;
  positions: Record<string, { x: number; y: number }>;
  /** Maps feature node IDs to component IDs (for nesting nodes inside components) */
  nodeAssignments?: Record<string, string>;
}

export const POST_IT_COLORS = ['#fbbf24', '#4ade80', '#f472b6', '#60a5fa', '#c084fc', '#fb923c'];
export const GROUP_COLORS = ['#00d9ff', '#a855f7', '#f97316', '#22c55e', '#ef4444', '#64748b'];

export const POST_IT_W = 160;
export const POST_IT_H = 100;
export const GROUP_MIN_W = 100;
export const GROUP_MIN_H = 80;
export const IMAGE_DEFAULT_W = 240;
export const IMAGE_DEFAULT_H = 160;
export const MD_CARD_DEFAULT_W = 400;
export const MD_CARD_DEFAULT_H = 300;
export const MD_CARD_MIN_W = 200;
export const MD_CARD_MIN_H = 120;
export const MD_CARD_COLLAPSED_H = 36;

export const TEXT_DEFAULT_FONT = 24;
export const TEXT_DEFAULT_TEXT = 'Title';
export const TEXT_MIN_FONT = 10;
export const TEXT_MAX_FONT = 72;
