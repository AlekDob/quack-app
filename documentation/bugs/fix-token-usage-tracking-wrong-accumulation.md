---
type: bug_fix
created: 2026-02-11
tags: [token-tracking, usage, context-window, sdk, accumulation-model]
---

# Fix: Token usage tracking - wrong accumulation model

## Problem

Token usage in Context Receipt showed incorrect values compared to Claude CLI `/context` output. Numbers grew unpredictably across conversation turns because the implementation was using an **additive accumulation model** that fundamentally misunderstood how the Claude SDK reports token usage.

- Token values showed 2x, 3x, 4x of expected amounts
- Each turn's `input_tokens` from SDK was being SUMMED across all previous turns
- But SDK's `input_tokens` per turn represents the FULL context window input, not incremental usage
- Summing across turns meant every token was counted multiple times as context grew
- Compact token optimization used fake 60% reduction estimate instead of real SDK values

## Root Cause

The token tracking system misunderstood what `input_tokens` means in the Claude SDK:

**Wrong understanding:**
- Assumed `input_tokens` = tokens used JUST in this turn (incremental)
- Summed across turns: `prev.inputTokens + usage.input_tokens`
- This caused exponential growth as context window filled with message history

**Correct understanding:**
- `input_tokens` = TOTAL tokens in context window for this turn (system + tools + ALL previous messages)
- Does not accumulate; it's already the full amount
- Only output_tokens are additive across turns

**Affected code:**
- `useClaudeChat.ts`: State update used `prev.inputTokens + usage.input_tokens`
- `App.tsx handleTokenUpdate`: Same additive pattern
- `TokenUsageModal.tsx`: Displayed accumulated wrong values
- Compact optimization estimated 60% reduction instead of tracking real post-compact values

## Solution

Changed from **additive accumulation** to **replacement model**:

```typescript
// BEFORE (wrong - additive)
setSessionTokens({
  inputTokens: prev.inputTokens + usage.input_tokens,
  outputTokens: prev.outputTokens + usage.output_tokens
})

// AFTER (correct - replacement)
setSessionTokens({
  inputTokens: usage.input_tokens,
  outputTokens: prev.outputTokens + usage.output_tokens
})
```

**Key changes:**
1. `input_tokens` is now set to the current value, not summed (replacement model)
2. `output_tokens` remain additive (only these increase turn-over-turn)
3. Compact reset tokens to 0, letting next SDK event report real post-compact values
4. Added cache tokens extraction: `cache_creation_input_tokens`, `cache_read_input_tokens`
5. Added `modelUsage` support for per-model breakdown from SDK
6. Fixed Messages calculation in Context Receipt: `Messages = inputTokens - overhead`

**Files changed:**
- `src/services/claudeSDK.ts` - Result event token extraction
- `src/hooks/useClaudeChat.ts` - Token state management
- `src/App.tsx` - Event handlers
- `src/components/TokenUsageModal.tsx` - Display logic
- `src/components/TokenUsageIndicator.tsx` - Indicator display
- `src/types.ts` - Type definitions for tokens

## Key Insight

**CORRECTION (2026-02-13):** With prompt caching, `input_tokens` is NOT the full context fill. It's only the non-cached portion. The full context fill is:
```
context_fill = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

Also, result event `usage` is CUMULATIVE across all agentic steps. For per-turn context fill, use assistant message `usage` instead.

For conversation tracking:
- Show `context_fill` (input + cache_read + cache_creation) from ASSISTANT events as context window usage
- Show `output_tokens` as cumulative (always growing)
- Use result event only for `total_cost_usd` (authoritative for billing)

## Testing

Verified against Claude CLI `/context` output - values now match actual API usage.
