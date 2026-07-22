---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-22
last_verified: 2026-07-22
tags: [ai-chat, spend-limit, billing, claude-code, usage, transcript, warn-card]
related: [006-chat-tool-render.md, 023-session-usage-panel.md, 052-claude-code-login-ux.md]
---

# 091 — Spend limit card

**Purpose:** When Claude returns org/API **monthly spend limit** copy as plain
assistant prose, replace it with a warn card that graphs live usage meters and
links to Settings → Usage — instead of a raw one-liner that looks like a normal
reply.

**Problem:** Claude Code / Anthropic surfaces cap hits as text like
`You've hit your org's monthly spend limit · run /usage-credits to ask your
admin for a higher limit`. Quack rendered that as markdown + Copy / Insert /
Go deeper, so the limit looked like assistant content and offered a useless
“Go deeper” CTA.

**Related:** plan/extra meters + `claude_usage_limits` in
[023-session-usage-panel.md](023-session-usage-panel.md); chronology prose path
in [006-chat-tool-render.md](006-chat-tool-render.md); sibling warn-banner
pattern in [052-claude-code-login-ux.md](052-claude-code-login-ux.md).

## Files

| Type | Path | Role |
|------|------|------|
| Detect | `src/spendLimitMessage.ts` | `isSpendLimitText`, `splitSpendLimitText` |
| Test | `src/spendLimitMessage.test.ts` | Org-limit copy + prose/limit split |
| Card | `src/components/SpendLimitCard.tsx` | Warn chrome, meters, View usage CTA |
| Bridge | `src/components/ProseWithSpendLimit.tsx` | Prose → MD/stream **or** remainder + card |
| Compact | `src/components/chatToolRender.tsx` | `CompactBlocks` text nodes → `ProseWithSpendLimit` |
| Legacy | `src/components/AIChatPanel.tsx` | No-`blocks[]` assistant path + hide Go deeper |
| Parse | `src/sessionUsageLocal.ts` | `parseUsageLimits` / `parseUsageExtra` (reused) |
| CSS | `src/App.css` | `.ai-spend-limit-*` |

## Data flow

```
Assistant text (committed, !streaming)
  → splitSpendLimitText()
  → remainder? MarkdownPreview
  → SpendLimitCard(raw)
       → invoke claude_usage_limits
       → parseUsageExtra + parseUsageLimits
       → LimitBar rows (or fallback 100% “Org monthly spend”)
       → View usage → openSettings("ai-usage-cross-chat-dashboard")
```

Streaming tails stay as `StreamingPlainText` until the turn commits (avoids
partial-match flicker while the limit line is still typing in).

## Detection (`spendLimitMessage.ts`)

| API | Behavior |
|-----|----------|
| `isSpendLimitText(text)` | True if copy matches org/spend/usage-credits hints |
| `splitSpendLimitText(text)` | `null` if no match; else `{ remainder, limit }` |

**Hint regex (case-insensitive):** `you've hit … spend|usage limit`,
`monthly spend limit`, `/usage-credits`, `org('s|ization) monthly`.

**Split rules:**

| Case | Result |
|------|--------|
| Pure limit line | `remainder: ""`, `limit: full text` |
| Prose + limit on separate lines | Prose kept; matching lines → `limit` |
| Match only as whole blob (no line hit) | Entire trimmed text → `limit` |

## UI (`SpendLimitCard`)

```
┌ ⚠ Monthly spend limit reached          [View usage] ┐
│ Your org's Claude usage cap is full…                 │
│ Extra usage (monthly)     $47.20 / $100.00 USD       │
│ ████████████████████░░░░                             │
│ Session (5hr)                              92%       │
│ ██████████████████████░░   Resets in 1h 12m          │
│ You've hit your org's monthly spend limit · …        │
└──────────────────────────────────────────────────────┘
```

| Element | Detail |
|---------|--------|
| Chrome | `--warn-bg` / `--warn` border — same family as `ClaudeLoginBanner` |
| Title / body | Fixed English copy (not the raw Claude string) |
| Meters | Extra monthly first (cents → `$`), then plan windows from 023 |
| Fallback meter | If OAuth poll fails / empty: single **Org monthly spend** @ 100% |
| Raw line | Muted footer + `title=` for full Claude string |
| CTA | `openSettings("ai-usage-cross-chat-dashboard")` |
| a11y | `role="status"` |

`extra.used` / `extra.limit` are **cents** (same as Usage tab / popover).

## Wire-in points

| Surface | Hook |
|---------|------|
| Compact chronology (`blocks[]`) | `CompactBlocks` text → `ProseWithSpendLimit` |
| Legacy assistant (no blocks) | `AIChatPanel` `renderAt` → `ProseWithSpendLimit` |
| Message actions | Hide **Go deeper** when `isSpendLimitText(m.content)` |

## Key CSS

| Class | Role |
|-------|------|
| `.ai-spend-limit-card` | Card shell (warn surface) |
| `.ai-spend-limit-head` / `-copy` / `-title` / `-text` | Header row |
| `.ai-spend-limit-btn` | View usage pill |
| `.ai-spend-limit-meters` / `-bar*` | Progress tracks (`hot` → `--err` ≥80%) |
| `.ai-spend-limit-raw` | Original Claude line |

## Gotchas

- **Do not** treat this as a stream `result` / `is_error` event — today Claude
  emits the limit as **assistant text**. Detection is string-based on commit.
- **Do not** swap while `streaming` — wait for turn end so partial lines do not
  flash a card mid-token.
- Reuses `claude_usage_limits` (can 429 / fail offline) — card must still render
  with the fallback bar.
- English UI only (product rule); raw Claude string kept as secondary footer.
- Sibling of login banner (052), not a replacement for the Usage popover (023).
