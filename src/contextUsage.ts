import type { ProviderModel } from "./providers/types";
import { parseQualifiedModel } from "./providers/types";

export interface TurnTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
}

/** Tokens occupying the context window on the last turn (or estimate). */
export function estimateContextUsed(
  last: TurnTokens | undefined,
  fallbackIn: number,
  fallbackCache: number,
): { used: number; estimate: boolean } {
  if (last) {
    return {
      used: last.input + last.cacheRead + last.cacheCreate,
      estimate: false,
    };
  }
  if (fallbackIn + fallbackCache > 0) {
    return { used: fallbackIn + fallbackCache, estimate: true };
  }
  return { used: 0, estimate: true };
}

const OPUS_CTX = 1_000_000;
const DEFAULT_CTX = 200_000;

export function resolveContextWindow(
  selectedQualified: string | null,
  models: ProviderModel[],
): number {
  const parsed = parseQualifiedModel(selectedQualified ?? "");
  if (!parsed) return DEFAULT_CTX;
  const hit = models.find(
    (m) =>
      m.providerId === parsed.providerId && m.modelId === parsed.modelId,
  );
  if (hit?.contextWindow) return hit.contextWindow;
  const id = parsed.modelId.toLowerCase();
  if (id.includes("opus") || id.includes("sonnet")) return OPUS_CTX;
  return DEFAULT_CTX;
}

export function contextFillPct(used: number, window: number): number {
  if (window <= 0 || used <= 0) return 0;
  return Math.min(100, Math.round((used / window) * 100));
}

export function fmtTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
