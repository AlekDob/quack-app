---
type: gotcha
created: 2026-07-10
last_verified: 2026-07-10
tags: [claude-code, context, usage, cache, stream-json, anthropic]
---

# Claude Code: `result.usage` inflates the context ring

**Problem:** Claude Code's stream-json `result` event carries **turn-total**
billing tokens. On agentic turns (many internal tool-loop API calls), it
**sums** `cache_read_input_tokens` across every call. Each call re-reads the
same cached prefix — so the sum counts that prefix N times (e.g. 243k × several
loops → ~32% context while CC `/context` shows ~6%).

**Impact:** Quack's composer ring + Context & Usage drawer hero % were wrong
for any CC chat with heavy tool use. Cost / "Cache read" in **This chat** were
still correct (billing totals).

**Root cause:** Confusing **billing aggregation** (`result.usage`) with
**context window fill** (last API response snapshot).

## Correct source (Anthropic + Claude Code)

Per [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
and [Claude Code statusline](https://code.claude.com/docs/en/statusline):

```text
total_input_tokens =
  input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

- Measured on the **most recent API response** only (input-side; no `output_tokens`).
- In streaming: `usage` on `message_start` and final `message_delta`.

## Quack fix

| Concern | Source | Field |
|---|---|---|
| Context ring / drawer % | Last API call snapshot | `usage.contextTokens` |
| Cost chip / cumulative ledger | Turn total | `usage.tokens` from `result` |

Pipeline:

1. `claudeCode.ts` — track `latestContextTokens` per internal API call from
   `stream_event` → `message_start` (fresh) + `message_delta` (merge via
   `contextTokensFromApiUsage`). Attach on non-subagent `result` as
   `contextTokens`. Ignore subagent `result` events.
2. `contextUsage.ts` — `estimateContextUsed(contextTokens, fallbackIn)`; never
   sum cumulative cache reads for context %.
3. `AIChatPanel.tsx` — ring + drawer use `lastUsage.contextTokens`; billing
   still uses `lastUsage.tokens` + cumulative counters.

## Merge rule (`message_delta`)

Some deltas carry only `output_tokens`. Merging must **not** zero out cache
fields already set on `message_start`. `contextTokensFromApiUsage(usage, prev)`
updates only fields present in the delta object.

## Related

- Feature: `documentation/features/023-session-usage-panel.md`
- Bridge / stream-json: `documentation/features/014-claude-code-bridge.md`
- Anthropic has no per-category 5hr breakdown: `anthropic-session-budget-breakdown.md`
- CC internal limit vs statusline % gap (output + compact buffer): anthropics/claude-code#17959
