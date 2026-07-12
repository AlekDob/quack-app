// Avatar for a custom preset. Defaults to the same deterministic duck pool
// subagents use (zero extra work); an optional upload persists a durable
// copy in the workspace (`.quack/avatars/`) — unlike the chat image
// attachment pipeline, which writes to the OS temp dir and isn't meant to
// survive indefinitely.
import { fs } from "../ipc";
import { duckAvatarFor } from "../subagents";
import { encode, loadImage, scaleToCanvas, stripDataUrl } from "../imageAttach";
import { migrateLegacyQuackSubpath, quackAbs } from "../quackDir";

const AVATAR_MAX_EDGE = 256;

export function defaultPresetAvatar(id: string): string {
  return duckAvatarFor(id);
}

function avatarsDir(root: string): string {
  return quackAbs(root, "avatars");
}

/**
 * Compress an image (any decodable src — file path data URL, blob URL) and
 * persist it under the workspace's `.quack/avatars/` so it survives
 * restarts. Returns the absolute path to use as the preset's `avatar`.
 */
export async function uploadPresetAvatar(
  root: string,
  presetSlug: string,
  src: string,
): Promise<string> {
  await migrateLegacyQuackSubpath(root, "avatars");
  const img = await loadImage(src);
  const { dataUrl, ext } = encode(scaleToCanvas(img, AVATAR_MAX_EDGE), 0.85);
  return fs.savePersistentImage(
    avatarsDir(root),
    `${presetSlug}.${ext}`,
    stripDataUrl(dataUrl),
  );
}

/** Compress + persist an avatar picked via a native file dialog (on-disk path). */
export async function uploadPresetAvatarFromPath(
  root: string,
  presetSlug: string,
  path: string,
): Promise<string> {
  const dataUrl = await fs.readImageDataUrl(path);
  return uploadPresetAvatar(root, presetSlug, dataUrl);
}
