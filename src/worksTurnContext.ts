// Token-efficient pre-turn work manifest — paths + optional feature outline.

import { fs } from "./ipc";
import { joinPath } from "./pathUtils";
import { getJson } from "./localStore";
import {
  extractFeatureDocOutline,
  formatFeatureOutlineBlock,
} from "./featureDocOutline";
import {
  brainRefPaths,
  parseRelatedFromFeatureDoc,
  primaryFeaturePath,
  resolveBrainRefs,
  resolveBrainRefsForStory,
  storyForWork,
  workFilePath,
  type BrainRef,
} from "./worksBrainRefs";
import { acceptanceFromMarkdown } from "./worksBlocks";
import { findWork, findStory, type WorksSnapshot } from "./works";
import { rewriteLegacyWorksPath } from "./worksDir";
import { storyRelPath } from "./storyMd";
import { activeCycle } from "./worksCycles";

export type WorksInjectDepth = "pointers" | "outline" | "pinky";

const depthKey = (wsId: string) => `lcp.works.injectDepth.${wsId}`;

export function getWorksInjectDepth(wsId: string): WorksInjectDepth {
  return getJson<WorksInjectDepth>(
    depthKey(wsId),
    "outline",
    (v): v is WorksInjectDepth =>
      v === "pointers" || v === "outline" || v === "pinky",
  );
}

export function setWorksInjectDepth(wsId: string, depth: WorksInjectDepth): void {
  localStorage.setItem(depthKey(wsId), JSON.stringify(depth));
}

export interface WorksTurnContext {
  block: string;
  refs: BrainRef[];
  pinkyQuery?: string;
}

function uncheckedPreview(md: string, max: number): string[] {
  const out: string[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^-\s+\[[ ]\]\s+(.+)/);
    if (!m) continue;
    out.push(m[1]!.trim());
    if (out.length >= max) break;
  }
  return out;
}

function acceptanceSummary(md: string): string {
  const { done, total } = acceptanceFromMarkdown(md);
  if (total === 0) return "";
  return `acceptance ${done}/${total}`;
}

function formatRefsSection(refs: BrainRef[]): string {
  const docRefs = refs.filter((r) => r.role !== "story");
  if (docRefs.length === 0) return "";
  const lines = docRefs.map((r) => {
    const label = r.title ? ` — ${r.title}` : "";
    return `  - ${r.path} (${r.role})${label}`;
  });
  return `Related docs:\n${lines.join("\n")}`;
}

function formatWorkManifest(
  snap: WorksSnapshot,
  workId: string,
  refs: BrainRef[],
  outlineBlock: string,
  siblingSummaries: string[],
): string | null {
  const w = findWork(snap, workId);
  if (!w) return null;
  const story = storyForWork(snap, w);
  const wf = workFilePath(w);
  const mod = snap.modules.find((m) => m.id === w.moduleId);
  const storyLine = story
    ? `Story: ${rewriteLegacyWorksPath(story.filePath || storyRelPath(story.shortId))}` +
      (story.bodyMd
        ? ` (${acceptanceSummary(story.bodyMd)})`
        : "")
    : "";
  const workAcc = acceptanceSummary(w.bodyMd ?? "");
  const workAccLine = workAcc ? ` (${workAcc})` : "";
  const primary = mod?.featurePath
    ? `Module feature: ${mod.featurePath}`
    : `Module: ${mod?.name ?? ""}`;
  const cycle = w.cycleId
    ? snap.cycles.find((c) => c.id === w.cycleId)
    : undefined;
  const cycleLine = cycle ? `Cycle: ${cycle.name} (${cycle.status})\n` : "";
  const unchecked = story
    ? uncheckedPreview(story.bodyMd ?? "", 5)
    : uncheckedPreview(w.bodyMd ?? "", 5);
  const pending =
    unchecked.length > 0
      ? `\nPending acceptance:\n${unchecked.map((t) => `  - ${t}`).join("\n")}`
      : "";
  const siblings =
    siblingSummaries.length > 0
      ? `\nLinked sessions:\n${siblingSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";
  const refsSec = formatRefsSection(refs);
  const outline = outlineBlock ? `\n${outlineBlock}` : "";
  return (
    `[Quack Work — ${w.shortId}: ${w.title}]\n` +
    `Work: ${wf}${workAccLine}\n` +
    (storyLine ? `${storyLine}\n` : "") +
    `Status: ${w.status} · Priority: ${w.priority} · ${primary}\n` +
    cycleLine +
    (refsSec ? `${refsSec}\n` : "") +
    `Prefer Read paths above before Explore/Grep.` +
    pending +
    outline +
    siblings +
    `\n[/Quack Work]`
  );
}

export function buildPinkyQueryForWork(
  snap: WorksSnapshot,
  workId: string,
): string | null {
  const w = findWork(snap, workId);
  if (!w) return null;
  const mod = snap.modules.find((m) => m.id === w.moduleId);
  const story = storyForWork(snap, w);
  const q = [w.title, mod?.name, story?.title].filter(Boolean).join(" ");
  return q.slice(0, 200) || null;
}

export function buildSiblingSummaries(
  snap: WorksSnapshot,
  chatIds: string[],
  selfChatId?: string,
): string[] {
  const ids = chatIds.filter((id) => id !== selfChatId);
  return ids.slice(0, 4).map((id) => {
    const w = snap.items.find((i) => i.linkedChatIds.includes(id));
    if (w) return `${w.shortId}: ${w.title}`;
    const s = snap.stories.find((st) => st.linkedChatIds.includes(id));
    if (s) return `${s.shortId}: ${s.title}`;
    return `chat ${id.slice(0, 8)}`;
  });
}

function formatStoryManifest(
  snap: WorksSnapshot,
  storyId: string,
  refs: BrainRef[],
  outlineBlock: string,
  siblingSummaries: string[],
): string | null {
  const story = findStory(snap, storyId);
  if (!story) return null;
  const sf = rewriteLegacyWorksPath(story.filePath || storyRelPath(story.shortId));
  const mod = snap.modules.find((m) => m.id === story.moduleId);
  const cycle = story.cycleId
    ? snap.cycles.find((c) => c.id === story.cycleId)
    : activeCycle(snap);
  const acc = acceptanceSummary(story.bodyMd ?? "");
  const accLine = acc ? ` (${acc})` : "";
  const primary = mod?.featurePath
    ? `Module feature: ${mod.featurePath}`
    : `Module: ${mod?.name ?? ""}`;
  const cycleLine = cycle ? `Cycle: ${cycle.name} (${cycle.status})\n` : "";
  const unchecked = uncheckedPreview(story.bodyMd ?? "", 5);
  const pending =
    unchecked.length > 0
      ? `\nPending acceptance:\n${unchecked.map((t) => `  - ${t}`).join("\n")}`
      : "";
  const siblings =
    siblingSummaries.length > 0
      ? `\nLinked sessions:\n${siblingSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";
  const refsSec = formatRefsSection(refs);
  const outline = outlineBlock ? `\n${outlineBlock}` : "";
  return (
    `[Quack Story — ${story.shortId}: ${story.title}]\n` +
    `Story: ${sf}${accLine}\n` +
    `Status: ${story.status} · ${primary}\n` +
    cycleLine +
    (refsSec ? `${refsSec}\n` : "") +
    `Prefer Read paths above before Explore/Grep.` +
    pending +
    outline +
    siblings +
    `\n[/Quack Story]`
  );
}

export async function buildStoryTurnContext(
  root: string,
  snap: WorksSnapshot,
  storyId: string,
  wsId: string,
  siblingSummaries: string[] = [],
): Promise<WorksTurnContext | null> {
  const story = findStory(snap, storyId);
  if (!story) return null;
  const depth = getWorksInjectDepth(wsId);
  const mod = snap.modules.find((m) => m.id === story.moduleId);
  let related: string[] = [];
  let outlineBlock = "";
  const primary = mod?.featurePath;
  if (primary && depth !== "pointers") {
    try {
      const src = await fs.readFile(joinPath(root, primary));
      related = parseRelatedFromFeatureDoc(src);
      const outline = extractFeatureDocOutline(src);
      if (outline.purpose || outline.headings.length > 0) {
        outlineBlock = formatFeatureOutlineBlock(primary, outline);
      }
    } catch {
      /* optional */
    }
  }
  const refs = resolveBrainRefsForStory(snap, story, related);
  const block = formatStoryManifest(
    snap,
    storyId,
    refs,
    outlineBlock,
    siblingSummaries,
  );
  if (!block) return null;
  const pinkyQuery =
    depth === "pinky"
      ? [story.title, mod?.name].filter(Boolean).join(" ").slice(0, 200) || undefined
      : undefined;
  return { block, refs, pinkyQuery };
}

export async function buildWorksTurnContext(
  root: string,
  snap: WorksSnapshot,
  workId: string,
  wsId: string,
  siblingSummaries: string[] = [],
): Promise<WorksTurnContext | null> {
  const w = findWork(snap, workId);
  if (!w) return null;
  const depth = getWorksInjectDepth(wsId);
  const story = storyForWork(snap, w);
  let related: string[] = [];
  const primary = primaryFeaturePath(snap, w);
  let outlineBlock = "";
  if (primary && depth !== "pointers") {
    try {
      const src = await fs.readFile(joinPath(root, primary));
      related = parseRelatedFromFeatureDoc(src);
      const outline = extractFeatureDocOutline(src);
      if (outline.purpose || outline.headings.length > 0) {
        outlineBlock = formatFeatureOutlineBlock(primary, outline);
      }
    } catch {
      /* feature doc optional */
    }
  }
  const refs = resolveBrainRefs(snap, w, story, related);
  const block = formatWorkManifest(snap, workId, refs, outlineBlock, siblingSummaries);
  if (!block) return null;
  const pinkyQuery =
    depth === "pinky" ? buildPinkyQueryForWork(snap, workId) ?? undefined : undefined;
  return { block, refs, pinkyQuery };
}

/** Paths already covered by the work manifest (for Pinky dedup). */
export function manifestDocPaths(refs: BrainRef[]): Set<string> {
  const s = new Set<string>();
  for (const r of refs) {
    const p = r.path.replace(/\\/g, "/").toLowerCase();
    s.add(p);
    const base = p.split("/").pop() ?? p;
    s.add(base);
  }
  return s;
}

export function filterPinkyHits<T extends { path: string }>(
  hits: T[],
  manifestPaths: Set<string>,
): T[] {
  return hits.filter((h) => {
    const p = h.path.replace(/\\/g, "/").toLowerCase();
    const base = p.split("/").pop() ?? p;
    return !manifestPaths.has(p) && !manifestPaths.has(base);
  });
}

export function brainRefPathsFromContext(ctx: WorksTurnContext): string[] {
  return brainRefPaths(ctx.refs);
}
