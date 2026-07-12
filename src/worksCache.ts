import { invoke } from "@tauri-apps/api/core";
import {
  bumpSeq,
  bumpStorySeq,
  childrenOfStory,
  emptySnapshot,
  findStory,
  findWork,
  moduleByFeatureSlug,
  moduleByName,
  newId,
  nextShortId,
  nextStoryShortId,
  normalizeWorksSnapshot,
  type WorkComment,
  type WorkCycle,
  type WorkItem,
  type WorkOrigin,
  type WorkPriority,
  type WorkStory,
  type WorksSnapshot,
  type WorkStatus,
  type StoryStatus,
} from "./works";
import { workItemRelPath } from "./workItemMd";
import { defaultStoryBody, storyRelPath } from "./storyMd";
import { mergePlanIntoStoryBody, titleFromPlanText } from "./planStoryMerge";
import { ensureAppBundledSkills } from "./bundledSkills/sync";
import {
  deleteStoryFile,
  importOrphanStoryFiles,
  loadAllStoryBodies,
  writeStoryFile,
} from "./worksStoryFiles";
import { ensureWeeklyCycles, activeCycle } from "./worksCycles";
import {
  deleteWorkItemFile,
  ensureWorksDirs,
  hydrateItemFromFile,
  importOrphanMdFiles,
  loadAllItemBodies,
  migrateV1ItemsToMd,
  slimSnapshot,
  writeWorkItemFile,
} from "./worksItemFiles";
import { syncFeatureModules } from "./worksFeatureModules";
import { refreshAllWorkProgress } from "./workProgressStore";
import { closeWorkDrawer, getWorkDrawer } from "./workDrawer";
import { closeStoryDrawer, getStoryDrawer } from "./storyDrawer";
import { joinPath } from "./pathUtils";

type Listener = (snap: WorksSnapshot) => void;

interface WsWorks {
  root: string;
  snapshot: WorksSnapshot;
  hydrated: boolean;
  hydrating: Promise<void> | null;
  listeners: Set<Listener>;
}

const byRoot = new Map<string, WsWorks>();

function getEntry(root: string): WsWorks {
  let e = byRoot.get(root);
  if (!e) {
    e = {
      root,
      snapshot: emptySnapshot(),
      hydrated: false,
      hydrating: null,
      listeners: new Set(),
    };
    byRoot.set(root, e);
  }
  return e;
}

function notify(e: WsWorks): void {
  for (const fn of e.listeners) fn(e.snapshot);
}

function isSnapshot(v: unknown): v is WorksSnapshot {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.version === 1 || o.version === 2 || o.version === 3) &&
    Array.isArray(o.items)
  );
}

function migrateSnapshotV3(snap: WorksSnapshot): WorksSnapshot {
  const cycles = (snap.cycles ?? []).map((c) => ({
    ...c,
    status: c.status ?? "completed",
    auto: c.auto ?? false,
  }));
  return {
    ...snap,
    version: 3,
    cycles,
    stories: (snap.stories ?? []).map((s) => ({
      ...s,
      linkedChatIds: s.linkedChatIds ?? [],
    })),
    nextStorySeq: snap.nextStorySeq ?? 1,
  };
}

async function persist(root: string, snap: WorksSnapshot): Promise<void> {
  for (const item of snap.items) {
    await writeWorkItemFile(root, item, snap);
  }
  for (const story of snap.stories) {
    await writeStoryFile(root, story, snap);
  }
  await invoke("works_save", { wsRoot: root, snapshot: slimSnapshot(snap) });
}

async function appendEvent(root: string, event: Record<string, unknown>): Promise<void> {
  await invoke("works_append_event", {
    wsRoot: root,
    event: { ...event, at: Date.now() },
  });
}

async function finalizeHydrate(
  root: string,
  snap: WorksSnapshot,
  persistNeeded: boolean,
): Promise<WorksSnapshot> {
  let next = migrateSnapshotV3(snap);
  const { snap: withCycles, changed: cyclesChanged } = ensureWeeklyCycles(next);
  next = withCycles;
  const { snap: migrated, changed: migChanged } = await migrateV1ItemsToMd(root, next);
  const withBodies = await loadAllItemBodies(root, migrated);
  const withStoryBodies = await loadAllStoryBodies(root, withBodies);
  const { snap: withOrphans, changed: orphanChanged } =
    await importOrphanMdFiles(root, withStoryBodies);
  const { snap: withStoryOrphans, changed: storyOrphanChanged } =
    await importOrphanStoryFiles(root, withOrphans);
  if (
    persistNeeded ||
    migChanged ||
    orphanChanged ||
    storyOrphanChanged ||
    cyclesChanged
  ) {
    await persist(root, withStoryOrphans);
  }
  return withStoryOrphans;
}

export async function hydrateWorks(root: string): Promise<WorksSnapshot> {
  const e = getEntry(root);
  if (e.hydrated) return e.snapshot;
  if (e.hydrating) return e.hydrating.then(() => e.snapshot);
  e.hydrating = (async () => {
    await Promise.all([ensureWorksDirs(root), ensureAppBundledSkills(root)]);
    const raw = await invoke<unknown>("works_load", { wsRoot: root });
    const loaded = isSnapshot(raw) ? raw : emptySnapshot();
    const { snap: normalized, changed: labelsChanged } =
      normalizeWorksSnapshot(loaded);
    const { snap: withModules, changed: modulesChanged } =
      await syncFeatureModules(root, normalized);
    const snap = await finalizeHydrate(
      root,
      withModules,
      labelsChanged || modulesChanged,
    );
    e.snapshot = snap;
    e.hydrated = true;
    e.hydrating = null;
    notify(e);
  })();
  await e.hydrating;
  return e.snapshot;
}

export async function refreshWorksFromDisk(root: string): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) {
    await hydrateWorks(root);
    return;
  }
  const withBodies = await loadAllItemBodies(root, e.snapshot);
  const withStories = await loadAllStoryBodies(root, withBodies);
  const { snap: withOrphans, changed } = await importOrphanMdFiles(root, withStories);
  const { snap: withStoryOrphans, changed: storyChanged } =
    await importOrphanStoryFiles(root, withOrphans);
  e.snapshot = withStoryOrphans;
  notify(e);
  refreshAllWorkProgress(withStoryOrphans);
  if (changed || storyChanged) await persist(root, withStoryOrphans);
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
  const e = byRoot.get(root);
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
    moduleId?: string;
    featureSlug?: string;
    priority?: WorkPriority;
    status?: WorkStatus;
    bodyMd?: string;
    labelNames?: string[];
    parentId?: string;
    cycleId?: string;
  },
): Promise<WorkItem> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  let snap = e.snapshot;
  const mod =
    (opts.moduleId
      ? snap.modules.find((m) => m.id === opts.moduleId)
      : undefined) ??
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
  const shortId = nextShortId(snap);
  const parentStory = opts.parentId ? findStory(snap, opts.parentId) : undefined;
  const item: WorkItem = {
    id: newId(),
    shortId,
    filePath: workItemRelPath(shortId),
    moduleId: mod?.id ?? parentStory?.moduleId ?? snap.modules[0]?.id ?? "",
    parentId: opts.parentId,
    cycleId: opts.cycleId ?? parentStory?.cycleId,
    title: opts.title.trim() || "Untitled work",
    origin: opts.origin,
    bodyMd: opts.bodyMd ?? "",
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

export async function unlinkChatFromWork(
  root: string,
  workId: string,
  chatId: string,
): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const w = findWork(e.snapshot, workId);
  if (!w || !w.linkedChatIds.includes(chatId)) return;
  const linked = w.linkedChatIds.filter((id) => id !== chatId);
  await updateWorkItem(root, workId, { linkedChatIds: linked });
}

export async function linkChatToStory(
  root: string,
  storyId: string,
  chatId: string,
): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const s = findStory(e.snapshot, storyId);
  if (!s || s.linkedChatIds.includes(chatId)) return;
  const linked = [...s.linkedChatIds, chatId];
  await updateStory(root, storyId, { linkedChatIds: linked });
}

export async function unlinkChatFromStory(
  root: string,
  storyId: string,
  chatId: string,
): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const s = findStory(e.snapshot, storyId);
  if (!s || !s.linkedChatIds.includes(chatId)) return;
  const linked = s.linkedChatIds.filter((id) => id !== chatId);
  await updateStory(root, storyId, { linkedChatIds: linked });
}

export async function approvePlanStory(
  root: string,
  storyId: string,
  planText: string,
  title?: string,
): Promise<WorkStory | null> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const prev = findStory(e.snapshot, storyId);
  if (!prev) return null;
  const nextTitle = title?.trim() || titleFromPlanText(planText) || prev.title;
  const bodyMd = mergePlanIntoStoryBody(planText, nextTitle);
  return updateStory(root, storyId, {
    title: nextTitle,
    bodyMd: bodyMd || prev.bodyMd,
    status: "active",
  });
}

export async function mergePlanIntoStory(
  root: string,
  storyId: string,
  planText: string,
): Promise<WorkStory | null> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const prev = findStory(e.snapshot, storyId);
  if (!prev) return null;
  const bodyMd = mergePlanIntoStoryBody(planText, prev.title);
  const title = titleFromPlanText(planText);
  return updateStory(root, storyId, {
    ...(title ? { title } : {}),
    bodyMd: bodyMd || prev.bodyMd,
  });
}

export async function ensurePlanStory(
  root: string,
  chatId: string,
  title?: string,
): Promise<WorkStory> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const linked = e.snapshot.stories.find(
    (s) =>
      s.status === "draft" &&
      s.linkedChatIds.includes(chatId),
  );
  if (linked) return linked;
  const cycle = activeCycle(e.snapshot);
  const draftTitle = title?.trim() || "Untitled plan";
  const story = await createStory(root, {
    title: draftTitle,
    status: "draft",
    cycleId: cycle?.id,
    bodyMd: defaultStoryBody(draftTitle),
  });
  await linkChatToStory(root, story.id, chatId);
  return story;
}

export async function approvePlanWork(
  root: string,
  workId: string,
  planText: string,
): Promise<WorkItem | null> {
  return updateWorkItem(root, workId, {
    bodyMd: planText.trim(),
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
  const hit = findWork(e.snapshot, id);
  if (hit) await deleteWorkItemFile(root, hit);
  const snap = {
    ...e.snapshot,
    items: e.snapshot.items.filter((w) => w.id !== id),
  };
  await saveWorks(root, snap);
  await appendEvent(root, { kind: "work_delete", workId: id });
  const open = getWorkDrawer();
  if (
    open &&
    open.root === root &&
    !("create" in open) &&
    open.workId === id
  ) {
    closeWorkDrawer();
  }
}

function patchStory(
  snap: WorksSnapshot,
  id: string,
  patch: Partial<WorkStory>,
): WorksSnapshot {
  return {
    ...snap,
    stories: snap.stories.map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
    ),
  };
}

export async function createStory(
  root: string,
  opts: {
    title: string;
    moduleId?: string;
    cycleId?: string;
    status?: StoryStatus;
    bodyMd?: string;
  },
): Promise<WorkStory> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  let snap = e.snapshot;
  const now = Date.now();
  const shortId = nextStoryShortId(snap);
  const title = opts.title.trim() || "Untitled story";
  const story: WorkStory = {
    id: newId(),
    shortId,
    filePath: storyRelPath(shortId),
    moduleId: opts.moduleId ?? snap.modules.find((m) => m.featurePath)?.id ?? snap.modules[0]?.id ?? "",
    cycleId: opts.cycleId,
    title,
    status: opts.status ?? "draft",
    bodyMd: opts.bodyMd ?? defaultStoryBody(title),
    linkedChatIds: [],
    createdAt: now,
    updatedAt: now,
  };
  snap = bumpStorySeq({ ...snap, stories: [...snap.stories, story] });
  await saveWorks(root, snap);
  await appendEvent(root, { kind: "story_create", storyId: story.id });
  return story;
}

export async function updateStory(
  root: string,
  id: string,
  patch: Partial<WorkStory>,
): Promise<WorkStory | null> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const prev = findStory(e.snapshot, id);
  if (!prev) return null;
  const snap = patchStory(e.snapshot, id, patch);
  await saveWorks(root, snap);
  await appendEvent(root, { kind: "story_update", storyId: id });
  return findStory(snap, id) ?? null;
}

export async function deleteStory(
  root: string,
  id: string,
): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const hit = findStory(e.snapshot, id);
  if (hit) await deleteStoryFile(root, hit);
  const snap = {
    ...e.snapshot,
    stories: e.snapshot.stories.filter((s) => s.id !== id),
    items: e.snapshot.items.map((w) =>
      w.parentId === id ? { ...w, parentId: undefined, updatedAt: Date.now() } : w,
    ),
  };
  await saveWorks(root, snap);
  await appendEvent(root, { kind: "story_delete", storyId: id });
  const open = getStoryDrawer();
  if (open && open.root === root && !("create" in open) && open.storyId === id) {
    closeStoryDrawer();
  }
}

export async function createWorkFromStory(
  root: string,
  storyId: string,
  opts: { title: string; priority?: WorkPriority; bodyMd?: string },
): Promise<WorkItem | null> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const story = findStory(e.snapshot, storyId);
  if (!story) return null;
  return createWorkItem(root, {
    title: opts.title,
    origin: "manual",
    moduleId: story.moduleId,
    parentId: storyId,
    cycleId: story.cycleId,
    status: "backlog",
    priority: opts.priority,
    bodyMd: opts.bodyMd,
  });
}

export async function createCustomCycle(
  root: string,
  opts: { name: string; startDate: string; endDate: string },
): Promise<WorkCycle> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const cycle: WorkCycle = {
    id: newId(),
    name: opts.name.trim() || "Custom cycle",
    startDate: opts.startDate,
    endDate: opts.endDate,
    status: "upcoming",
    auto: false,
  };
  const snap = { ...e.snapshot, cycles: [...e.snapshot.cycles, cycle] };
  await saveWorks(root, snap);
  return cycle;
}

export async function updateCycle(
  root: string,
  id: string,
  patch: Partial<WorkCycle>,
): Promise<WorkCycle | null> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const hit = e.snapshot.cycles.find((c) => c.id === id);
  if (!hit) return null;
  const snap = {
    ...e.snapshot,
    cycles: e.snapshot.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
  await saveWorks(root, snap);
  return snap.cycles.find((c) => c.id === id) ?? null;
}

export async function deleteCycle(root: string, id: string): Promise<void> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const hit = e.snapshot.cycles.find((c) => c.id === id);
  if (!hit || hit.auto) return;
  const snap = {
    ...e.snapshot,
    cycles: e.snapshot.cycles.filter((c) => c.id !== id),
    items: e.snapshot.items.map((w) =>
      w.cycleId === id ? { ...w, cycleId: undefined, updatedAt: Date.now() } : w,
    ),
    stories: e.snapshot.stories.map((s) =>
      s.cycleId === id ? { ...s, cycleId: undefined, updatedAt: Date.now() } : s,
    ),
  };
  await saveWorks(root, snap);
}

export { childrenOfStory };

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
  const shortId = nextShortId(snap);
  return {
    ...src,
    id: newId(),
    shortId,
    filePath: workItemRelPath(shortId),
    title: `${src.title} (copy)`,
    bodyMd: src.bodyMd,
    labelIds: [...src.labelIds],
    linkedChatIds: [],
    comments: [],
    planeIssueId: undefined,
    planApprovedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function workItemAbsPath(root: string, item: WorkItem): string {
  return joinPath(root, item.filePath || workItemRelPath(item.shortId));
}

export async function reloadWorkItem(
  root: string,
  workId: string,
): Promise<WorkItem | null> {
  const e = getEntry(root);
  if (!e.hydrated) await hydrateWorks(root);
  const hit = findWork(e.snapshot, workId);
  if (!hit) return null;
  const next = await hydrateItemFromFile(root, hit, e.snapshot);
  const snap = patchItem(e.snapshot, workId, next);
  e.snapshot = snap;
  notify(e);
  return findWork(snap, workId) ?? null;
}
