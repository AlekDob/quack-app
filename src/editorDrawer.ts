/** Right-edge drop strip width (px) inside `.editor-area`. */
export const EDITOR_DRAWER_ZONE_PX = 56;

export const DEFAULT_EDITOR_DRAWER_W = 480;
export const MIN_EDITOR_DRAWER_W = 280;
export const MAX_EDITOR_DRAWER_W = 900;

export function clampEditorDrawerW(w: number): number {
  return Math.max(MIN_EDITOR_DRAWER_W, Math.min(MAX_EDITOR_DRAWER_W, w));
}

export function isEditorDrawerDropZone(clientX: number, wsId: string): boolean {
  const area = document.querySelector(
    `.shell[data-ws-id="${CSS.escape(wsId)}"] .editor-area`,
  ) as HTMLElement | null;
  if (!area) return false;
  const rect = area.getBoundingClientRect();
  return clientX >= rect.right - EDITOR_DRAWER_ZONE_PX;
}
