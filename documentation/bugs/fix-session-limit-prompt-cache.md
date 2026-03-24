---
type: bug
project: quack-app
created: 2026-03-23
last_verified: 2026-03-23
tags: [session-limit, rate-limit, prompt-cache, performance, tokens]
---

# Fix: Session limit drains fast due to broken prompt cache

## Symptom

Users report the Claude session limit ("Sessione corrente" bar in Claude settings) drains much faster when using Quack than expected. Intensive sessions exhaust the limit in a fraction of the expected time.

## Root Cause

**Quack appended dynamic content to the system prompt**, invalidating the prompt cache on every turn.

### What was happening

The system prompt included:
1. **`ideContext`** (open file, git status, selection) — changes every time the user switches files
2. **`gitContext`** (last 5 commits + uncommitted changes) — changes after every commit

Since the Claude API caches system prompts by **prefix match**, any change to the appended content invalidated the cache for the **entire** system prompt (~50k+ tokens including CLAUDE.md, tool definitions, rules, skills).

### Impact on rate limit

- **With cache**: Cached tokens count at **1/10th** toward the session rate limit
- **Without cache**: Every token counted at full price
- **Cost multiplier**: Up to **10x** more rate limit consumption per message when the cache breaks

Example: A system prompt of 50k tokens:
- Cached: 50k * 0.1 = 5k effective toward rate limit
- Uncached: 50k * 1.0 = 50k effective toward rate limit
- Over 20 messages: 100k vs 1M difference in rate limit consumption

## Fix

### 1. Moved dynamic context from systemPrompt to user prompt

`ideContext` and `gitContext` are now prepended to the user's prompt as a `<system-reminder>` block instead of being appended to the system prompt. This keeps the system prompt **static** between turns, preserving the prompt cache.

**Before:**
```js
systemPrompt: {
  append: '...' + ideContext + gitContext  // Changes every turn → cache miss
}
```

**After:**
```js
systemPrompt: {
  append: '...'  // Static → cache hit
}
// ideContext + gitContext prepended to user prompt
finalPrompt = `${prompt}\n\n<system-reminder>\n${contextPrefix}\n</system-reminder>`
```

### 2. Rate limit error detection

Added detection of 429/rate_limit errors in `App.tsx` with a user-friendly Italian message explaining:
- What happened (session limit reached)
- How to check the countdown
- Alternatives (switch to Haiku, enable extended usage)

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/node-sdk/stream-daemon.js` | Moved ideContext + gitContext from systemPrompt to user prompt contextPrefix |
| `src-tauri/node-sdk/stream-claude.js` | Same change for legacy spawn path |
| `src/App.tsx` | Rate limit error detection with user-friendly message |

## Verification

1. Send multiple messages in the same session
2. Check backend logs: `cache_read_input_tokens` should be high (>30k) on the 2nd+ message
3. Monitor the session limit bar — it should drain ~10x slower than before

## Ongoing investigation (2026-03-24)

### Native CLI cache regression (CC Issue #34629)

Fredric Nilgran (Anthropic) tested Quack's prompt caching behavior and found:
- **Quack**: ~6,200 tokens uncached per message
- **CC CLI native**: ~300 tokens uncached per message
- cache_read stuck at ~35k (system prompt only), cache_creation ~47k per turn

Root cause: cache breakpoint placement regression since CC v2.1.69 ([github.com/anthropics/claude-code/issues/34629](https://github.com/anthropics/claude-code/issues/34629)). Only the system prompt is cached; conversation history is `cache_create`d from scratch every turn.

v2.1.72 release notes claim "Fixed prompt cache invalidation in SDK query() calls, reducing input token costs up to 12x" but Fred confirmed the problem persists even with native CLI v2.1.81.

The only confirmed working version is **v2.1.68** (pinned at `~/.claude-code-pinned/bin/claude`).

### Actions taken
1. Added `pathToClaudeCodeExecutable` in stream-daemon.js and stream-claude.js pointing to native CLI (commit `8fe115c`)
2. Installed v2.1.68 at `~/.claude-code-pinned/bin/claude` for testing
3. **Pending**: pin to v2.1.68 if Fred's testing confirms the fix with standard vs premium plan

### SDK Issue #89 — cache breakpoint overflow
The SDK's bundled `cli.js` applies `cache_control: { type: 'ephemeral' }` to ALL system prompt blocks, exceeding the API limit of 4 breakpoints. A community user patched the `cli.js` and cache efficiency jumped from 49.7% to 91-98%.

### SDK Issue #188 — forced 1h cache TTL
SDK forces 1-hour cache TTL with no configuration option. Cache writes cost 2x base price instead of 1.25x with 5-min TTL.

## Related

- `gotcha-stamina-overhead-static-estimate.md` — overhead calculation
- `fix-daemon-missing-1m-context-betas.md` — 200k vs 1M context window
