// Resolve Brain documentation paths for a work item / story (manifest, not full files).

import { frontmatterList } from "./subagents";
import { fs } from "./ipc";
import { joinPath } from "./pathUtils";
import { rewriteLegacyWorksPath } from "./worksDir";
import { workItemRelPath } from "./workItemMd";
import { storyRelPath } from "./storyMd";
import { findStory, type WorkItem, type WorkStory, type WorksSnapshot } from "./works";

export type BrainRefRole = "primary" | "related" | "story" | "extra";

export interface BrainRef {
  path: string;
  role: BrainRefRole;
  title?: string;
}

export const MAX_BRAIN_REFS = 6;

/** Normalize a related/ref entry to a workspace-relative documentation path. */
export function normalizeBrainDocPath(ref: string): string {
  const t = ref.trim().replace(/\\/g, "/");
  if (!t) return "";
  if (t.startsWith("documentation/")) return t;
  if (t.includes("/")) return t.startsWith("documentation") ? t : `documentation/${t}`;
  return `documentation/features/${t.endsWith(".md") ? t : `${t}.md`}`;
}

function normKey(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

function pushRef(
  out: BrainRef[],
  seen: Set<string>,
  path: string,
  role: BrainRefRole,
  title?: string,
): void {
  const p = path.trim();
  if (!p || seen.has(normKey(p))) return;
  seen.add(normKey(p));
  out.push({ path: p, role, title });
}

/** Parse `related:` from a feature doc's YAML frontmatter. */
export function parseRelatedFromFeatureDoc(src: string): string[] {
  return frontmatterList(src, "related").map(normalizeBrainDocPath).filter(Boolean);
}

export function resolveBrainRefs(
  snap: WorksSnapshot,
  work: WorkItem,
  story?: WorkStory,
  relatedFromFeature: string[] = [],
): BrainRef[] {
  const out: BrainRef[] = [];
  const seen = new Set<string>();
  const mod = snap.modules.find((m) => m.id === work.moduleId);

  if (mod?.featurePath) {
    pushRef(out, seen, mod.featurePath, "primary", mod.name);
  }

  if (story) {
    const sp = rewriteLegacyWorksPath(story.filePath || storyRelPath(story.shortId));
    pushRef(out, seen, sp, "story", story.title);
  }

  for (const rel of relatedFromFeature) {
    if (out.length >= MAX_BRAIN_REFS) break;
    pushRef(out, seen, rel, "related");
  }

  const extras = [...(work.brainRefs ?? []), ...(story?.brainRefs ?? [])];
  for (const raw of extras) {
    if (out.length >= MAX_BRAIN_REFS) break;
    pushRef(out, seen, normalizeBrainDocPath(raw), "extra");
  }

  return out.slice(0, MAX_BRAIN_REFS);
}

export function resolveBrainRefsForStory(
  snap: WorksSnapshot,
  story: WorkStory,
  relatedFromFeature: string[] = [],
): BrainRef[] {
  const stub: WorkItem = {
    id: story.id,
    shortId: story.shortId,
    filePath: story.filePath,
    moduleId: story.moduleId,
    title: story.title,
    origin: "manual",
    status: "todo",
    priority: "medium",
    labelIds: [],
    linkedChatIds: [],
    comments: [],
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
    brainRefs: story.brainRefs,
    cycleId: story.cycleId,
  };
  return resolveBrainRefs(snap, stub, undefined, relatedFromFeature);
}

export function brainRefPaths(refs: BrainRef[]): string[] {
  return refs.map((r) => r.path);
}

export function workFilePath(work: WorkItem): string {
  return rewriteLegacyWorksPath(work.filePath || workItemRelPath(work.shortId));
}

export function storyForWork(
  snap: WorksSnapshot,
  work: WorkItem,
): WorkStory | undefined {
  return work.parentId ? findStory(snap, work.parentId) : undefined;
}

export function primaryFeaturePath(
  snap: WorksSnapshot,
  work: WorkItem,
): string | undefined {
  return snap.modules.find((m) => m.id === work.moduleId)?.featurePath;
}

export function featureDocAbs(root: string, relPath: string): string {
  return joinPath(root, relPath);
}

export async function loadBrainRefsForWork(
  root: string,
  snap: WorksSnapshot,
  work: WorkItem,
): Promise<BrainRef[]> {
  const story = storyForWork(snap, work);
  const primary = primaryFeaturePath(snap, work);
  let related: string[] = [];
  if (primary) {
    try {
      const src = await fs.readFile(featureDocAbs(root, primary));
      related = parseRelatedFromFeatureDoc(src);
    } catch {
      /* optional */
    }
  }
  return resolveBrainRefs(snap, work, story, related);
}

export async function loadBrainRefsForStory(
  root: string,
  snap: WorksSnapshot,
  story: WorkStory,
): Promise<BrainRef[]> {
  const mod = snap.modules.find((m) => m.id === story.moduleId);
  let related: string[] = [];
  if (mod?.featurePath) {
    try {
      const src = await fs.readFile(featureDocAbs(root, mod.featurePath));
      related = parseRelatedFromFeatureDoc(src);
    } catch {
      /* optional */
    }
  }
  return resolveBrainRefsForStory(snap, story, related);
}
