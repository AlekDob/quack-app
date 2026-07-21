// Resolve file paths across workspaces / home and open in-tab or pop-out.

import { homeDir } from "@tauri-apps/api/path";
import { normalizeFileLinkPath } from "./chatFileLinks";
import { fs } from "./ipc";
import { basename, isUnderRoot, joinPath } from "./pathUtils";
import { popOutFile } from "./filePopout";
import { error as toastError } from "./notify";
import { useStore } from "./store";

interface WsRoot {
  wsId: string;
  root: string;
}

function listWorkspaceRoots(): WsRoot[] {
  const st = useStore.getState();
  return st.openIds.flatMap((wsId) => {
    const root = st.loaded[wsId]?.meta.root;
    return root ? [{ wsId, root }] : [];
  });
}

function expandTilde(path: string, home: string): string {
  if (path.startsWith("~/")) return joinPath(home, path.slice(2));
  if (path === "~") return home;
  return path;
}

export function buildPathCandidates(
  raw: string,
  preferredRoot: string | null,
  home: string | null,
): string[] {
  const norm = normalizeFileLinkPath(raw).replace(/\\/g, "/");
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (p: string) => {
    const v = p.replace(/\\/g, "/");
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };

  if (/^[A-Za-z]:\//.test(norm) || norm.startsWith("/")) {
    add(norm);
    return out;
  }

  const tilde = home ? expandTilde(norm, home) : norm;
  if (preferredRoot) add(joinPath(preferredRoot, tilde));
  for (const { root } of listWorkspaceRoots()) {
    if (root !== preferredRoot) add(joinPath(root, tilde));
  }
  if (home) {
    if (norm.startsWith(".") || norm.includes("/.")) add(joinPath(home, norm));
    if (tilde !== norm) add(joinPath(home, norm));
  }
  return out;
}

export async function resolveExistingFilePath(
  raw: string,
  preferredRoot?: string | null,
): Promise<string | null> {
  const home = await homeDir().catch(() => null);
  const candidates = buildPathCandidates(raw, preferredRoot ?? null, home);
  for (const p of candidates) {
    try {
      if (await fs.exists(p)) return p;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function findWorkspaceForPath(absPath: string): WsRoot | null {
  let best: WsRoot | null = null;
  for (const entry of listWorkspaceRoots()) {
    if (!isUnderRoot(absPath, entry.root)) continue;
    if (!best || entry.root.length > best.root.length) best = entry;
  }
  return best;
}

/** Open a file in the active workspace tab or a standalone window. */
export async function openPathSmart(
  raw: string,
  opts?: { wsId?: string },
): Promise<void> {
  const st = useStore.getState();
  const wsId = opts?.wsId ?? st.activeId ?? undefined;
  const preferredRoot =
    wsId && st.loaded[wsId] ? st.loaded[wsId]!.meta.root : null;
  const abs = await resolveExistingFilePath(raw, preferredRoot);
  if (!abs) {
    toastError(
      `Can't open ${basename(normalizeFileLinkPath(raw))}: file not found`,
    );
    return;
  }

  const target = findWorkspaceForPath(abs);
  if (target) {
    if (st.activeId !== target.wsId) await st.setActiveWorkspace(target.wsId);
    await st.openFile(target.wsId, abs);
    return;
  }

  const roots = listWorkspaceRoots().map((w) => w.root);
  await popOutFile(abs, roots);
}
