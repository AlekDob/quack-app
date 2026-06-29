// Media files we render as a read-only preview tab instead of feeding to
// Monaco (which rejects binary content). Raster images + PDF only — SVG
// stays a normal text buffer so its source can still be edited.
export type MediaKind = "image" | "pdf";

// Raster image extensions handled by the in-tab preview. SVG is excluded
// on purpose: it's editable XML and developers expect to open its source.
const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "ico",
  "avif",
]);

/** Classify a path for preview, or null when it's a normal editable file. */
export function mediaKindOf(path: string): MediaKind | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTS.has(ext)) return "image";
  return null;
}
