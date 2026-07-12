// Disk sync for work item markdown files — hydrate, migrate, watch reload.

import { fs } from "./ipc";
import { joinPath, basename } from "./pathUtils";
import {
  blocksToBodyMd,
  parseWorkItemMd,
  serializeWorkItemMd,
  workItemRelPath,
  WORKS_ITEMS_DIR,
} from "./workItemMd";
import {
  bumpSeq,
  moduleByFeatureSlug,
  newId,
  type WorkItem,
  type WorksSnapshot,
} from "./works";

const pendingWrites = new Set<string>();

export function markWorkWrite(absPath: string): void {
  pendingWrites.add(absPath.toLowerCase());
  window.setTimeout(() => pendingWrites.delete(absPath.toLowerCase()), 600);
}

export function isPendingWorkWrite(absPath: string): boolean {
  return pendingWrites.has(absPath.toLowerCase());
}

export async function ensureWorksDirs(root: string): Promise<void> {
  await fs.createDir(joinPath(root, ".codetta", "works"));
  await fs.createDir(joinPath(root, WORKS_ITEMS_DIR));
}

export function slimSnapshot(snap: WorksSnapshot): WorksSnapshot {
  const items = snap.items.map((w) => {
    const { bodyMd: _b, descriptionBlocks: _d, ...rest } = w as WorkItem & {
      descriptionBlocks?: unknown;
    };
    return {
      ...rest,
      filePath: rest.filePath || workItemRelPath(rest.shortId),
    };
  });
  return { ...snap, version: 2, items };
}

function labelIdsFromNames(snap: WorksSnapshot, names: string[]): string[] {
  return names.flatMap((name) => {
    const hit = snap.labels.find((l) => l.name === name);
    return hit ? [hit.id] : [];
  });
}

function moduleIdFromSlug(snap: WorksSnapshot, slug?: string): string | undefined {
  if (!slug) return undefined;
  const bare = slug.replace(/^feat:/, "");
  const mod = moduleByFeatureSlug(snap, bare);
  if (mod) return mod.id;
  return snap.modules.find((m) => m.id === slug)?.id;
}

export async function writeWorkItemFile(
  root: string,
  item: WorkItem,
  snap: WorksSnapshot,
): Promise<void> {
  await ensureWorksDirs(root);
  const rel = item.filePath || workItemRelPath(item.shortId);
  const abs = joinPath(root, rel);
  const body = item.bodyMd ?? "";
  const content = serializeWorkItemMd(item, snap, body);
  markWorkWrite(abs);
  await fs.writeFile(abs, content);
}

export async function deleteWorkItemFile(root: string, item: WorkItem): Promise<void> {
  const rel = item.filePath || workItemRelPath(item.shortId);
  const abs = joinPath(root, rel);
  if (await fs.exists(abs)) await fs.delete(abs);
}

export async function hydrateItemFromFile(
  root: string,
  item: WorkItem,
  snap: WorksSnapshot,
): Promise<WorkItem> {
  const rel = item.filePath || workItemRelPath(item.shortId);
  const abs = joinPath(root, rel);
  if (!(await fs.exists(abs))) {
    return { ...item, filePath: rel, bodyMd: item.bodyMd ?? "" };
  }
  const src = await fs.readFile(abs);
  const parsed = parseWorkItemMd(src, snap);
  if (!parsed) return { ...item, filePath: rel, bodyMd: item.bodyMd ?? "" };
  const moduleId = moduleIdFromSlug(snap, parsed.moduleSlug) ?? item.moduleId;
  return {
    ...item,
    filePath: rel,
    title: parsed.title || item.title,
    status: parsed.status ?? item.status,
    priority: parsed.priority ?? item.priority,
    origin: parsed.origin ?? item.origin,
    moduleId,
    labelIds: parsed.labelNames.length
      ? labelIdsFromNames(snap, parsed.labelNames)
      : item.labelIds,
    startDate: parsed.startDate ?? item.startDate,
    targetDate: parsed.targetDate ?? item.targetDate,
    linkedChatIds: parsed.linkedChatIds.length
      ? parsed.linkedChatIds
      : item.linkedChatIds,
    planApprovedAt: parsed.planApprovedAt ?? item.planApprovedAt,
    planeIssueId: parsed.planeIssueId ?? item.planeIssueId,
    parentId: parsed.parentId ?? item.parentId,
    cycleId: parsed.cycleId ?? item.cycleId,
    createdAt: parsed.createdAt ?? item.createdAt,
    updatedAt: parsed.updatedAt ?? item.updatedAt,
    bodyMd: parsed.bodyMd,
  };
}

export async function loadAllItemBodies(
  root: string,
  snap: WorksSnapshot,
): Promise<WorksSnapshot> {
  const items = await Promise.all(
    snap.items.map((w) => hydrateItemFromFile(root, w, snap)),
  );
  return { ...snap, items };
}

export async function migrateV1ItemsToMd(
  root: string,
  snap: WorksSnapshot,
): Promise<{ snap: WorksSnapshot; changed: boolean }> {
  let changed = false;
  const items: WorkItem[] = [];
  for (const raw of snap.items) {
    const w = raw as WorkItem & { descriptionBlocks?: WorkItem["descriptionBlocks"] };
    const filePath = w.filePath || workItemRelPath(w.shortId);
    const abs = joinPath(root, filePath);
    let bodyMd = w.bodyMd ?? "";
    if (!bodyMd && w.descriptionBlocks?.length) {
      bodyMd = blocksToBodyMd(w.descriptionBlocks);
      changed = true;
    }
    const item: WorkItem = {
      ...w,
      filePath,
      bodyMd,
    };
    if (!(await fs.exists(abs))) {
      await writeWorkItemFile(root, item, snap);
      changed = true;
    }
    items.push(item);
  }
  if (snap.version !== 2) changed = true;
  return { snap: { ...snap, version: 2, items }, changed };
}

export async function importOrphanMdFiles(
  root: string,
  snap: WorksSnapshot,
): Promise<{ snap: WorksSnapshot; changed: boolean }> {
  const dir = joinPath(root, WORKS_ITEMS_DIR);
  if (!(await fs.exists(dir))) return { snap, changed: false };
  let entries: Awaited<ReturnType<typeof fs.listDir>>;
  try {
    entries = await fs.listDir(dir);
  } catch {
    return { snap, changed: false };
  }
  const known = new Set(snap.items.map((w) => w.shortId.toUpperCase()));
  let changed = false;
  const items = [...snap.items];
  for (const ent of entries) {
    if (ent.is_dir || !ent.name.endsWith(".md")) continue;
    const shortId = basename(ent.name).replace(/\.md$/i, "");
    if (known.has(shortId.toUpperCase())) continue;
    const src = await fs.readFile(ent.path);
    const parsed = parseWorkItemMd(src, snap);
    if (!parsed) continue;
    const now = Date.now();
    const moduleId =
      moduleIdFromSlug(snap, parsed.moduleSlug) ?? snap.modules[0]?.id ?? "";
    const item: WorkItem = {
      id: parsed.id ?? newId(),
      shortId: parsed.shortId ?? shortId,
      filePath: workItemRelPath(parsed.shortId ?? shortId),
      moduleId,
      title: parsed.title,
      origin: parsed.origin ?? "agent",
      bodyMd: parsed.bodyMd,
      status: parsed.status ?? "todo",
      priority: parsed.priority ?? "medium",
      labelIds: labelIdsFromNames(snap, parsed.labelNames),
      linkedChatIds: parsed.linkedChatIds,
      comments: [],
      createdAt: parsed.createdAt ?? now,
      updatedAt: parsed.updatedAt ?? now,
      startDate: parsed.startDate,
      targetDate: parsed.targetDate,
      planApprovedAt: parsed.planApprovedAt,
      planeIssueId: parsed.planeIssueId,
      parentId: parsed.parentId,
      cycleId: parsed.cycleId,
    };
    items.push(item);
    known.add(item.shortId.toUpperCase());
    changed = true;
  }
  if (!changed) return { snap, changed: false };
  return { snap: bumpSeq({ ...snap, items }), changed: true };
}

export async function reloadWorkItemFromPath(
  root: string,
  snap: WorksSnapshot,
  absPath: string,
): Promise<WorksSnapshot | null> {
  if (isPendingWorkWrite(absPath)) return null;
  const rel = absPath.replace(root.replace(/\\/g, "/").replace(/\/+$/, "") + "/", "");
  const shortId = basename(absPath).replace(/\.md$/i, "");
  const hit = snap.items.find(
    (w) =>
      w.shortId.toUpperCase() === shortId.toUpperCase() ||
      w.filePath === rel,
  );
  if (!hit) {
    const { snap: next, changed } = await importOrphanMdFiles(root, snap);
    return changed ? next : null;
  }
  const nextItem = await hydrateItemFromFile(root, hit, snap);
  return {
    ...snap,
    items: snap.items.map((w) => (w.id === hit.id ? nextItem : w)),
  };
}

export function findWorkByFilePath(
  snap: WorksSnapshot,
  relPath: string,
): WorkItem | undefined {
  return snap.items.find((w) => w.filePath === relPath);
}
