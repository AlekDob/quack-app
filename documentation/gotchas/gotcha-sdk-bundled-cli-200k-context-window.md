---
slug: gotcha-sdk-bundled-cli-200k-context-window
title: "SDK bundled CLI reports 200k context window for 1M models"
category: gotchas
tags: [sdk, context-window, compaction, cli]
created: 2026-03-16
severity: high
---

# SDK bundled CLI reports 200k context window for 1M models

## Problem

The TypeScript Claude Agent SDK (v0.2.76) bundles a `cli.js` that runs under Node.js. Despite being at **parity with Claude Code v2.1.76**, this bundled CLI reports a 200k context window for Opus 4.6 and Sonnet 4.6, which natively support 1M.

The context window is determined by a server-side feature flag (`tengu_hawthorn_window`). The bundled `cli.js` (running under Node) does not resolve this flag to 1M, while the **native binary** (`~/.local/bin/claude`, compiled with Bun) does.

## Symptoms

- `modelUsage.contextWindow` in SDK result events reports `200000` instead of `1000000`
- Auto-compaction triggers at ~155k tokens (77% of 200k) instead of ~950k (95% of 1M)
- The UI displayed "200k" as the context limit

## Root Cause

Both the SDK's bundled `cli.js` and the native `claude` binary are at version parity (2.1.76). The difference is the **runtime environment**:

| CLI variant | Runtime | `tengu_hawthorn_window` | Context window |
|------------|---------|------------------------|----------------|
| `~/.local/bin/claude` (native) | Bun (compiled arm64) | Resolves to 1M | 1,000,000 |
| SDK bundled `cli.js` | Node.js | Falls back to 200k | 200,000 |

The native binary likely resolves the feature flag through a different auth/telemetry path than the Node.js-spawned `cli.js`. The fallback in the CLI code is:

```js
// Deobfuscated from cli.js
function getContextWindow() {
  let value = getFeatureFlag("tengu_hawthorn_window", null);
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return 200000; // fallback
}
```

## Fix

Set `options.pathToClaudeCodeExecutable` to the installed native Claude CLI binary:

```js
// In stream-claude.js
const nativeClaudePath = join(homedir(), '.local', 'bin', 'claude');
if (existsSync(nativeClaudePath)) {
  options.pathToClaudeCodeExecutable = nativeClaudePath;
}
```

The SDK detects the path is not a `.js` file (via its internal `MU()` check) and spawns it directly instead of via Node.js. This gives us:

- Correct `modelUsage.contextWindow: 1000000` in result events
- Compaction at ~950k with 33k autocompact buffer
- UI displays the real context window

**Do NOT use a client-side override map** to "fix" the displayed value. If the SDK reports 200k, it IS operating at 200k (compacting at ~155k). Showing 1M would be misleading.

## The `context-1m-2025-08-07` beta flag

The SDK types say this flag is for "Sonnet 4/4.5 only" but the CLI's embedded docs say it applies to Opus 4.6 and Sonnet 4.6 too. However, this beta flag does **not** affect the bundled CLI's internal compaction threshold -- that is controlled by the server-side feature flag. The beta may affect API-side behavior but not the CLI subprocess.

## Rust serde gotcha

The `modelUsage` field arrives as camelCase (not `model_usage`) due to Rust's `#[serde(rename = "modelUsage")]`. Code must handle both:

```ts
const modelUsage = resultEvt.modelUsage || resultEvt.model_usage;
```

## When to remove the workaround

When the SDK's bundled `cli.js` running under Node.js correctly resolves the `tengu_hawthorn_window` feature flag to 1M. This is **not** a version issue -- v0.2.76 already has CLI parity with 2.1.76. The fix needs to come from Anthropic's feature flag service or the SDK's runtime environment.

Monitor by checking if the console logs `Context window from SDK: 1000000` without the `pathToClaudeCodeExecutable` override.

## Files modified

| File | Change |
|------|--------|
| `src-tauri/node-sdk/stream-claude.js` | Added `pathToClaudeCodeExecutable` pointing to native CLI, plus `betas` flag |
| `src/App.tsx` | Extracts `contextWindow` from SDK result events (no overrides), stores as `maxTokens` |
| `src/components/StaminaBarBorder.tsx` | Removed hardcoded 200k default, returns null until SDK reports |
| `src/components/TokenUsageIndicator.tsx` | Same pattern -- no fallback, waits for SDK value |
| `src/components/TokenUsageModal.tsx` | Dynamic info text using SDK-reported value |
| `src/services/conversationRecovery.ts` | Updated `TOKEN_LIMITS` to 1M for opus/sonnet |
