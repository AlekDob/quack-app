// Pre-turn Pinky Brain context injection for AI chat turns.
// Survives Claude Code --resume because we append to the user message
// (ccTurnContext), not the system block that is dropped after turn one.

import { getJson, setJson } from "./localStore";
import { pinky, type PinkySearchHit } from "./pinky";
import { estimateBrainSavings, type BrainSavings } from "./brainSavings";
import type { BrainUsageMeta } from "./ai";
import { brainKey, findTabsPaneByTab, useStore } from "./store";
import { openFileAndReveal } from "./revealInTree";

const DOC_DIR = "documentation";
const injectKey = (wsId: string) => `lcp.brain.inject.${wsId}`;

/** Workspace root for brain IPC — null when the project is not loaded. */
export function brainWorkspaceRoot(wsId: string): string | null {
  return useStore.getState().loaded[wsId]?.meta.root ?? null;
}

export function getBrainInjectEnabled(wsId: string): boolean {
  return getJson<boolean>(
    injectKey(wsId),
    true,
    (v): v is boolean => typeof v === "boolean",
  );
}

export function setBrainInjectEnabled(wsId: string, on: boolean): void {
  setJson(injectKey(wsId), on);
}

/** Absolute path for a brain hit (paths are relative to documentation/). */
export function brainDocAbsPath(root: string, relPath: string): string {
  const rel = relPath.replace(/^\//, "");
  if (rel.startsWith(`${DOC_DIR}/`)) {
    return `${root}/${rel}`.replace(/\\/g, "/");
  }
  return `${root}/${DOC_DIR}/${rel}`.replace(/\\/g, "/");
}

/** Open a brain hit in the same editor pane as the Brain tab. */
export async function openBrainDoc(
  wsId: string,
  root: string,
  relPath: string,
): Promise<void> {
  const st = useStore.getState();
  const ws = st.loaded[wsId];
  if (!ws) return;
  const key = brainKey(wsId);
  const pane =
    findTabsPaneByTab(ws.layout.editorRoot, key) ??
    (ws.layout.bottomRoot
      ? findTabsPaneByTab(ws.layout.bottomRoot, key)
      : null);
  if (pane) st.setActivePane(wsId, pane.id);
  await openFileAndReveal(wsId, brainDocAbsPath(root, relPath));
}

function formatHit(hit: PinkySearchHit, index: number): string {
  const kind = hit.entry_type ?? "note";
  const snippet =
    hit.snippet.length > 280 ? `${hit.snippet.slice(0, 280)}…` : hit.snippet;
  return `${index + 1}. [${kind}] ${hit.title} (${hit.path})\n${snippet}`;
}

export function formatBrainBlock(query: string, hits: PinkySearchHit[]): string {
  const body = hits.map(formatHit).join("\n\n");
  return (
    `[Pinky Brain — relevant knowledge for: "${query.slice(0, 120)}"]\n` +
    `${body}\n` +
    `[/Pinky Brain]`
  );
}

function toUsageMeta(
  hits: PinkySearchHit[],
  savings: BrainSavings,
): BrainUsageMeta {
  return {
    hits: hits.map((h) => ({
      path: h.path,
      title: h.title,
      entry_type: h.entry_type,
    })),
    injectTokens: savings.injectTokens,
    savedTokens: savings.savedTokens,
    searchMs: savings.searchMs,
    savedMs: savings.savedMs,
  };
}

export interface BrainTurnContext {
  block: string;
  usage: BrainUsageMeta;
}

/** Hybrid search via local pinky CLI; null when unavailable or empty. */
export async function fetchBrainContextForQuery(
  root: string,
  query: string,
  limit = 3,
): Promise<BrainTurnContext | null> {
  const q = query.trim();
  if (!q || q.length < 8) return null;
  const t0 = performance.now();
  try {
    const res = await pinky.search(root, q.slice(0, 400), limit);
    const searchMs = Math.round(performance.now() - t0);
    if (res.results.length === 0) return null;
    const block = formatBrainBlock(q, res.results);
    const savings = estimateBrainSavings(res.results, block.length, searchMs);
    return { block, usage: toUsageMeta(res.results, savings) };
  } catch {
    return null;
  }
}

/** Pinky search with path dedup against an existing work manifest. */
export async function fetchBrainContextDeduped(
  root: string,
  query: string,
  excludePaths: Set<string>,
  limit = 2,
): Promise<BrainTurnContext | null> {
  const q = query.trim();
  if (!q || q.length < 8) return null;
  const t0 = performance.now();
  try {
    const res = await pinky.search(root, q.slice(0, 400), limit + 3);
    const searchMs = Math.round(performance.now() - t0);
    const filtered = res.results.filter((h) => {
      const p = h.path.replace(/\\/g, "/").toLowerCase();
      const base = p.split("/").pop() ?? p;
      return !excludePaths.has(p) && !excludePaths.has(base);
    }).slice(0, limit);
    if (filtered.length === 0) return null;
    const block = formatBrainBlock(q, filtered);
    const savings = estimateBrainSavings(filtered, block.length, searchMs);
    return { block, usage: toUsageMeta(filtered, savings) };
  } catch {
    return null;
  }
}

/** Hybrid search via local pinky CLI; null when unavailable or empty. */
export async function fetchBrainContextForTurn(
  root: string,
  query: string,
  limit = 3,
): Promise<BrainTurnContext | null> {
  return fetchBrainContextForQuery(root, query, limit);
}
