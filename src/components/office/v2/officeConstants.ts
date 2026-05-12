export const CARD_DEFAULT_W = 220;
export const CARD_DEFAULT_H = 140;
export const FLOOR_PLAN_OVERLAY_MAX_W = 1100;
export const FLOOR_PLAN_OVERLAY_MAX_H = 720;
export const DRAG_THRESHOLD_PX = 4;
export const WRITE_DEBOUNCE_MS = 500;

export const GRID_COLS = 4;
export const GRID_GAP = 20;
export const GRID_ORIGIN_X = 40;
export const GRID_ORIGIN_Y = 40;

export const POSTIT_DEFAULT_W = 160;
export const POSTIT_DEFAULT_H = 120;
export const POSTIT_COLORS = [
  '#fde68a', // yellow
  '#fca5a5', // red
  '#a7f3d0', // green
  '#bfdbfe', // blue
  '#ddd6fe', // purple
  '#fbcfe8', // pink
];

export const GROUP_DEFAULT_COLOR = '#94a3b8';
export const GROUP_MIN_W = 160;
export const GROUP_MIN_H = 120;

export const STICKER_MIN_SIZE = 32;

export const TEXT_DEFAULT_FONT = 22;
export const TEXT_DEFAULT_TEXT = 'Title';
export const TEXT_MIN_FONT = 10;
export const TEXT_MAX_FONT = 64;

export const UNDO_STACK_MAX = 50;

export const TAG_PALETTE = [
  '#c084fc', // purple
  '#00D9FF', // cyan
  '#F7931E', // orange
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#94a3b8', // slate
];

export const DEFAULT_TAGS: Array<{ id: string; label: string; color: string }> = [
  { id: 'personal', label: 'Personal', color: '#c084fc' },
  { id: 'cc', label: 'C&C', color: '#00D9FF' },
  { id: 'consulting', label: 'Consulting', color: '#F7931E' },
  { id: 'other', label: 'Other', color: '#94a3b8' },
];
export const LAYOUT_FILE_NAME = 'office-layout.json';
