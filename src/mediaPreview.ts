// Media files we render as a read-only preview tab instead of feeding to
// Monaco (which rejects binary content). Raster images + PDF only — SVG
// stays a normal text buffer so its source can still be edited.
//
// `session-transcript` is the synthetic kind for the Usage panel: clicks
// on a session row open a virtual tab whose path follows the convention
// `<project>-<session-id>.jsonl-view` and resolves to a lazy chunked
// loader (see SessionTranscriptPane) instead of a real file.
export type MediaKind = "image" | "pdf" | "session-transcript";

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

/** Build the synthetic tab path for a Claude Code session transcript. */
export function sessionTranscriptPath(project: string, sessionId: string): string {
  // Encode the project label so the path is filesystem-safe even when it
  // contains characters that would otherwise confuse a "fake" file path.
  // We don't write this anywhere; it's just a stable key that survives
  // Quack restarts and round-trips through the existing tab system.
  const safeLabel = project.replace(/[^A-Za-z0-9._-]/g, "_");
  return `session://${safeLabel}.${sessionId}.jsonl-view`;
}

/** Reverse of sessionTranscriptPath — returns null if path doesn't match. */
export function parseSessionTranscriptPath(
  path: string,
): { project: string; sessionId: string } | null {
  const m = path.match(/^session:\/\/([^.]+)\.([0-9a-f-]{36})\.jsonl-view$/);
  if (!m) return null;
  // Caller doesn't currently need the original (encoded) project label —
  // we pass the raw encoded path into the Rust command, which knows how
  // to map it back to the real on-disk directory.
  return { project: m[1], sessionId: m[2] };
}

/** Classify a path for preview, or null when it's a normal editable file. */
export function mediaKindOf(path: string): MediaKind | null {
  if (path.startsWith("session://") && path.endsWith(".jsonl-view")) {
    return "session-transcript";
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTS.has(ext)) return "image";
  return null;
}
