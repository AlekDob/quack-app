// Cumulative pre-turn brain inject savings per workspace (Quack-side only).

import { getJson, setJson } from "./localStore";

export interface BrainCumulative {
  turns: number;
  savedTokens: number;
  savedMs: number;
}

const key = (wsId: string) => `lcp.brain.cum.${wsId}`;

const empty = (): BrainCumulative => ({
  turns: 0,
  savedTokens: 0,
  savedMs: 0,
});

function isCum(v: unknown): v is BrainCumulative {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.turns === "number" &&
    typeof o.savedTokens === "number" &&
    typeof o.savedMs === "number"
  );
}

export function getBrainCumulative(wsId: string): BrainCumulative {
  return getJson(key(wsId), empty(), isCum);
}

export function recordBrainUsage(
  wsId: string,
  savedTokens: number,
  savedMs: number,
): BrainCumulative {
  const cur = getBrainCumulative(wsId);
  const next: BrainCumulative = {
    turns: cur.turns + 1,
    savedTokens: cur.savedTokens + savedTokens,
    savedMs: cur.savedMs + savedMs,
  };
  setJson(key(wsId), next);
  return next;
}
