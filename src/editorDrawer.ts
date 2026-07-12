/** Right-edge drop strip width (px) inside `.editor-area`. */
export const EDITOR_DRAWER_ZONE_PX = 56;

/** Default drawer width as a fraction of the viewport. */
export const EDITOR_DRAWER_VW = 0.75;
export const EDITOR_DRAWER_MAX_VW = 0.95;

export const MIN_EDITOR_DRAWER_W = 320;

/** @deprecated use defaultEditorDrawerW() */
export const DEFAULT_EDITOR_DRAWER_W = 960;

export function maxEditorDrawerW(): number {
  if (typeof window === "undefined") return 1400;
  return Math.round(window.innerWidth * EDITOR_DRAWER_MAX_VW);
}

export function defaultEditorDrawerW(): number {
  if (typeof window === "undefined") return DEFAULT_EDITOR_DRAWER_W;
  return clampEditorDrawerW(Math.round(window.innerWidth * EDITOR_DRAWER_VW));
}

export function clampEditorDrawerW(w: number): number {
  const max = maxEditorDrawerW();
  return Math.max(MIN_EDITOR_DRAWER_W, Math.min(max, w));
}

export const EDITOR_DRAWER_ANIM_MS = 280;

export function isEditorDrawerDropZone(clientX: number, wsId: string): boolean {
  const area = document.querySelector(
    `.shell[data-ws-id="${CSS.escape(wsId)}"] .editor-area`,
  ) as HTMLElement | null;
  if (!area) return false;
  const rect = area.getBoundingClientRect();
  return clientX >= rect.right - EDITOR_DRAWER_ZONE_PX;
}
