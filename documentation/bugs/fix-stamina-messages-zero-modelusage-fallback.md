---
type: bug_fix
created: 2026-02-13
tags: [token-tracking, stamina, prompt-caching, sdk, context-receipt, context-fill]
---

# Fix: Stamina Context Receipt always showing Messages: 0

## Problem

The Context Receipt modal always showed "Messages: 0" even after multiple conversation turns. The stamina bar showed 100% (fresh) regardless of actual context window usage. `/context` in the terminal correctly showed ~42k/200k (21%) with Messages: 8k tokens.

## Root Cause (TWO independent bugs)

### Bug 1: Prompt caching makes `input_tokens` only show non-cached tokens

With prompt caching enabled, `usage.input_tokens` from the Claude SDK represents ONLY the tokens that were NOT read from or used to create a cache. For example, `input_tokens: 24` when the actual context window fill is 42k.

**The real context window fill** for a single API call is:
```
context_fill = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

Our code was using `usage.input_tokens` alone as `inputTokens`, which was only 24 tokens. Then `Messages = inputTokens - overhead(38k)` = max(0, 24-38000) = 0.

Ref: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
> "input_tokens: Number of input tokens which were not read from or used to create a cache"

### Bug 2: Result event usage is CUMULATIVE, not per-turn

The Claude Agent SDK's `result` event contains **cumulative** usage across ALL internal API calls (steps) in the agentic session. So `cache_read: 137053` represents total cache reads across all steps, not the current context fill.

For accurate context fill display, we need the **last assistant message's usage**, which is **per-step** (per single API call). Each assistant message's `usage` shows exactly how many tokens went into that API call.

## Solution

### 1. Calculate context fill correctly (`handleTokenUpdate` in `src/App.tsx`)
Changed `inputTokens` from `usage.input_tokens` to `input_tokens + cache_read + cache_creation`:
```typescript
// BEFORE (wrong — only non-cached tokens)
inputTokens: usage.input_tokens

// AFTER (correct — full context window fill)
const contextWindowFill = usage.input_tokens + cacheRead + cacheCreation;
inputTokens: contextWindowFill
```

### 2. Use assistant events for per-step usage (`handleClaudeEvent` in `src/App.tsx`)
Extract `usage` from `assistant` events (per-API-call) instead of relying on `result` events (cumulative):
- Assistant events: per-step → accurate context fill
- Result events: cumulative → only used for `total_cost_usd`

### 3. Same fix in client-side SDK hook (`src/hooks/useClaudeChat.ts`)
Applied identical logic: assistant events for per-step context fill, result events as fallback only.

### 4. Removed wrong modelUsage fallback (Rust + React)
Previous attempt used `modelUsage` as fallback when `usage.input_tokens == 0`. This was wrong because:
- `input_tokens: 0` is valid with prompt caching (all tokens cached)
- `modelUsage` is also cumulative, not per-step
- The real fix is the cache-inclusive formula above

## Key Insights

1. **With prompt caching**: `input_tokens` != context fill. Must add cache tokens.
2. **Result event usage**: Cumulative across all agentic steps (not per-turn).
3. **Assistant message usage**: Per-step, per-API-call — this is the correct source for context fill.
4. **Formula**: `context_fill = input_tokens + cache_read_input_tokens + cache_creation_input_tokens`
5. **modelUsage type**:
   ```typescript
   { inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, costUSD, contextWindow, webSearchRequests }
   ```
   The `contextWindow` field is the model's max context window size (200k), not current fill.

## Files Changed
- `src-tauri/src/claude_cli.rs` - Removed modelUsage fallback, keep debug logging
- `src-tauri/node-sdk/stream-claude.js` - Added assistant event usage logging
- `src/App.tsx` - Cache-inclusive formula in handleTokenUpdate, assistant event tracking
- `src/hooks/useClaudeChat.ts` - Same cache-inclusive fix + per-step tracking

## Token Flow
SDK → Node.js stream → stdout → Rust parsing → Tauri event → React listener → handleClaudeEvent → handleTokenUpdate → chatTokensMap → StaminaBarBorder/TokenUsageModal

## Follow-up Fix: Auto-Compact Percentage Discrepancy

After the initial fix, the Total percentage in the UI still showed inflated values compared to the CLI `/context` output.

**Issue**: The `AUTO_COMPACT_COST` reserve (45k tokens) was being added to `totalContextUsage` in both `StaminaBarBorder.tsx` and `TokenUsageModal.tsx`. This caused:
- CLI showed: 36k/200k (18%)
- Quack UI showed: 80.7k/200k (40%)
- Difference: exactly 45k (the Auto-Compact reserve)

**Solution**: Removed `AUTO_COMPACT_COST` from the `totalContextUsage` calculation in percentage display:
```typescript
// BEFORE (wrong — inflated total)
totalContextUsage = inputTokens + outputTokens + AUTO_COMPACT_COST

// AFTER (correct — matches CLI)
totalContextUsage = inputTokens + outputTokens
```

**Result**: Total percentage now matches CLI `/context` output exactly.

**Key insight**: The FREE calculation still correctly subtracts the auto-compact reserve (it's a real constraint on usable tokens), but it's not shown in the percentage anymore — only applied to the FREE remaining tokens.

## Testing
1. Send a message and check Context Receipt — Messages should be non-zero
2. Compare with `/context` output in terminal — values should be in same ballpark
3. Stamina bar should decrease from 100% as conversation progresses
