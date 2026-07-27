---
type: gotcha
project: quack-desktop
created: 2026-07-27
last_verified: 2026-07-27
tags: [claude-code, compact, context-usage, session-ring]
related: [023-session-usage-panel.md, 014-claude-code-bridge.md]
---

# Gotcha: context ring stayed stale after `/compact`

## Symptom

After `/compact` in Quack, the composer context ring + Context Usage popover
kept the **pre-compact** fill (e.g. 52% / 522k Tokens) while Claude Code's own
`/context` already showed the reduced size (~9% / ~90k).

## Why

| Layer | What went wrong |
|---|---|
| Ring source of truth | Last API `message_start` usage (or JSONL `last_context_snap`). Compaction does not emit a new honest API usage for the *post*-compact window until the next real user turn. |
| Ignored event | CC writes `system` / `subtype: compact_boundary` with `compactMetadata.postTokens` (and `preTokens`). Quack's stream parser only handled `init` among system subtypes. |
| JSONL mask | After the boundary, CC often appends an assistant `"No response requested."` with **all-zero** usage. Reverse walk hit that row first and returned zeros / never reached `postTokens`. |
| Disk poll | Even if JSONL were fixed, poll skipped updating when `liveContextTokens` was already set (stale pre-compact snap blocked the refresh). |

Upstream statusline has the same class of bug until the next API call
(anthropics/claude-code#19669); Quack can do better because `postTokens` is
already on the boundary event / JSONL.

## Fix (feature `023`)

| Surface | Change |
|---|---|
| `contextTokensFromCompactMeta` | Map `postTokens` / `post_tokens` → `TurnTokens` (`input` = used-total) |
| `claudeCode.ts` stream | `compact_boundary` → `context_snapshot`; skip zero-sum `message_start`/`message_delta` |
| `AIChatPanel` | Sync `lastUsage.contextTokens` on snapshot; idle disk poll steals when disk used &lt; 50% of live |
| `session_jsonl::last_context_snap_str` | Prefer `compact_boundary.postTokens`; skip zero assistant usage |

## Caveat

`postTokens` is a single used-total and can **undercount** vs CC `/context`
(static system / tools / memory / skills). Directionally correct for the ring
(big drop after compact); the next API `message_start` corrects to full fill.

## Verify

1. Grow a CC chat until the ring is clearly elevated.
2. Run `/compact` in Quack; wait for the Compacted transcript.
3. Ring + Context Usage popover should drop immediately (or within the 12s
   disk poll if the stream event was missed).
4. Optional: `/context` in a terminal on the same session — Quack may read
   slightly lower than CC's full breakdown until the next real turn.
