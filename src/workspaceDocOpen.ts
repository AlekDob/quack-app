// Resolve workspace documentation paths and open them without raw OS errors.

import { getAgentMode } from "./agentMode";
import {
  normalizeFileLinkPath,
  resolveChatFilePath,
} from "./chatFileLinks";
import { openFeatureDocDrawer } from "./featureDocDrawer";
import { fs, search } from "./ipc";
import { warning } from "./notify";
import { basename, isUnderRoot, joinPath, relPath } from "./pathUtils";
import { openStoryDrawer } from "./storyDrawer";
import { useStore } from "./store";
import { getWorksSnapshot } from "./worksCache";
import { rewriteLegacyWorksPath } from "./worksDir";
import { storyRelPath } from "./storyMd";
import {
  normalizeBrainDocPath,
  type BrainRef,
} from "./worksBrainRefs";

interface WsRoot {
  wsId: string;
  root: string;
}

function wsRootNorm(root: string): string {
  return root.replace(/\\/g, "/").replace(/\/+$/, "");
}

function listOpenWorkspaceRoots(preferredRoot: string): WsRoot[] {
  const st = useStore.getState();
  const all: WsRoot[] = [];
  for (const wsId of st.openIds) {
    const root = st.loaded[wsId]?.meta.root;
    if (!root) continue;
    all.push({ wsId, root: wsRootNorm(root) });
  }
  const pref = wsRootNorm(preferredRoot);
  const head = all.find((w) => w.root === pref);
  if (!head) return all;
  return [head, ...all.filter((w) => w.root !== pref)];
}

function addEngineFeatureCandidates(
  add: (p: string) => void,
  root: string,
  brain: string,
): void {
  const base = basename(brain);
  if (!/^\d{3}-.+\.md$/i.test(base)) return;
  add(joinPath(root, `documentation/engine/features/${base}`));
  add(joinPath(root, `engine/documentation/features/${base}`));
}

function addDocCandidates(
  out: string[],
  seen: Set<string>,
  root: string,
  norm: string,
): void {
  const add = (p: string) => {
    const v = p.replace(/\\/g, "/");
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  add(resolveChatFilePath(root, norm));
  const isWorks = norm.startsWith("works/");
  if (isWorks || (norm.includes("/") && !norm.startsWith("documentation/"))) {
    return;
  }
  const brain = normalizeBrainDocPath(norm);
  if (brain) {
    add(joinPath(root, brain));
    addEngineFeatureCandidates(add, root, brain);
  }
  if (/^\d{4}-\d{2}-\d{2}\.md$/i.test(norm)) {
    add(joinPath(root, `documentation/diary/${norm}`));
    add(joinPath(root, `documentation/engine/diary/${norm}`));
  }
}

/** Candidate absolute paths for a chat link or bare doc filename. */
export function workspaceDocCandidates(wsRoot: string, raw: string): string[] {
  const norm = normalizeFileLinkPath(raw).replace(/\\/g, "/");
  const seen = new Set<string>();
  const out: string[] = [];
  if (/^[A-Za-z]:\//.test(norm) || norm.startsWith("/")) {
    const v = norm;
    if (v) out.push(v);
    return out;
  }
  for (const { root } of listOpenWorkspaceRoots(wsRoot)) {
    addDocCandidates(out, seen, root, norm);
  }
  return out;
}

function isBareBasename(raw: string): boolean {
  const norm = normalizeFileLinkPath(raw).replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(norm) || norm.startsWith("/")) return false;
  return !norm.includes("/");
}

function docBasenameScore(rel: string): number {
  const p = rel.replace(/\\/g, "/");
  const tier = p.includes("/features/")
    ? 0
    : p.includes("/diary/")
      ? 1
      : 2;
  return tier * 10_000 + p.length;
}

async function findDocumentationByBasename(
  name: string,
): Promise<{ wsId: string; root: string; abs: string } | null> {
  const base = basename(name);
  if (!base.endsWith(".md")) return null;
  for (const entry of listOpenWorkspaceRoots("")) {
    try {
      const rels = await search.listFiles(entry.root, 8_000);
      const hits = rels.filter(
        (rel) =>
          basename(rel) === base &&
          rel.replace(/\\/g, "/").includes("/documentation/"),
      );
      if (!hits.length) continue;
      hits.sort((a, b) => docBasenameScore(a) - docBasenameScore(b));
      return {
        wsId: entry.wsId,
        root: entry.root,
        abs: joinPath(entry.root, hits[0]!),
      };
    } catch {
      /* try next workspace */
    }
  }
  return null;
}

export async function resolveWorkspaceDocPath(
  wsRoot: string,
  raw: string,
): Promise<string | null> {
  for (const p of workspaceDocCandidates(wsRoot, raw)) {
    try {
      if (await fs.exists(p)) return p;
    } catch {
      /* try next candidate */
    }
  }
  if (!isBareBasename(raw)) return null;
  const hit = await findDocumentationByBasename(raw);
  return hit?.abs ?? null;
}

function workspaceForAbs(abs: string): WsRoot | null {
  const norm = abs.replace(/\\/g, "/");
  for (const entry of listOpenWorkspaceRoots("")) {
    if (isUnderRoot(norm, entry.root)) return entry;
  }
  return null;
}

interface DocOpenTarget {
  wsId: string;
  root: string;
  abs: string;
  rel: string;
}

async function resolveWorkspaceDocTarget(
  wsId: string,
  root: string,
  raw: string,
): Promise<DocOpenTarget | null> {
  const abs = await resolveWorkspaceDocPath(root, raw);
  if (!abs) return null;
  const owner = workspaceForAbs(abs) ?? { wsId, root: wsRootNorm(root) };
  return {
    wsId: owner.wsId,
    root: owner.root,
    abs,
    rel: relPath(abs, owner.root),
  };
}

function warnMissing(raw: string): void {
  warning(`${basename(normalizeFileLinkPath(raw))} doesn't exist yet`);
}

function storyIdForPath(root: string, refPath: string): string | null {
  const snap = getWorksSnapshot(root);
  if (!snap) return null;
  const want = rewriteLegacyWorksPath(refPath).replace(/\\/g, "/").toLowerCase();
  for (const story of snap.stories) {
    const p = rewriteLegacyWorksPath(
      story.filePath || storyRelPath(story.shortId),
    )
      .replace(/\\/g, "/")
      .toLowerCase();
    if (p === want) return story.id;
  }
  return null;
}

function isFeatureDocPath(path: string): boolean {
  return path.replace(/\\/g, "/").includes("/features/");
}

async function activateWorkspace(wsId: string): Promise<void> {
  const st = useStore.getState();
  if (st.activeId !== wsId) await st.setActiveWorkspace(wsId);
}

async function openResolvedFile(target: DocOpenTarget): Promise<void> {
  await activateWorkspace(target.wsId);
  const st = useStore.getState();
  if (getAgentMode()) {
    await st.openFileInDrawer(target.wsId, target.abs);
    return;
  }
  await st.openFile(target.wsId, target.abs);
}

function openFeatureDocTarget(
  target: DocOpenTarget | null,
  wsId: string,
  root: string,
  rawPath: string,
  title: string,
): void {
  if (target) {
    openFeatureDocDrawer({
      wsId: target.wsId,
      root: target.root,
      featurePath: target.rel,
      title: title || basename(target.abs),
    });
    return;
  }
  const rel = rawPath.replace(/\\/g, "/");
  openFeatureDocDrawer({
    wsId,
    root,
    featurePath: rel.startsWith("documentation/") ? rel : normalizeBrainDocPath(rel),
    title,
  });
}

/** Open a resolved workspace file; feature docs use the preview drawer. */
export async function openWorkspaceDocPath(
  wsId: string,
  root: string,
  raw: string,
): Promise<void> {
  const target = await resolveWorkspaceDocTarget(wsId, root, raw);
  if (!target) {
    warnMissing(raw);
    return;
  }
  if (isFeatureDocPath(target.rel)) {
    openFeatureDocTarget(target, wsId, root, raw, basename(target.abs));
    return;
  }
  await openResolvedFile(target);
}

/** Open a brain ref from Works / composer context docs. */
export function openBrainRef(wsId: string, root: string, ref: BrainRef): void {
  if (ref.role === "story") {
    const storyId = storyIdForPath(root, ref.path);
    if (storyId) {
      void activateWorkspace(wsId).then(() => {
        openStoryDrawer({ wsId, root, storyId });
      });
      return;
    }
    void openWorkspaceDocPath(wsId, root, ref.path);
    return;
  }
  if (ref.role === "primary" || isFeatureDocPath(ref.path)) {
    void resolveWorkspaceDocTarget(wsId, root, ref.path).then((target) => {
      openFeatureDocTarget(
        target,
        wsId,
        root,
        ref.path,
        ref.title ?? basename(ref.path),
      );
    });
    return;
  }
  void resolveWorkspaceDocTarget(wsId, root, ref.path).then(async (target) => {
    if (target) {
      await openResolvedFile(target);
      return;
    }
    const stripped = ref.path.replace(/^documentation\//, "");
    const retry = await resolveWorkspaceDocTarget(wsId, root, stripped);
    if (retry) {
      await openResolvedFile(retry);
      return;
    }
    warnMissing(ref.path);
  });
}
