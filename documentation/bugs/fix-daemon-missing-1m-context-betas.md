---
type: bug
project: quack-app
created: 2026-03-23
last_verified: 2026-03-23
tags: [daemon, context-window, 1M, betas, auto-compact, session-limit]
---

# Fix: Daemon mode missing 1M context window beta flag

## Symptom
Users report "session limit" problems during intensive usage. Sessions auto-compact far too early (~155k tokens instead of ~967k), losing context and degrading experience.

## Root Cause

`stream-daemon.js` (the **default** code path for all sessions) was missing `options.betas = ['context-1m-2025-08-07']`.

`stream-claude.js` (legacy spawn path, rarely used) had it. The daemon was added later and this critical setting was not carried over.

Without the beta flag, the SDK's internal `uM()` function operates at 200k context window:
- `modelUsage.contextWindow` reports `200000` instead of `1000000`
- Auto-compaction triggers at ~155k tokens (77% of 200k) instead of ~967k (95% of 1M)
- The StaminaBarBorder shows fast stamina drain

### Secondary: `calculateTokenBudget()` double-counting (dead code)

`conversationRecovery.ts:calculateTokenBudget()` added `outputTokens + TOTAL_OVERHEAD` to `inputTokens`:
- `outputTokens` are generated tokens — they do NOT fill the context window
- `inputTokens` from SDK already includes overhead (system + tools + CLAUDE.md)

This made the percentage wildly inflated. However, this function is currently dead code (the `useClaudeChat` hook is not used as a React hook anywhere). Fixed for correctness in case it's re-enabled.

### Secondary: `TokenUsageIndicator` inconsistency

`TokenUsageIndicator.tsx` used a different formula than `StaminaBarBorder.tsx`:
- Added `AUTO_COMPACT_COST` (45k) to `totalContextUsage` (inflating percentage)
- Didn't subtract overhead from `maxUsableTokens`

Fixed to match `StaminaBarBorder` exactly.

## Fix

1. **`stream-daemon.js`**: Added `options.betas = ['context-1m-2025-08-07']` before query execution
2. **`stream-daemon.js`**: Added contextWindow logging on result events (same as stream-claude.js)
3. **`conversationRecovery.ts`**: Fixed `calculateTokenBudget()` to use only `inputTokens` for context fill
4. **`TokenUsageIndicator.tsx`**: Aligned formula with `StaminaBarBorder.tsx`

## Verification

After fix, daemon logs should show:
```
[QUERY] contextWindow for claude-opus-4-6: 1000000 (1M)
```

If it still shows `200000`, the beta flag alone isn't enough — fall back to `pathToClaudeCodeExecutable` pointing to the native CLI binary (see `gotcha-sdk-bundled-cli-200k-context-window.md`).

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/node-sdk/stream-daemon.js` | Added `options.betas`, contextWindow logging |
| `src/services/conversationRecovery.ts` | Fixed `calculateTokenBudget()` double-counting |
| `src/components/TokenUsageIndicator.tsx` | Aligned formula with StaminaBarBorder |
