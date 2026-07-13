export const MERMAID_ZOOM_MIN = 0.2;
export const MERMAID_ZOOM_MAX = 5;
export const MERMAID_ZOOM_DEFAULT = 1;
export const MERMAID_ZOOM_BTN = 1.2;
export const MERMAID_STAGE_PADDING = 48;

export type MermaidBaseSize = { w: number; h: number };

export function clampMermaidZoom(scale: number): number {
  return Math.min(MERMAID_ZOOM_MAX, Math.max(MERMAID_ZOOM_MIN, scale));
}

/** Trackpad pinch (ctrl+wheel) — tuned for macOS pixel deltas. */
export function wheelMermaidZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.006);
}

export function readMermaidSvgSize(svg: SVGSVGElement): MermaidBaseSize | null {
  const vb = svg.viewBox.baseVal;
  if (vb.width > 0 && vb.height > 0) {
    return { w: vb.width, h: vb.height };
  }
  const bbox = svg.getBBox();
  if (bbox.width > 0 && bbox.height > 0) {
    return { w: bbox.width, h: bbox.height };
  }
  return null;
}

/** Mermaid often emits width="100%" which collapses in a shrink-to-fit parent. */
export function normalizeMermaidSvg(svg: SVGSVGElement): MermaidBaseSize | null {
  const size = readMermaidSvgSize(svg);
  if (!size) return null;
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.width = `${size.w}px`;
  svg.style.height = `${size.h}px`;
  svg.style.maxWidth = "none";
  return size;
}

/** Scroll extents = scaled layout box; transform lives on the inner stage only. */
export function syncMermaidScrollSizer(
  sizer: HTMLDivElement | null,
  stage: HTMLDivElement | null,
  base: MermaidBaseSize | null,
  scale: number,
  padding = MERMAID_STAGE_PADDING,
): void {
  if (!sizer || !stage || !base) return;
  const layoutW = base.w + padding;
  const layoutH = base.h + padding;
  stage.style.width = `${layoutW}px`;
  stage.style.height = `${layoutH}px`;
  sizer.style.width = `${layoutW * scale}px`;
  sizer.style.height = `${layoutH * scale}px`;
}

export function fitMermaidScale(
  viewport: HTMLElement,
  base: MermaidBaseSize,
  padding = MERMAID_STAGE_PADDING,
): number {
  const rect = viewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return MERMAID_ZOOM_DEFAULT;
  const layoutW = base.w + padding;
  const layoutH = base.h + padding;
  const fit = Math.min(rect.width / layoutW, rect.height / layoutH);
  if (fit >= MERMAID_ZOOM_DEFAULT) return MERMAID_ZOOM_DEFAULT;
  return clampMermaidZoom(fit);
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
