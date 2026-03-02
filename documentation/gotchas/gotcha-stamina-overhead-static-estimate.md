---
type: gotcha
project: quack-app
created: 2026-02-28
last_verified: 2026-03-02
tags: [stamina, tokens, overhead, context-receipt, sdk, countTokens]
---

# Gotcha: Static overhead estimate misses most system context

## The Problem

`calculateProjectOverhead()` in `conversationRecovery.ts` estimates overhead by reading CLAUDE.md files and counting MCP servers. This gives ~35k, but the REAL overhead can be 60k+ because it misses:

1. **`.claude/rules/*.md` files** — user can have 5+ rules files (Quack rules, APATR-D, use-code-graph, etc.)
2. **Skills definitions** — ~6.7k tokens loaded into context
3. **MCP tool definitions** — `mcpPerServer: 1500` was way too low (PostHog alone has ~40 tools, easily 10k+)
4. **Agent personality/custom agents** — agent headers and configurations

### Impact

`Messages = inputTokens - overhead`. With overhead underestimated by ~25k:
- Session with 1 message → shows Messages: 26.8k instead of ~400
- Stamina bar shows 78% instead of ~100% (fresh)
- User sees alarming "26.8k messages consumed" for a single Haiku message

## The Fix (v2 — countTokens API)

**Use the Anthropic `countTokens` API (FREE) to measure prompt tokens precisely, then calculate overhead.**

### How it works

1. **Node.js layer** (`stream-daemon.js` / `stream-claude.js`): Before executing the Agent SDK query, call `client.messages.countTokens()` with just the user's prompt. This returns the exact token count for the message content.

2. **Custom event**: Emit `{ type: 'prompt_token_count', promptTokens: N }` to the frontend (via the standard event pipeline).

3. **Frontend** (`App.tsx` → `handleTokenUpdate`): On the first assistant event with usage data, calculate:
   ```
   measuredOverhead = contextWindowFill - promptTokens
   ```
   This is PRECISE because contextWindowFill = overhead + promptTokens (on first turn, no prior messages).

4. **Caching**: `measuredOverhead` is stored in `chatTokensMap` per session and reused for all subsequent turns. Priority: `measuredOverhead` (API, precise) > `staticOverhead` (file-based estimate, fallback).

### Conditions

- Only runs for **Anthropic provider** (not Ollama/custom — no countTokens API)
- Only runs for **new sessions** (resumed sessions already have cached overhead in frontend)
- Runs **in parallel** with the query — does not add latency
- Falls back silently to static estimate if countTokens fails

## Failed approach (v1 — reverted)

Measuring overhead from first SDK response (`contextWindowFill ≈ overhead` on first turn) failed because when the first message includes images/attachments, their tokens inflate contextWindowFill, making measured overhead too high. All subsequent turns then showed Messages ≈ 0.

## Key Files

- `src-tauri/node-sdk/stream-daemon.js` — `countPromptTokens()` + parallel call in `handleQuery()`
- `src-tauri/node-sdk/stream-claude.js` — Same logic for legacy spawn path
- `src/App.tsx` — `handleClaudeEvent()` intercepts `prompt_token_count`, `handleTokenUpdate()` calculates `measuredOverhead`, `currentAgentTokens` prioritizes measured > static
- `src/services/conversationRecovery.ts` — `calculateProjectOverhead()` (static fallback)
- `src/components/TokenUsageModal.tsx` — `calculateBreakdown()` consumes overhead
- `src/components/StaminaBarBorder.tsx` — stamina percentage calculation

## Lesson

1. Never trust static estimates for dynamic system context — the SDK knows the truth.
2. The `countTokens` API is FREE and fast — use it for precise measurements.
3. When images/attachments are involved, the first turn's contextWindowFill is NOT just overhead.
