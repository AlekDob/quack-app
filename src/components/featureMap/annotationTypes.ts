/**
 * Feature Map — Annotation types (post-its + group rectangles)
 */

export type AnnotationMode = 'select' | 'postit' | 'group';

export interface PostIt {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export interface GroupRect {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface CanvasAnnotations {
  postIts: PostIt[];
  groups: GroupRect[];
}

export const POST_IT_COLORS = ['#fbbf24', '#4ade80', '#f472b6', '#60a5fa', '#c084fc', '#fb923c'];
export const GROUP_COLORS = ['#00d9ff', '#a855f7', '#f97316', '#22c55e', '#ef4444', '#64748b'];

export const POST_IT_W = 160;
export const POST_IT_H = 100;
export const GROUP_MIN_W = 100;
export const GROUP_MIN_H = 80;
