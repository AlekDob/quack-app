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

## Related

- `gotcha-stamina-overhead-static-estimate.md` — overhead calculation
- `fix-daemon-missing-1m-context-betas.md` — 200k vs 1M context window
