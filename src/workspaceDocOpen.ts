// Resolve workspace documentation paths and open them without raw OS errors.

import { openBrainDoc } from "./brainInject";
import {
  normalizeFileLinkPath,
  resolveChatFilePath,
} from "./chatFileLinks";
import { openFeatureDocDrawer } from "./featureDocDrawer";
import { fs } from "./ipc";
import { warning } from "./notify";
import { basename, joinPath } from "./pathUtils";
import { useStore } from "./store";
import {
  normalizeBrainDocPath,
  type BrainRef,
} from "./worksBrainRefs";

function wsRootNorm(root: string): string {
  return root.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Candidate absolute paths for a chat link or bare doc filename. */
export function workspaceDocCandidates(wsRoot: string, raw: string): string[] {
  const norm = normalizeFileLinkPath(raw).replace(/\\/g, "/");
  const root = wsRootNorm(wsRoot);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (p: string) => {
    const v = p.replace(/\\/g, "/");
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };

  add(resolveChatFilePath(root, norm));
  const isAbs = /^[A-Za-z]:\//.test(norm) || norm.startsWith("/");
  const isWorks = norm.startsWith("works/");
  if (!isAbs && !isWorks && (!norm.includes("/") || norm.startsWith("documentation/"))) {
    const brain = normalizeBrainDocPath(norm);
    if (brain) add(joinPath(root, brain));
  }
  return out;
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
  return null;
}

function relFromRoot(root: string, abs: string): string {
  const r = wsRootNorm(root);
  const a = abs.replace(/\\/g, "/");
  return a.startsWith(`${r}/`) ? a.slice(r.length + 1) : a;
}

function warnMissing(raw: string): void {
  warning(`${basename(normalizeFileLinkPath(raw))} doesn't exist yet`);
}

/** Open a resolved workspace file; feature docs use the preview drawer. */
export async function openWorkspaceDocPath(
  wsId: string,
  root: string,
  raw: string,
): Promise<void> {
  const abs = await resolveWorkspaceDocPath(root, raw);
  if (!abs) {
    warnMissing(raw);
    return;
  }
  const rel = relFromRoot(root, abs);
  if (rel.includes("/features/")) {
    openFeatureDocDrawer({
      wsId,
      root,
      featurePath: rel,
      title: basename(abs),
    });
    return;
  }
  await useStore.getState().openFile(wsId, abs);
}

/** Open a brain ref from Works / composer context docs. */
export function openBrainRef(wsId: string, root: string, ref: BrainRef): void {
  if (ref.role === "primary" || ref.path.includes("/features/")) {
    openFeatureDocDrawer({
      wsId,
      root,
      featurePath: ref.path,
      title: ref.title ?? basename(ref.path),
    });
    return;
  }
  if (ref.role === "story") {
    void openWorkspaceDocPath(wsId, root, ref.path);
    return;
  }
  void openBrainDoc(wsId, root, ref.path.replace(/^documentation\//, ""));
}
