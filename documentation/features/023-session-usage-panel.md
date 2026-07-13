---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-12
tags: [session, usage, context, progress, claude-code, popover, monitor, quack-v1]
---

# 023 — Session Usage Panel

**Purpose:** Composer **context ring** (Claude Code) + **Context Usage** popover
(Cursor-style): context window fill %, segmented breakdown by category, link to
the Usage tab for plan limits + billing.

Claude Code only for the ring + live context data. Other providers: ring absent.

## UI surfaces

| Surface | Location | Shows |
|---|---|---|
| `SessionUsageCircle` | Composer (`.ai-context-ring-dock`, above meta row) | Ring % — context when known, else plan 5hr % |
| `SessionUsagePopover` | Popover above ring (click toggle) | Hero %, segmented bar, per-category token rows, **plan limit bars** |
| `UsageChip` | Transcript footer (optional) | Last turn cost + in/out + cache hit % |
| Usage tab (`usage:<wsId>`) | Activity bar / Settings | Plan limits (5hr / 7day), This chat, Quack spend |

Ring stays pinned between turns (`pinnedContextRef`) so it does not flash empty
while a new turn streams.

### Popover layout (Cursor-style)

```
┌ Context Usage                    ✕ ┐
│ 18% Full                            │
│ 176.8k / 1.0M Tokens                │
│ ████░░░░░░░░░░░░░░░░  (segment bar) │
│ ■ System prompt           ~3.5k     │
│ ■ Tool definitions        ~8.7k     │
│ ■ Rules                   ~2.1k     │
│ ■ Skills                  ~4.0k     │
│ ■ MCP & dynamic tools       ~600    │
│ ■ Subagent definitions    ~1.3k     │
│ ■ Conversation            14.6k     │
│ ─ Plan limits ───────────────────── │
│ Session (5hr)              45%       │
│ ████████░░░░░░░░░░░░░░░░  (bar)     │
│ Resets in 2h 14m                    │
│ Weekly (7 day)             12%       │
│ ██░░░░░░░░░░░░░░░░░░░░░░  (bar)     │
│                    Usage dashboard →│
└─────────────────────────────────────┘
```

- **Liquid glass** shell (`.session-usage-pop.liquid-glass`), portaled to
  `document.body`, anchored above the ring (flips below when clipped).
- **Backdrop** — `.ai-flag-menu-overlay` (same dismiss pattern as
  `EffortPopover`).
- **Esc** / backdrop / X close the popover.
- **Usage dashboard →** closes popover and opens Settings → Usage (billing,
  monthly spend — full account detail beyond the inline plan bars).

## Dual metrics (do not mix)

| Metric | Meaning | Source | Ring / popover hero |
|---|---|---|---|
| **Context %** | Input tokens in the model context window now | Stream snapshot → JSONL fallback | **Yes** |
| **Plan %** | Claude.ai subscription utilization (5hr pool) | `claude_usage_limits` OAuth poll | Ring tooltip only; full detail in Usage tab |
| **Billing tokens** | Turn cost accounting (may sum cache reads) | `result.usage` → `lastUsage.tokens` | Usage tab **This chat** rows |

`sessionHeroPct` / composer ring use **context only** — never fall back to plan %.

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
| `estimateContextUsed(context, fallbackIn)` | Ring/popover `used` + `estimate` flag |
| `resolveContextWindow(model, catalog)` | Denominator for % |
| `contextFillPct(used, window)` | Clamped 0–100 |
| `fmtTokenCount(n)` | `1.2k` / `1.0M` labels |

Fallback when no stream snapshot: `claude_session_drawer_stats` (context +
billing + duration from JSONL) polls every 12s when `claudeSessionId` is known
(or guessed by turn count). Legacy `claude_session_context_usage` kept for
context-only reads. **Poll runs only when `wsActive` (`activeId === wsId`)** —
immediate catch-up on project switch-back; see `058-workspace-switch-performance.md`.

## Context breakdown (popover segments)

**Hybrid model:** the **total** (`context.used`) is live from the last API
snapshot; per-category rows are **estimated** unless noted. Rows marked `~` in
the UI are scans/heuristics, not CC's internal tokenizer.

Built by `buildContextBreakdown(root, contextUsed)` in `contextBreakdown.ts`.
Fetched lazily when the popover opens (not on every ring paint).

| Segment id | Label | Source | Estimate? |
|---|---|---|---|
| `system` | System prompt | Fixed baseline `3_500` (~CC order of magnitude) | Yes |
| `tools` | Tool definitions | Fixed baseline `8_700` | Yes |
| `rules` | Rules | `loadWorkspaceRules(root)` → `bytes / 4` | Yes |
| `skills` | Skills | `claude_context_assets` → sum `effective_tokens` where `kind === "skill"` | Yes |
| `mcp` | MCP & dynamic tools | `claude_mcp_list` → `servers.length × 600` | Yes |
| `subagents` | Subagent definitions | `claude_context_assets` → sum where `kind === "agent"` | Yes |
| `conversation` | Conversation | `contextUsed − sum(static segments)` (clamped ≥ 0) | **No** (derived from live total) |

**Scaling:** when static estimates exceed the live total, static rows are scaled
down to 90% of `contextUsed` before computing conversation — prevents negative
conversation on early-session low fills.

**Not yet modeled:** summarized/compact buffer, per-MCP tool defs, invoked skill
bodies, path-scoped rules loaded mid-turn. Claude Code's `/context` command has
the authoritative per-session breakdown; Quack does not parse it yet (see gotcha).

Segment colours: `.ctx-seg-{id}` tokens in `App.css` (semantic `color-mix`, no
hardcoded hex).

## Data flow

| Concern | Source | Rate |
|---|---|---|
| Context snapshot | `stream_event` via `claudeCode.ts` | Per API call in turn |
| Context ring / popover hero | `lastUsage.contextTokens` | End of each turn |
| Breakdown segments | `contextBreakdown.ts` on popover open | On demand |
| Plan limits (5hr, 7day, extra) | `claude_usage_limits` | 30s poll (foreground workspace only) |
| Cumulative billing | `AIChatPanel` per-turn counters | Per `usage` event |
| Cost / turns / cache-read totals | `aiUsageLog` + Usage tab | Per turn |
| Monthly spend | `aiUsageLog` aggregates | Usage tab open |

## Components

| File | Role |
|---|---|
| `src/contextUsage.ts` | Context math + `contextTokensFromApiUsage` |
| `src/sessionUsageLocal.ts` | `SessionUsageData` types, `buildSessionUsageLocal`, plan parsers |
| `src/contextBreakdown.ts` | Segment builder (assets + rules + MCP scan) |
| `src-tauri/src/claude_sessions.rs` | `claude_session_drawer_stats` + usage rollup |
| `src-tauri/src/session_jsonl.rs` | Shared `last_context_snap`, `claude_jsonl_path` |
| `src-tauri/src/context_assets.rs` | Skills/agents scan (shared with Usage → Context view) |
| `src/sessionDiskHydrate.ts` | JSONL merge helpers + session-id guess |
| `src/providers/claudeCode.ts` | Stream snapshot + `context_snapshot` events |
| `src/ai.ts` | `ChatStreamEvent` — `usage.contextTokens`, `context_snapshot` |
| `src/components/SessionUsageCircle.tsx` | Ring button + popover host (toggle state) |
| `src/components/SessionUsagePopover.tsx` | Cursor-style breakdown UI |
| `src/components/AIChatPanel.tsx` | Host, poll, cumulative state, `pinnedContextRef` |
| `src/App.css` | `.session-circle-btn`, `.session-usage-pop*`, `.ctx-seg-*` |

**Removed (2026-07-12):** `SessionUsageDrawer.tsx` — slide-over replaced by
popover. Plan limits, This chat KV, and Quack spend moved to the Usage tab;
popover footer links there.

## Triggers & interactions

- **Click** ring → toggle context popover
- **Esc** / backdrop / X → close popover
- **Usage dashboard →** → Settings Usage section (or Usage tab)
- Plan poll runs while CC chat active **and workspace foreground**; stops when
  provider changes or project blurred

## Colour thresholds (ring)

| Range | Class | Meaning |
|---|---|---|
| <70% | default | Safe |
| 70–89% | `.warn` | Approaching limit |
| ≥90% | `.hot` | Near/at cap |

## Poll error handling (transient 429)

`claude_usage_limits` 429s on first poll are **silent** — last-known
`planCacheRef` kept for ring tooltip plan %. No user-facing error in the
popover (billing detail lives in Usage tab). `AIChatPanel.tsx` poll `catch`
swallows transient failures.

## Gotchas

| Issue | Doc |
|---|---|
| `result.usage` sums cache reads → inflated context % | `gotcha/cc-context-ring-result-usage.md` |
| Breakdown segments are estimates, not CC `/context` | `gotcha/context-breakdown-estimates.md` |
| No per-category 5hr breakdown from Anthropic API | `gotcha/anthropic-session-budget-breakdown.md` |
| CC may warn before statusline hits 100% (output + compact buffer) | anthropics/claude-code#17959 |

## Related

- Claude Code bridge / stream-json: `014-claude-code-bridge.md`
- Composer shell (ring placement): `022-chat-composer.md`
- Usage monitor tab: `019-usage-monitor.md`
- Context optimizer (skills weight): `020-context-optimizer.md`
- CC sign-in (usage poll needs OAuth): `052-claude-code-login-ux.md`
- Workspace switch perf (poll + Monaco gates): `058-workspace-switch-performance.md`

## Future

- Parse Claude Code `/context` output (or an equivalent structured hook) for
  live per-category numbers matching CC's `analyzeContext` — replace static
  baselines for system/tools/MCP.
- Optional compact "Summarized conversation" segment when compaction is detectable
  from JSONL.
