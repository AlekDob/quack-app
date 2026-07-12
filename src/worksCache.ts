import { invoke } from "@tauri-apps/api/core";
import {
  bumpSeq,
  emptySnapshot,
  findWork,
  moduleByFeatureSlug,
  moduleByName,
  newId,
  nextShortId,
  normalizeWorksSnapshot,
  planTextToBlocks,
  type WorkComment,
  type WorkItem,
  type WorkOrigin,
  type WorkPriority,
  type WorksSnapshot,
  type WorkStatus,
} from "./works";
import { syncFeatureModules } from "./worksFeatureModules";
import { refreshAllWorkProgress } from "./workProgressStore";
import { closeWorkDrawer, getWorkDrawer } from "./workDrawer";

type Listener = (snap: WorksSnapshot) => void;

interface WsWorks {
  root: string;
  snapshot: WorksSnapshot;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  listeners: Set<Listener>;
}

const byRoot = new Map<string, WsWorks>();

function cacheKey(root: string): string {
  return root;
}

function getEntry(root: string): WsWorks {
  const k = cacheKey(root);
  let e = byRoot.get(k);
  if (!e) {
    e = {
      root,
      snapshot: emptySnapshot(),
      hydrated: false,
      hydrating: null,
      listeners: new Set(),
    };
    byRoot.set(k, e);
  }
  return e;
}

function notify(e: WsWorks): void {
  for (const fn of e.listeners) fn(e.snapshot);
}

function isSnapshot(v: unknown): v is WorksSnapshot {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && Array.isArray(o.items) && Array.isArray(o.modules);
}

async function persist(root: string, snap: WorksSnapshot): Promise<void> {
  await invoke("works_save", { wsRoot: root, snapshot: snap });
}

async function appendEvent(root: string, event: Record<string, unknown>): Promise<void> {
  await invoke("works_append_event", {
    wsRoot: root,
    event: { ...event, at: Date.now() },
  });
}

export async function hydrateWorks(root: string): Promise<WorksSnapshot> {
  const e = getEntry(root);
  if (e.hydrated) return e.snapshot;
  if (e.hydrating) return e.hydrating.then(() => e.snapshot);
  e.hydrating = (async () => {
    const raw = await invoke<unknown>("works_load", { wsRoot: root });
    const loaded = isSnapshot(raw) ? raw : emptySnapshot();
    const { snap: normalized, changed: labelsChanged } =
      normalizeWorksSnapshot(loaded);
    const { snap, changed: modulesChanged } = await syncFeatureModules(
      root,
      normalized,
    );
    e.snapshot = snap;
    e.hydrated = true;
    e.hydrating = null;
    if (labelsChanged || modulesChanged) await persist(root, snap);
    notify(e);
  })();
  await e.hydrating;
  return e.snapshot;
}

export async function refreshWorksModules(root: string): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) {
    await hydrateWorks(root);
    return;
  }
  const { snap, changed } = await syncFeatureModules(root, e.snapshot);
  if (changed) await saveWorks(root, snap);
}

export function getWorksSnapshot(root: string): WorksSnapshot | null {
  const e = byRoot.get(cacheKey(root));
  return e?.hydrated ? e.snapshot : null;
}

export function subscribeWorks(root: string, fn: Listener): () => void {
  const e = getEntry(root);
  e.listeners.add(fn);
  return () => e.listeners.delete(fn);
}

export async function saveWorks(
  root: string,
  snap: WorksSnapshot,
): Promise<void> {
  const e = getEntry(root);
  e.snapshot = snap;
  e.hydrated = true;
  await persist(root, snap);
  notify(e);
  refreshAllWorkProgress(snap);
}

function patchItem(
  snap: WorksSnapshot,
  id: string,
  patch: Partial<WorkItem>,
): WorksSnapshot {
  return {
    ...snap,
    items: snap.items.map((w) =>
      w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w,
    ),
  };
}

export async function createWorkItem(
  root: string,
  opts: {
    title: string;
    origin: WorkOrigin;
    moduleName?: string;
    featureSlug?: string;
    priority?: WorkPriority;
    status?: WorkStatus;
    blocks?: WorkItem["descriptionBlocks"];
    labelNames?: string[];
  },
): Promise<WorkItem> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  let snap = e.snapshot;
  const mod =
    (opts.featureSlug
      ? moduleByFeatureSlug(snap, opts.featureSlug)
      : undefined) ??
    moduleByName(
      snap,
      opts.moduleName ?? (opts.origin === "hotfix" ? "Bug" : "Feature"),
    ) ??
    snap.modules[0];
  const labelIds = (opts.labelNames ?? []).flatMap((name) => {
    const hit = snap.labels.find((l) => l.name === name);
    return hit ? [hit.id] : [];
  });
  if (opts.origin === "hotfix") {
    const hot = snap.labels.find((l) => l.name === "hotfix");
    if (hot && !labelIds.includes(hot.id)) labelIds.push(hot.id);
  }
  const now = Date.now();
  const item: WorkItem = {
    id: newId(),
    shortId: nextShortId(snap),
    moduleId: mod?.id ?? snap.modules[0]?.id ?? "",
    title: opts.title.trim() || "Untitled work",
    origin: opts.origin,
    descriptionBlocks: opts.blocks ?? [],
    status: opts.status ?? (opts.origin === "plan" ? "backlog" : "todo"),
    priority: opts.priority ?? (opts.origin === "hotfix" ? "urgent" : "medium"),
    labelIds,
    linkedChatIds: [],
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
  snap = bumpSeq({ ...snap, items: [...snap.items, item] });
  await saveWorks(root, snap);
  await appendEvent(root, { kind: "work_create", workId: item.id, origin: opts.origin });
  return item;
}

export async function updateWorkItem(
  root: string,
  id: string,
  patch: Partial<WorkItem>,
): Promise<WorkItem | null> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const prev = findWork(e.snapshot, id);
  if (!prev) return null;
  const snap = patchItem(e.snapshot, id, patch);
  await saveWorks(root, snap);
  await appendEvent(root, { kind: "work_update", workId: id });
  return findWork(snap, id) ?? null;
}

export async function linkChatToWork(
  root: string,
  workId: string,
  chatId: string,
): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const w = findWork(e.snapshot, workId);
  if (!w || w.linkedChatIds.includes(chatId)) return;
  const linked = [...w.linkedChatIds, chatId];
  await updateWorkItem(root, workId, { linkedChatIds: linked });
  await appendEvent(root, { kind: "link_chat", workId, chatId });
}

export async function approvePlanWork(
  root: string,
  workId: string,
  planText: string,
): Promise<WorkItem | null> {
  const blocks = planTextToBlocks(planText);
  return updateWorkItem(root, workId, {
    descriptionBlocks: blocks,
    status: "in_progress",
    planApprovedAt: Date.now(),
  });
}

export async function ensurePlanDraft(
  root: string,
  chatId: string,
  title?: string,
): Promise<WorkItem> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const linked = e.snapshot.items.find(
    (w) => w.origin === "plan" && w.linkedChatIds.includes(chatId) && w.status === "backlog",
  );
  if (linked) return linked;
  const item = await createWorkItem(root, {
    title: title?.trim() || "Untitled plan",
    origin: "plan",
    featureSlug: "054-works-layer",
    status: "backlog",
  });
  await linkChatToWork(root, item.id, chatId);
  return item;
}

export function findWorkByShortId(
  snap: WorksSnapshot,
  shortId: string,
): WorkItem | undefined {
  const q = shortId.toUpperCase();
  return snap.items.find((w) => w.shortId.toUpperCase() === q);
}

export async function addWorkComment(
  root: string,
  workId: string,
  author: string,
  body: string,
  source: WorkComment["source"] = "human",
): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const w = findWork(e.snapshot, workId);
  if (!w) return;
  const comment: WorkComment = {
    id: newId(),
    workItemId: workId,
    author,
    body: body.trim(),
    createdAt: Date.now(),
    source,
  };
  await updateWorkItem(root, workId, {
    comments: [...w.comments, comment],
  });
  await appendEvent(root, { kind: "comment", workId, commentId: comment.id });
}

export async function deleteWorkItem(
  root: string,
  id: string,
): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const snap = {
    ...e.snapshot,
    items: e.snapshot.items.filter((w) => w.id !== id),
  };
  await saveWorks(root, snap);
  await appendEvent(root, { kind: "work_delete", workId: id });
  const open = getWorkDrawer();
  if (open?.workId === id && open.root === root) closeWorkDrawer();
}

export async function duplicateWorkItem(
  root: string,
  id: string,
): Promise<WorkItem | null> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const src = findWork(e.snapshot, id);
  if (!src) return null;
  const now = Date.now();
  const item = cloneWorkItem(src, now, e.snapshot);
  const snap = bumpSeq({ ...e.snapshot, items: [...e.snapshot.items, item] });
  await saveWorks(root, snap);
  await appendEvent(root, { kind: "work_duplicate", workId: item.id, fromId: id });
  return item;
}

function cloneWorkItem(src: WorkItem, now: number, snap: WorksSnapshot): WorkItem {
  return {
    ...src,
    id: newId(),
    shortId: nextShortId(snap),
    title: `${src.title} (copy)`,
    descriptionBlocks: structuredClone(src.descriptionBlocks),
    labelIds: [...src.labelIds],
    linkedChatIds: [],
    comments: [],
    planeIssueId: undefined,
    planApprovedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}
