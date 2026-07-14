import type { ProviderModel } from "./providers/types";
import { parseQualifiedModel } from "./providers/types";

export interface TurnTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
}

const numTok = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/**
 * Input-side usage from one Anthropic API call (`message_start` or final
 * `message_delta`). Merges with `prev` when a delta only carries a subset
 * (e.g. output-only events must not zero out cache fields from message_start).
 */
export function contextTokensFromApiUsage(
  usage: Record<string, unknown> | undefined,
  prev?: TurnTokens,
): TurnTokens | undefined {
  if (!usage) return prev;
  const hasInput = typeof usage.input_tokens === "number";
  const hasCacheRead = typeof usage.cache_read_input_tokens === "number";
  const hasCacheCreate = typeof usage.cache_creation_input_tokens === "number";
  if (!hasInput && !hasCacheRead && !hasCacheCreate) return prev;
  return {
    input: hasInput ? numTok(usage.input_tokens) : (prev?.input ?? 0),
    output: 0,
    cacheRead: hasCacheRead
      ? numTok(usage.cache_read_input_tokens)
      : (prev?.cacheRead ?? 0),
    cacheCreate: hasCacheCreate
      ? numTok(usage.cache_creation_input_tokens)
      : (prev?.cacheCreate ?? 0),
  };
}

/** Tokens occupying the context window on the last API call (or estimate). */
export function estimateContextUsed(
  context: TurnTokens | undefined,
  fallbackIn: number,
): { used: number; estimate: boolean } {
  if (context) {
    return {
      used: context.input + context.cacheRead + context.cacheCreate,
      estimate: false,
    };
  }
  // Never sum cumulative cache reads — each turn re-reads the same prefix.
  if (fallbackIn > 0) {
    return { used: fallbackIn, estimate: true };
  }
  return { used: 0, estimate: true };
}

const OPUS_CTX = 1_000_000;
const DEFAULT_CTX = 200_000;

/** Claude Code picker alias → advertised context window for ring + browser. */
export function ccAliasContextWindow(modelId: string): number {
  const id = modelId.toLowerCase();
  if (id === "haiku" || id === "fable") return DEFAULT_CTX;
  if (id.includes("sonnet") || id.includes("opus")) return OPUS_CTX;
  return id.includes("[1m]") ? OPUS_CTX : DEFAULT_CTX;
}

export function resolveContextWindow(
  selectedQualified: string | null,
  models: ProviderModel[],
): number {
  const parsed = parseQualifiedModel(selectedQualified ?? "");
  if (!parsed) return DEFAULT_CTX;
  const id = parsed.modelId.toLowerCase();
  // CC aliases (`sonnet`, `opus`) map to 1M models even without a `[1m]`
  // suffix — must beat the dynamic catalog, which used to assign 200k.
  if (parsed.providerId === "claude-code") {
    return ccAliasContextWindow(parsed.modelId);
  }
  const hit = models.find(
    (m) =>
      m.providerId === parsed.providerId && m.modelId === parsed.modelId,
  );
  if (hit?.contextWindow) return hit.contextWindow;
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
