// Disk sync for story markdown files.

import { fs } from "./ipc";
import { basename, joinPath } from "./pathUtils";
import { rewriteLegacyWorksPath } from "./worksDir";
import {
  moduleIdFromSlug,
  parseStoryMd,
  serializeStoryMd,
  storyRelPath,
  WORKS_STORIES_DIR,
} from "./storyMd";
import {
  bumpStorySeq,
  newId,
  type WorkStory,
  type WorksSnapshot,
} from "./works";
import { markWorkWrite } from "./worksItemFiles";

export async function ensureStoriesDir(root: string): Promise<void> {
  await fs.createDir(joinPath(root, WORKS_STORIES_DIR));
}

export async function writeStoryFile(
  root: string,
  story: WorkStory,
  snap: WorksSnapshot,
): Promise<void> {
  await ensureStoriesDir(root);
  const rel = rewriteLegacyWorksPath(story.filePath || storyRelPath(story.shortId));
  const abs = joinPath(root, rel);
  const body = story.bodyMd ?? "";
  markWorkWrite(abs);
  await fs.writeFile(abs, serializeStoryMd(story, snap, body));
}

export async function deleteStoryFile(root: string, story: WorkStory): Promise<void> {
  const rel = rewriteLegacyWorksPath(story.filePath || storyRelPath(story.shortId));
  const abs = joinPath(root, rel);
  if (await fs.exists(abs)) await fs.delete(abs);
}

export async function hydrateStoryFromFile(
  root: string,
  story: WorkStory,
  snap: WorksSnapshot,
): Promise<WorkStory> {
  const rel = rewriteLegacyWorksPath(story.filePath || storyRelPath(story.shortId));
  const abs = joinPath(root, rel);
  if (!(await fs.exists(abs))) {
    return { ...story, filePath: rel, bodyMd: story.bodyMd ?? "" };
  }
  const src = await fs.readFile(abs);
  const parsed = parseStoryMd(src);
  if (!parsed) return { ...story, filePath: rel, bodyMd: story.bodyMd ?? "" };
  const moduleId = moduleIdFromSlug(snap, parsed.moduleSlug) ?? story.moduleId;
  return {
    ...story,
    filePath: rel,
    title: parsed.title || story.title,
    status: parsed.status ?? story.status,
    moduleId,
    cycleId: parsed.cycleId ?? story.cycleId,
    createdAt: parsed.createdAt ?? story.createdAt,
    updatedAt: parsed.updatedAt ?? story.updatedAt,
    bodyMd: parsed.bodyMd,
    brainRefs: parsed.brainRefs.length ? parsed.brainRefs : story.brainRefs,
    contextExcludedRefs: parsed.contextExcludedRefs.length
      ? parsed.contextExcludedRefs
      : story.contextExcludedRefs,
    linkedChatIds: parsed.linkedChatIds.length
      ? parsed.linkedChatIds
      : story.linkedChatIds ?? [],
  };
}

export async function loadAllStoryBodies(
  root: string,
  snap: WorksSnapshot,
): Promise<WorksSnapshot> {
  const stories = await Promise.all(
    snap.stories.map((s) => hydrateStoryFromFile(root, s, snap)),
  );
  return { ...snap, stories };
}

export async function importOrphanStoryFiles(
  root: string,
  snap: WorksSnapshot,
): Promise<{ snap: WorksSnapshot; changed: boolean }> {
  const dir = joinPath(root, WORKS_STORIES_DIR);
  if (!(await fs.exists(dir))) return { snap, changed: false };
  let entries: Awaited<ReturnType<typeof fs.listDir>>;
  try {
    entries = await fs.listDir(dir);
  } catch {
    return { snap, changed: false };
  }
  const known = new Set(snap.stories.map((s) => s.shortId.toUpperCase()));
  let changed = false;
  const stories = [...snap.stories];
  for (const ent of entries) {
    if (ent.is_dir || !ent.name.endsWith(".md")) continue;
    const shortId = basename(ent.name).replace(/\.md$/i, "");
    if (known.has(shortId.toUpperCase())) continue;
    const src = await fs.readFile(ent.path);
    const parsed = parseStoryMd(src);
    if (!parsed) continue;
    const now = Date.now();
    const moduleId =
      moduleIdFromSlug(snap, parsed.moduleSlug) ?? snap.modules[0]?.id ?? "";
    const story: WorkStory = {
      id: parsed.id ?? newId(),
      shortId: parsed.shortId ?? shortId,
      filePath: storyRelPath(parsed.shortId ?? shortId),
      moduleId,
      title: parsed.title,
      status: parsed.status ?? "draft",
      bodyMd: parsed.bodyMd,
      cycleId: parsed.cycleId,
      brainRefs: parsed.brainRefs,
      contextExcludedRefs: parsed.contextExcludedRefs,
      linkedChatIds: parsed.linkedChatIds,
      createdAt: parsed.createdAt ?? now,
      updatedAt: parsed.updatedAt ?? now,
    };
    stories.push(story);
    known.add(story.shortId.toUpperCase());
    changed = true;
  }
  if (!changed) return { snap, changed: false };
  return { snap: bumpStorySeq({ ...snap, stories }), changed: true };
}

export async function reloadStoryFromPath(
  root: string,
  snap: WorksSnapshot,
  absPath: string,
): Promise<WorksSnapshot | null> {
  const shortId = basename(absPath).replace(/\.md$/i, "");
  const hit = snap.stories.find(
    (s) =>
      s.shortId.toUpperCase() === shortId.toUpperCase() ||
      s.filePath === absPath.replace(root.replace(/\\/g, "/").replace(/\/+$/, "") + "/", ""),
  );
  if (!hit) {
    const { snap: next, changed } = await importOrphanStoryFiles(root, snap);
    return changed ? next : null;
  }
  const nextStory = await hydrateStoryFromFile(root, hit, snap);
  return {
    ...snap,
    stories: snap.stories.map((s) => (s.id === hit.id ? nextStory : s)),
  };
}
