---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-10
tags: [session, usage, context, progress, claude-code, drawer, monitor, quack-v1]
---

# 023 — Session Usage Panel

**Purpose:** Composer **context ring** (Claude Code) + slide-over **Context &
Usage** drawer: context window fill %, OAuth plan limits (5hr / 7day), per-chat
billing metrics, and Quack spend totals.

Claude Code only for the ring + live context data. Other providers: drawer
hidden / ring absent.

## UI surfaces

| Surface | Location | Shows |
|---|---|---|
| `SessionUsageCircle` | Composer toolbar (`.ai-context-ring-dock`) | Ring % — context when known, else plan 5hr % |
| `SessionUsageDrawer` | Right slide-over (click ring) | Hero %, plan limits, This chat, Quack spend |
| `UsageChip` | Transcript footer (optional) | Last turn cost + in/out + cache hit % |

Ring stays pinned between turns (`pinnedContextRef`) so it does not flash empty
while a new turn streams.

## Dual metrics (do not mix)

| Metric | Meaning | Source |
|---|---|---|
| **Context %** | Input tokens in the model context window now | Last API `contextTokens` snapshot |
| **Plan %** | Claude.ai subscription utilization (5hr pool) | `claude_usage_limits` OAuth poll |
| **Billing tokens** | Turn cost accounting (may sum cache reads) | `result.usage` → `lastUsage.tokens` |

Hero ring prefers **context %** when `context.pct > 0`, else **plan 5hr %**.
See gotcha: `documentation/gotcha/cc-context-ring-result-usage.md`.

## Context window calculation

**Formula** (matches Anthropic + CC `/context` / statusline `used_percentage`):

```text
used = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
pct  = round(used / context_window × 100)
```

- **Input-only** — `output_tokens` excluded (same as CC statusline).
- **Per API call** — not summed across tool-loop calls in one user turn.
- **Window size** — `resolveContextWindow(selectedModel, catalog)`; Opus/Sonnet
  default 1M, else 200k from model metadata.

### Stream-json pipeline (`claudeCode.ts`)

```
stream_event.message_start  → fresh latestContextTokens + context_snapshot event
stream_event.message_delta  → merge + context_snapshot event
result (non-subagent)       → usage.tokens (billing) + contextTokens (ring)
```

`context_snapshot` events update the ring **mid-turn** (before `result`).
Attach/replay (`claude_code_attach`) parses the same stream_event usage fields.

`--include-partial-messages` required so `stream_event` lines arrive.

Subagent `result` events (`parent_tool_use_id`) are ignored for both metrics.

### Helpers (`contextUsage.ts`)

| Function | Role |
|---|---|
| `contextTokensFromApiUsage(usage, prev?)` | Parse one API usage object; merge deltas |
| `estimateContextUsed(context, fallbackIn)` | Ring/drawer `used` + `estimate` flag |
| `resolveContextWindow(model, catalog)` | Denominator for % |
| `contextFillPct(used, window)` | Clamped 0–100 |
| `fmtTokenCount(n)` | `1.2k` / `1.0M` labels |

Fallback when no snapshot yet: cumulative `tokensIn` only (never cumulative
cache read).

## Data flow

| Concern | Source | Rate |
|---|---|---|
| Context snapshot | `stream_event` via `claudeCode.ts` | Per API call in turn |
| Context ring / drawer context row | `lastUsage.contextTokens` | End of each turn |
| Plan limits (5hr, 7day, extra) | `claude_usage_limits` | 30s poll |
| Cumulative billing | `AIChatPanel` per-turn counters | Per `usage` event |
| Cost / turns / cache-read totals | `aiUsageLog` + drawer **This chat** | Per turn |
| Monthly spend | `aiUsageLog` aggregates | On drawer open |

## Components

| File | Role |
|---|---|
| `src/contextUsage.ts` | Context math + `contextTokensFromApiUsage` |
| `src/sessionUsageLocal.ts` | `buildSessionUsageLocal`, `sessionHeroPct`, plan limit parsers |
| `src/providers/claudeCode.ts` | Snapshot tracking; `contextTokens` on `usage` event |
| `src/ai.ts` | `ChatStreamEvent` — `usage.contextTokens`, `context_snapshot` |
| `src/components/SessionUsageCircle.tsx` | Ring button + tooltip |
| `src/components/SessionUsageDrawer.tsx` | Slide-over detail cards |
| `src/components/AIChatPanel.tsx` | Host, poll, cumulative state, `pinnedContextRef` |
| `src/App.css` | `.session-*`, `.usage-*` tokens |

## Triggers & interactions

- **Click** ring → open drawer
- **Esc** / backdrop / X → close drawer
- Plan poll runs while CC chat active; stops when provider changes
- **Open Usage Dashboard** → Usage tab (`usage:<wsId>`)

## Colour thresholds (ring + drawer bars)

| Range | Class | Meaning |
|---|---|---|
| <70% | default | Safe |
| 70–89% | `.warn` | Approaching limit |
| ≥90% | `.hot` | Near/at cap |

## Poll error handling (transient 429)

`claude_usage_limits` 429s on first poll are **silent** when no cache exists
(transient regex). Last-known `planCacheRef` kept. See table in prior revision —
unchanged (`AIChatPanel.tsx` poll `catch`).

## Gotchas

| Issue | Doc |
|---|---|
| `result.usage` sums cache reads → inflated context % | `gotcha/cc-context-ring-result-usage.md` |
| No per-category 5hr breakdown from Anthropic API | `gotcha/anthropic-session-budget-breakdown.md` |
| CC may warn before statusline hits 100% (output + compact buffer) | anthropics/claude-code#17959 |

## Related

- Claude Code bridge / stream-json: `014-claude-code-bridge.md`
- Composer shell (ring placement): `022-chat-composer.md`
- Usage monitor tab: `019-usage-monitor.md`
- Context optimizer (skills weight): `020-context-optimizer.md`
- CC sign-in (usage poll needs OAuth): `052-claude-code-login-ux.md`
