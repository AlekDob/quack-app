---
type: feature
project: quack-desktop
created: 2026-07-13
last_verified: 2026-07-13
tags: [composer, mention, chips, brain, files, skills, agents, cursor-style, ai-chat]
related: [054-pinky-brain-integration.md, 041-mention-file-preview.md, 004-subagent-mentions.md, 008-skill-slash-menu.md, 022-chat-composer.md]
---

# 072 — Composer mention chips (Cursor-style)

**Purpose:** When the user cites brain docs (`#`), files (`@`), subagents (`@`),
or a leading skill (`/skill-name`), show **colored inline chips inside the
composer input row** — not a separate strip above the pill. Each kind gets its
own icon and background tint (Cursor-style atomic mentions).

Chips are the **source of truth** for what gets injected on send; the textarea
holds only free-form prose (no `#Title` or `@path` tokens for brain/file/agent).

## Chip kinds

| Kind | Trigger | Icon | Background | Queue / state |
|---|---|---|---|---|
| **brain** | `#` popover pick | `brain` | `--info-bg` | `attachedBrainHits[]` on `ChatComposerDraft` |
| **file** | `@` file pick or tree drag | per-type `fileIconName` | `--bg-hi` | `workspaceChatContext` `attachedFiles` |
| **agent** | `@` subagent pick | duck avatar | `--bg-hi` | `attachedAgents[]` on session draft |
| **skill** | leading `/skill-name` in input | `zap` (orange) | `--skill-bg` | parsed from `input` (ephemeral until send) |

Work/story mentions (`@W-001`, `@S-001`) still insert a text token — no chip
(link + composer text for Plane refs; see `054-works-layer.md`).

## Layout

```
.ai-composer-shell
  ComposerContextBar / git / …
  .ai-input-row                    ← flex-wrap
    .composer-mention-chips        ← full-width row when any chip present
      .composer-mention-chip--*
    textarea.ai-input
    .ai-composer-hint              ← hidden when chips OR text present
  .ai-composer-meta
```

Popover menus (`#`, `@`, `/`) stay **above** `.ai-composer-shell` (unchanged
from 041 / 054). Only the **committed** picks render as chips inside the pill.

## `#` brain flow (feature 054)

1. User types `#` at start-of-string or after whitespace → `parseBrainMention`.
2. `BrainMentionSuggestions` — debounced `pinky.search`; empty query shows
   telemetry `most_used`. Rows use **brain icon** (not generic file).
3. Pick → `hitToAttached` → chip in row; **no** `#title` inserted in textarea.
4. On send → `fetchBrainContextForPaths` injects cited docs (bypasses auto-inject
   gates). Chips cleared; `brain_usage` → `BrainTurnChip` on user turn.

Full gate / auto-inject detail: **`054-pinky-brain-integration.md`**.

## `@` file / agent flow

- **File:** `acceptMention(file)` → `addAttachedFile` only (no `@rel` in text).
  Drag-from-tree (055) same outcome.
- **Agent:** `acceptMention(agent)` → `attachedAgents` only (no `@name` in text).
  Delegation line still injected on send from `attachedAgents` (004).

## `/` skill chip

`parseLeadingSkill(input, skills)` — when input starts with `/name` matching a
loaded skill, render an orange skill chip. Remove (`×`) strips the prefix via
`stripLeadingSkill`. Skill still dispatches as normal slash text on Enter.

## Persistence

| Field | Where |
|---|---|
| `attachedBrainHits` | `ChatComposerDraft` (`composerDraft.ts`) |
| `attachedAgents` | `ChatComposerDraft` |
| `attachedFiles` | per-workspace `workspaceChatContext` cache |
| skill chip | derived from live `input` — not persisted separately |

## Files

| File | Role |
|---|---|
| `src/components/ComposerMentionChips.tsx` | Chip row + `parseLeadingSkill` / `stripLeadingSkill` |
| `src/components/BrainMentionSuggestions.tsx` | `#` search popover (above shell) |
| `src/brainMention.ts` | `parseBrainMention`, `AttachedBrainHit`, accept helpers |
| `src/useBrainMentionSearch.ts` | Debounced Pinky search for `#` menu |
| `src/components/AIChatPanel.tsx` | Wires chips, popovers, send assembly |
| `src/composerDraft.ts` | `attachedBrainHits` on draft |
| `src/App.css` | `.composer-mention-chips`, `.composer-mention-chip--*` |

## Composer hint

When idle, empty input, no chips: `@ files · # brain · / commands · …`

## Related

- Brain gates + explicit inject: `054-pinky-brain-integration.md`
- `@` autocomplete + path preview: `041-mention-file-preview.md`
- Subagent delegation: `004-subagent-mentions.md`
- Slash / skills menu: `008-skill-slash-menu.md`
- Composer shell: `022-chat-composer.md`
