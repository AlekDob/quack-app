// `#` brain mention parser and accept helpers for the chat composer.

import type { PinkySearchHit } from "./pinky";

export interface BrainMentionState {
  query: string;
  start: number;
  end: number;
}

export interface AttachedBrainHit {
  path: string;
  title: string;
  entry_type?: string | null;
}

export function parseBrainMention(
  input: string,
  cursor: number,
): BrainMentionState | null {
  if (cursor <= 0 || cursor > input.length) return null;
  let i = cursor - 1;
  while (i >= 0) {
    const ch = input[i];
    if (ch === "#") {
      if (i === 0 || /\s/.test(input[i - 1])) {
        return { query: input.slice(i + 1, cursor), start: i, end: cursor };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

export function brainMentionToken(title: string): string {
  return title.trim();
}

export function acceptBrainMentionText(
  input: string,
  state: BrainMentionState,
  hit: PinkySearchHit,
): string {
  const token = brainMentionToken(hit.title || hit.path);
  const before = input.slice(0, state.start);
  const after = input.slice(state.end);
  return `${before}#${token}${after.startsWith(" ") ? "" : " "}${after}`;
}

export function acceptBrainMentionCursor(
  state: BrainMentionState,
  hit: PinkySearchHit,
): number {
  const token = brainMentionToken(hit.title || hit.path);
  return state.start + 1 + token.length + 1;
}

export function hitToAttached(hit: PinkySearchHit): AttachedBrainHit {
  return {
    path: hit.path,
    title: hit.title || hit.path,
    entry_type: hit.entry_type,
  };
}

export function dedupeAttachedHits(hits: AttachedBrainHit[]): AttachedBrainHit[] {
  const seen = new Set<string>();
  const out: AttachedBrainHit[] = [];
  for (const h of hits) {
    const key = h.path.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}
