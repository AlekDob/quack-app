// Project-root Works storage — git-trackable tickets, stories, cycles index.
// Legacy paths: `.quack/works/` and `.codetta/works/` migrate on first access.

import { fs } from "./ipc";
import { joinPath } from "./pathUtils";
import { LEGACY_QUACK_DIR, QUACK_DIR } from "./quackDir";

export const WORKS_DIR = "works";

const LEGACY_PREFIXES = [
  `${QUACK_DIR}/works`,
  `${LEGACY_QUACK_DIR}/works`,
];

export function worksRel(...parts: string[]): string {
  return parts.length ? joinPath(WORKS_DIR, ...parts) : WORKS_DIR;
}

export function worksAbs(root: string, ...parts: string[]): string {
  return joinPath(root, worksRel(...parts));
}

/** Rewrite stored relative paths from legacy hidden dirs → `works/`. */
export function rewriteLegacyWorksPath(rel: string): string {
  for (const prefix of LEGACY_PREFIXES) {
    const withSlash = `${prefix}/`;
    if (rel === prefix) return WORKS_DIR;
    if (rel.startsWith(withSlash)) {
      const tail = rel.slice(withSlash.length);
      return tail ? worksRel(tail) : WORKS_DIR;
    }
  }
  return rel;
}

async function moveDirIfNeeded(from: string, to: string): Promise<boolean> {
  if (await fs.exists(to)) return false;
  if (!(await fs.exists(from))) return false;
  await fs.createDir(joinPath(to, ".."));
  await fs.rename(from, to);
  return true;
}

/** Move `.quack/works` or `.codetta/works` → `works/` when only legacy exists. */
export async function migrateLegacyWorksWorkspace(root: string): Promise<void> {
  const modern = worksAbs(root);
  if (await fs.exists(modern)) return;
  const quack = joinPath(root, QUACK_DIR, "works");
  const codetta = joinPath(root, LEGACY_QUACK_DIR, "works");
  if (await moveDirIfNeeded(quack, modern)) return;
  await moveDirIfNeeded(codetta, modern);
}

export function isWorksPath(absOrRel: string): boolean {
  const norm = absOrRel.replace(/\\/g, "/").toLowerCase();
  return LEGACY_PREFIXES.some((p) => norm.includes(`/${p}`)) || norm.includes(`/${WORKS_DIR}/`);
}
