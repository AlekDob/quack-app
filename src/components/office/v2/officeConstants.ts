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
