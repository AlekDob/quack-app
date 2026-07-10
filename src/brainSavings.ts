// Heuristic savings vs classic agent Read/Grep tool loops for the same context.

import type { PinkySearchHit } from "./pinky";

/** Tokens a Grep + tool-round overhead would cost before any file reads. */
const CLASSIC_GREP_BASE_TOKENS = 900;
/** Avg tokens when the agent Read's a full documentation file. */
const CLASSIC_READ_PER_FILE_TOKENS = 2800;
/** Per-tool JSON + result framing overhead. */
const CLASSIC_TOOL_OVERHEAD_TOKENS = 220;
/** Wall-clock per classic tool round (grep or read). */
const CLASSIC_TOOL_ROUND_MS = 2400;

export interface BrainSavings {
  injectTokens: number;
  classicTokens: number;
  savedTokens: number;
  searchMs: number;
  classicMs: number;
  savedMs: number;
}

export function estimateBrainSavings(
  hits: PinkySearchHit[],
  blockChars: number,
  searchMs: number,
): BrainSavings {
  const n = hits.length;
  const injectTokens = Math.ceil(blockChars / 4);
  const classicTokens =
    CLASSIC_GREP_BASE_TOKENS +
    n * (CLASSIC_READ_PER_FILE_TOKENS + CLASSIC_TOOL_OVERHEAD_TOKENS);
  const classicMs = CLASSIC_TOOL_ROUND_MS + n * CLASSIC_TOOL_ROUND_MS;
  return {
    injectTokens,
    classicTokens,
    savedTokens: Math.max(0, classicTokens - injectTokens),
    searchMs,
    classicMs,
    savedMs: Math.max(0, classicMs - searchMs),
  };
}

export function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
