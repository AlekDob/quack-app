// Sync Works modules from documentation/features/*.md — one module per feature doc.

import { fs, type DirEntry } from "./ipc";
import { joinPath } from "./pathUtils";
import {
  DEFAULT_MODULES,
  newId,
  type WorkModule,
  type WorksSnapshot,
} from "./works";

export const FEATURE_DIR = "documentation/features";

export function moduleIdForSlug(slug: string): string {
  return `feat:${slug}`;
}

export function parseFeatureNum(slug: string): number | undefined {
  const m = slug.match(/^(\d{3})-/);
  return m ? Number.parseInt(m[1]!, 10) : undefined;
}

export function parseFeatureTitle(head: string, slug: string): string {
  for (const raw of head.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("# ")) return line.slice(2).trim();
  }
  for (const raw of head.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) return line.slice(3).trim();
  }
  const tail = slug.match(/^\d{3}-(.+)$/);
  if (tail) return tail[1]!.replace(/-/g, " ");
  return slug;
}

function fallbackModules(snap: WorksSnapshot): {
  snap: WorksSnapshot;
  changed: boolean;
} {
  if (snap.modules.length > 0) return { snap, changed: false };
  const modules = DEFAULT_MODULES.map((m) => ({ ...m, id: newId() }));
  return { snap: { ...snap, modules }, changed: true };
}

function repairItemModules(
  snap: WorksSnapshot,
  modules: WorkModule[],
): { items: WorksSnapshot["items"]; changed: boolean } {
  const valid = new Set(modules.map((m) => m.id));
  const fallback = modules[0];
  if (!fallback) return { items: snap.items, changed: false };
  let changed = false;
  const items = snap.items.map((w) => {
    if (!w.moduleId) return w;
    if (valid.has(w.moduleId)) return w;
    changed = true;
    return { ...w, moduleId: fallback.id };
  });
  return { items, changed };
}

async function listFeatureFiles(dir: string): Promise<DirEntry[]> {
  if (!(await fs.exists(dir))) return [];
  return (await fs.listDir(dir)).filter(
    (e) => !e.is_dir && e.name.endsWith(".md"),
  );
}

async function featureModuleFromEntry(
  e: DirEntry,
): Promise<Omit<WorkModule, "id">> {
  const slug = e.name.replace(/\.md$/i, "");
  let title = slug;
  try {
    const head = (await fs.readFile(e.path)).slice(0, 1200);
    title = parseFeatureTitle(head, slug);
  } catch {
    /* keep slug-derived title */
  }
  return {
    name: title,
    featureSlug: slug,
    featurePath: `${FEATURE_DIR}/${e.name}`,
    featureNum: parseFeatureNum(slug),
  };
}

/** Build modules from feature docs; fall back to DEFAULT_MODULES when none exist. */
export async function syncFeatureModules(
  root: string,
  snap: WorksSnapshot,
): Promise<{ snap: WorksSnapshot; changed: boolean }> {
  const dir = joinPath(root, FEATURE_DIR);
  let entries: DirEntry[];
  try {
    entries = await listFeatureFiles(dir);
  } catch {
    return fallbackModules(snap);
  }
  if (entries.length === 0) return fallbackModules(snap);

  const defs = await Promise.all(entries.map(featureModuleFromEntry));
  defs.sort(
    (a, b) =>
      (a.featureNum ?? 9999) - (b.featureNum ?? 9999) ||
      (a.featureSlug ?? "").localeCompare(b.featureSlug ?? ""),
  );

  const prevBySlug = new Map(
    snap.modules
      .filter((m) => m.featureSlug)
      .map((m) => [m.featureSlug!, m]),
  );
  let changed = false;
  const modules: WorkModule[] = defs.map((d) => {
    const prev = prevBySlug.get(d.featureSlug!);
    const id = prev?.id ?? moduleIdForSlug(d.featureSlug!);
    const next: WorkModule = { id, ...d };
    if (
      !prev ||
      prev.name !== next.name ||
      prev.featurePath !== next.featurePath ||
      prev.featureNum !== next.featureNum
    ) {
      changed = true;
    }
    return next;
  });

  const legacy = snap.modules.filter(
    (m) =>
      !m.featureSlug && snap.items.some((w) => w.moduleId === m.id),
  );
  if (legacy.length > 0) modules.push(...legacy);

  const { items, changed: itemsChanged } = repairItemModules(snap, modules);
  if (itemsChanged) changed = true;

  const sameLen = modules.length === snap.modules.length;
  const sameIds =
    sameLen && modules.every((m, i) => m.id === snap.modules[i]?.id);
  if (!changed && sameIds && items === snap.items) return { snap, changed: false };

  return { snap: { ...snap, modules, items }, changed: true };
}
