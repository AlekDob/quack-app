import { fs, type DirEntry } from "./ipc";
import { pathsEqual } from "./fsBus";
import { dirname } from "./pathUtils";
import { fuzzyMatch, normalizeFilterQuery } from "./fuzzyMatch";
import { isHeavyDir } from "./heavyDirs";

export interface TreeFilter {
  visiblePaths: Set<string>;
  matchPaths: Set<string>;
}

function entryMatchesFilter(query: string, name: string): boolean {
  // Match on the entry name only — never the full relative path. A path
  // like apps/client/.../trailing-slash.md can subsequence-match
  // unrelated queries ("schools") by stitching letters across segments.
  return fuzzyMatch(query, name);
}

async function listDirSafe(path: string): Promise<DirEntry[]> {
  try {
    return await fs.listDir(path);
  } catch {
    return [];
  }
}

function addAncestors(visible: Set<string>, path: string, root: string): void {
  visible.add(path);
  let cur = dirname(path);
  while (cur.length >= root.length) {
    visible.add(cur);
    if (pathsEqual(cur, root)) break;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
}

async function addDescendants(visible: Set<string>, dir: string): Promise<void> {
  const entries = await listDirSafe(dir);
  for (const e of entries) {
    visible.add(e.path);
    if (e.is_dir && !isHeavyDir(e.name)) {
      await addDescendants(visible, e.path);
    }
  }
}

/** Fuzzy-filter the workspace tree; matches keep ancestor folders visible. */
export async function buildTreeFilter(
  root: string,
  query: string,
): Promise<TreeFilter> {
  const q = normalizeFilterQuery(query);
  const visiblePaths = new Set<string>();
  const matchPaths = new Set<string>();
  if (!q) return { visiblePaths, matchPaths };

  const walk = async (dir: string): Promise<void> => {
    const entries = await listDirSafe(dir);
    for (const e of entries) {
      const matches = entryMatchesFilter(q, e.name);
      if (matches) {
        matchPaths.add(e.path);
        addAncestors(visiblePaths, e.path, root);
        if (e.is_dir) await addDescendants(visiblePaths, e.path);
      }
      if (e.is_dir && !isHeavyDir(e.name)) {
        await walk(e.path);
      }
    }
  };

  await walk(root);
  return { visiblePaths, matchPaths };
}

/** Collect every expandable directory under root (heavy dirs skipped). */
export async function collectAllDirs(root: string): Promise<string[]> {
  const dirs: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await listDirSafe(dir);
    for (const e of entries) {
      if (!e.is_dir || isHeavyDir(e.name)) continue;
      dirs.push(e.path);
      await walk(e.path);
    }
  };
  await walk(root);
  return dirs;
}
