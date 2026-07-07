export const MERMAID_ZOOM_MIN = 0.2;
export const MERMAID_ZOOM_MAX = 5;
export const MERMAID_ZOOM_DEFAULT = 1;
export const MERMAID_ZOOM_BTN = 1.2;

export function clampMermaidZoom(scale: number): number {
  return Math.min(MERMAID_ZOOM_MAX, Math.max(MERMAID_ZOOM_MIN, scale));
}

export function wheelMermaidZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.002);
}

/** Keep the pointer anchor fixed while changing zoom on a scrollable viewport. */
export function scrollForZoom(
  viewport: HTMLElement,
  clientX: number,
  clientY: number,
  oldScale: number,
  newScale: number,
): void {
  const rect = viewport.getBoundingClientRect();
  const mx = clientX - rect.left + viewport.scrollLeft;
  const my = clientY - rect.top + viewport.scrollTop;
  const ratio = newScale / oldScale;
  viewport.scrollLeft = mx * ratio - (clientX - rect.left);
  viewport.scrollTop = my * ratio - (clientY - rect.top);
}

export function formatMermaidZoom(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
