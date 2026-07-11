// Image attachments for the AI chat (Claude Code "Strada A"): the user
// pastes (Cmd+V) or drops an image, we compress it client-side, persist
// the bytes to a temp dir via Rust, and inline the on-disk path into the
// prompt so Claude Code reads it back with its Read tool. We keep full
// bytes OUT of localStorage — only a tiny thumbnail rides along for the
// inline preview; the zoom modal fetches full quality from disk on demand.

import { fs } from "./ipc";

export interface ImageAttachment {
  /** Stable id for React keys + removal. */
  id: string;
  /** Absolute path on disk (Claude Code reads this). */
  path: string;
  /** Original-ish filename, shown on hover. */
  name: string;
  /** Small data: URL (~320px) for the inline/composer preview. */
  thumb: string;
}

/** Max images per message — keeps prompts (and disk) sane. */
export const MAX_ATTACHED_IMAGES = 10;

/** Agentic providers that accept composer image attachments. */
export const IMAGE_ATTACH_PROVIDER_IDS = [
  "claude-code",
  "cursor-cli",
  "opencode-cli",
] as const;

export type ImageAttachProviderId = (typeof IMAGE_ATTACH_PROVIDER_IDS)[number];

export function providerAcceptsImages(providerId: string): providerId is ImageAttachProviderId {
  return (IMAGE_ATTACH_PROVIDER_IDS as readonly string[]).includes(providerId);
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

/** MIME type for a saved attachment path. */
export function mimeForImagePath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "image/png";
}

/** file:// URL for OpenCode FilePartInput. */
export function fileUrlForImagePath(path: string): string {
  return path.startsWith("file://") ? path : `file://${path}`;
}

// Anthropic vision sweet-spot: beyond ~1568px the long edge adds tokens
// without adding usable detail, so we cap there. Thumbnails are far
// smaller — they only feed the preview chip.
const MAX_FULL_EDGE = 1568;
const MAX_THUMB_EDGE = 320;
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];

/** True for paths/names that look like a raster image we can attach. */
export function isImagePath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTS.includes(ext);
}

/** Load any image src (object URL or data: URL) into a decoded element. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

/** Draw `img` onto a canvas scaled to fit `maxEdge`, return its 2D context. */
function scaleToCanvas(img: HTMLImageElement, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Prefer WebP (smaller, keeps alpha, supported by Claude Code + WKWebView);
// fall back to JPEG when the runtime can't encode WebP.
function encode(canvas: HTMLCanvasElement, quality: number): { dataUrl: string; ext: string } {
  const webp = canvas.toDataURL("image/webp", quality);
  if (webp.startsWith("data:image/webp")) return { dataUrl: webp, ext: "webp" };
  return { dataUrl: canvas.toDataURL("image/jpeg", quality), ext: "jpg" };
}

/** Strip the `data:...;base64,` prefix so Rust gets raw base64. */
function stripDataUrl(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function randomId(): string {
  return "img_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Compress an image (given any decodable `src`), persist the full-size
 * version to disk, and return an attachment with a tiny preview thumbnail.
 */
export async function compressAndSave(
  src: string,
  name: string,
): Promise<ImageAttachment> {
  const img = await loadImage(src);
  const full = encode(scaleToCanvas(img, MAX_FULL_EDGE), 0.82);
  const thumb = encode(scaleToCanvas(img, MAX_THUMB_EDGE), 0.7);
  const id = randomId();
  // Drop any existing extension so we don't end up with "image.png.jpg"
  // after re-encoding — the on-disk format is whatever `encode` picked.
  const base = (name || "image").replace(/\.[^./\\]+$/, "");
  const safeName = base.replace(/[^\w.\-]+/g, "_") || "image";
  const path = await fs.saveImageAttachment(
    `${id}_${safeName}.${full.ext}`,
    stripDataUrl(full.dataUrl),
  );
  return { id, path, name: name || "image", thumb: thumb.dataUrl };
}

/** Compress + save from a clipboard/file Blob (Cmd+V path). */
export async function attachFromBlob(blob: Blob, name: string): Promise<ImageAttachment> {
  const url = URL.createObjectURL(blob);
  try {
    return await compressAndSave(url, name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Compress + save from a file already on disk (Finder drag path). */
export async function attachFromPath(path: string): Promise<ImageAttachment> {
  const dataUrl = await fs.readImageDataUrl(path);
  const name = path.split(/[\\/]/).pop() ?? "image";
  return compressAndSave(dataUrl, name);
}

/** Rebuild preview thumb for a draft image already on disk. */
export async function rehydrateAttachment(meta: {
  id: string;
  path: string;
  name: string;
}): Promise<ImageAttachment | null> {
  try {
    const dataUrl = await fs.readImageDataUrl(meta.path);
    const img = await loadImage(dataUrl);
    const thumb = encode(scaleToCanvas(img, MAX_THUMB_EDGE), 0.7);
    return { id: meta.id, path: meta.path, name: meta.name, thumb: thumb.dataUrl };
  } catch {
    return null;
  }
}

// ── Drop routing ──────────────────────────────────────────────────────
// The window-level Tauri drag-drop listener lives in App.tsx and opens
// dropped files as editor tabs. The active chat panel registers its
// drop-zone rect + handler here so App.tsx can route image drops that
// land over the chat to the composer INSTEAD of opening them as tabs.

interface ChatDropZone {
  getRect: () => DOMRect | null;
  onPaths: (paths: string[]) => void;
}
let activeDropZone: ChatDropZone | null = null;

/** Called by the chat panel on mount; returns an unregister fn. */
export function registerChatDropZone(zone: ChatDropZone): () => void {
  activeDropZone = zone;
  return () => {
    if (activeDropZone === zone) activeDropZone = null;
  };
}

/**
 * If `physPos` (Tauri physical pixels) lands over the registered chat
 * drop-zone and `paths` includes images, hand the image paths to the
 * chat and return true so the caller skips its open-as-tab behaviour.
 */
export function tryRouteDropToChat(
  paths: string[],
  physPos: { x: number; y: number } | undefined,
): boolean {
  if (!activeDropZone || !physPos) return false;
  const rect = activeDropZone.getRect();
  if (!rect) return false;
  const dpr = window.devicePixelRatio || 1;
  const x = physPos.x / dpr;
  const y = physPos.y / dpr;
  const inside =
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  if (!inside) return false;
  const images = paths.filter(isImagePath);
  if (images.length === 0) return false;
  activeDropZone.onPaths(images);
  return true;
}
