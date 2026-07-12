// Hidden workspace folder for Quack-owned data (works, presets, rules, …).
// Pre-rebrand installs used `.codetta/` — migrated on first access.

import { fs } from "./ipc";
import { joinPath } from "./pathUtils";

export const QUACK_DIR = ".quack";
export const LEGACY_QUACK_DIR = ".codetta";

export function quackRel(...parts: string[]): string {
  return parts.length ? joinPath(QUACK_DIR, ...parts) : QUACK_DIR;
}

export function quackAbs(root: string, ...parts: string[]): string {
  return joinPath(root, quackRel(...parts));
}

/** `.codetta/foo` → `.quack/foo` in stored relative paths. */
export function rewriteLegacyQuackPath(rel: string): string {
  const prefix = `${LEGACY_QUACK_DIR}/`;
  if (rel === LEGACY_QUACK_DIR || rel.startsWith(prefix)) {
    const tail = rel === LEGACY_QUACK_DIR ? "" : rel.slice(prefix.length);
    return tail ? quackRel(tail) : QUACK_DIR;
  }
  return rel;
}

/** Move `.codetta/<subpath>/` → `.quack/<subpath>/` when only legacy exists. */
export async function migrateLegacyQuackSubpath(
  root: string,
  subpath: string,
): Promise<boolean> {
  const legacy = joinPath(root, LEGACY_QUACK_DIR, subpath);
  const modern = quackAbs(root, subpath);
  if (await fs.exists(modern)) return false;
  if (!(await fs.exists(legacy))) return false;
  await fs.createDir(quackAbs(root));
  await fs.rename(legacy, modern);
  return true;
}

/** Move `.codetta/<file>` → `.quack/<file>` when only legacy exists. */
export async function migrateLegacyQuackFile(
  root: string,
  fileName: string,
): Promise<boolean> {
  const legacy = joinPath(root, LEGACY_QUACK_DIR, fileName);
  const modern = quackAbs(root, fileName);
  if (await fs.exists(modern)) return false;
  if (!(await fs.exists(legacy))) return false;
  await fs.createDir(quackAbs(root));
  await fs.rename(legacy, modern);
  return true;
}

/** Migrate all known Quack workspace paths from `.codetta` → `.quack`. */
export async function migrateLegacyQuackWorkspace(root: string): Promise<void> {
  await migrateLegacyQuackSubpath(root, "presets");
  await migrateLegacyQuackSubpath(root, "avatars");
  await migrateLegacyQuackFile(root, "whiteboard.md");
  await migrateLegacyQuackFile(root, "rules.md");
}
