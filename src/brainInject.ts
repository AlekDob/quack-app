// Pre-turn Pinky Brain context injection for AI chat turns.
// Survives Claude Code --resume because we append to the user message
// (ccTurnContext), not the system block that is dropped after turn one.

import {
  buildBrainQueryFromThread,
  filterBrainHitsByScore,
  getBrainGatePrefs,
  shouldAutoInjectBrain,
  type BrainGatePrefs,
} from "./brainGates";
import type { AttachedBrainHit } from "./brainMention";
import { getJson, setJson } from "./localStore";
import { pinky, type PinkySearchHit } from "./pinky";
import { estimateBrainSavings, type BrainSavings } from "./brainSavings";
import type { BrainUsageMeta, ChatMessage } from "./ai";
import { fs } from "./ipc";
import { warning } from "./notify";
import { basename } from "./pathUtils";
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
    false,
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
  const abs = brainDocAbsPath(root, relPath);
  try {
    if (!(await fs.exists(abs))) {
      warning(`${basename(abs)} doesn't exist yet`);
      return;
    }
  } catch {
    warning(`${basename(abs)} doesn't exist yet`);
    return;
  }
  const key = brainKey(wsId);
  const pane =
    findTabsPaneByTab(ws.layout.editorRoot, key) ??
    (ws.layout.bottomRoot
      ? findTabsPaneByTab(ws.layout.bottomRoot, key)
      : null);
  if (pane) st.setActivePane(wsId, pane.id);
  await openFileAndReveal(wsId, abs);
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

export function formatBrainBlockExplicit(hits: PinkySearchHit[]): string {
  const body = hits.map(formatHit).join("\n\n");
  return `[Pinky Brain — cited documentation]\n${body}\n[/Pinky Brain]`;
}

function applyScoreGate(
  hits: PinkySearchHit[],
  prefs?: BrainGatePrefs,
): PinkySearchHit[] {
  if (!prefs?.score.enabled) return hits;
  return filterBrainHitsByScore(hits, prefs.score.min);
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

function buildTurnContext(
  query: string,
  hits: PinkySearchHit[],
  searchMs: number,
  blockFn: (q: string, h: PinkySearchHit[]) => string = formatBrainBlock,
): BrainTurnContext {
  const block = blockFn(query, hits);
  const savings = estimateBrainSavings(hits, block.length, searchMs);
  return { block, usage: toUsageMeta(hits, savings) };
}

/** Hybrid search via local pinky CLI; null when unavailable or empty. */
export async function fetchBrainContextForQuery(
  root: string,
  query: string,
  limit = 3,
  prefs?: BrainGatePrefs,
): Promise<BrainTurnContext | null> {
  const q = query.trim();
  if (!q || q.length < 8) return null;
  const t0 = performance.now();
  try {
    const res = await pinky.search(root, q.slice(0, 400), limit + 2);
    const searchMs = Math.round(performance.now() - t0);
    const gated = applyScoreGate(res.results, prefs);
    const hits = gated.slice(0, limit);
    if (hits.length === 0) return null;
    return buildTurnContext(q, hits, searchMs);
  } catch {
    return null;
  }
}

/** Pinky search with path dedup against an existing work manifest. */
export async function fetchBrainContextDeduped(
  root: string,
  wsId: string,
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
    const filtered = applyScoreGate(
      res.results.filter((h) => {
        const p = h.path.replace(/\\/g, "/").toLowerCase();
        const base = p.split("/").pop() ?? p;
        return !excludePaths.has(p) && !excludePaths.has(base);
      }),
      getBrainGatePrefs(wsId),
    ).slice(0, limit);
    if (filtered.length === 0) return null;
    return buildTurnContext(q, filtered, searchMs);
  } catch {
    return null;
  }
}

export interface AutoBrainTurnOpts {
  wsId: string;
  messages: ChatMessage[];
  text: string;
  limit?: number;
}

/** Auto-inject with gate prefs; null when gated off or no hits. */
export async function fetchBrainContextForTurn(
  root: string,
  opts: AutoBrainTurnOpts,
): Promise<BrainTurnContext | null> {
  const prefs = getBrainGatePrefs(opts.wsId);
  if (!shouldAutoInjectBrain(opts.text, prefs)) return null;
  const query = prefs.thread.enabled
    ? buildBrainQueryFromThread(opts.messages, opts.text, prefs.thread.turns)
    : opts.text.trim();
  return fetchBrainContextForQuery(root, query, opts.limit ?? 3, prefs);
}

/** Explicit `#` citations — bypasses gates and auto-inject toggle. */
export async function fetchBrainContextForPaths(
  root: string,
  attached: AttachedBrainHit[],
): Promise<BrainTurnContext | null> {
  if (attached.length === 0) return null;
  const t0 = performance.now();
  const hits: PinkySearchHit[] = attached.map((a) => ({
    id: a.path,
    path: a.path,
    title: a.title,
    snippet: "",
    entry_type: a.entry_type ?? null,
    score: 1,
  }));
  try {
    for (let i = 0; i < hits.length; i++) {
      const abs = brainDocAbsPath(root, hits[i].path);
      try {
        const src = await fs.readFile(abs);
        const body = src.replace(/^---[\s\S]*?---\n?/, "").trim();
        hits[i] = {
          ...hits[i],
          snippet: body.length > 280 ? `${body.slice(0, 280)}…` : body,
        };
      } catch {
        /* keep empty snippet */
      }
    }
  } catch {
    return null;
  }
  const searchMs = Math.round(performance.now() - t0);
  return buildTurnContext(
    "cited documentation",
    hits,
    searchMs,
    (_q, h) => formatBrainBlockExplicit(h),
  );
}
