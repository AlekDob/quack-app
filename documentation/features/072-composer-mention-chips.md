---
type: feature
project: quack-desktop
created: 2026-07-13
last_verified: 2026-07-17
tags: [composer, mention, chips, brain, files, skills, agents, features, cursor-style, ai-chat, inline-highlight]
related: [054-pinky-brain-integration.md, 054-works-layer.md, 083-composer-feature-link.md, 041-mention-file-preview.md, 004-subagent-mentions.md, 008-skill-slash-menu.md, 022-chat-composer.md]
---

# 072 — Composer mention chips (Cursor-style)

**Purpose:** When the user cites brain docs (`#`), files (`@`), or subagents (`@`), show **colored inline chips** inside the composer input row. **Features** and **skills** are **not** chips — they render as colored inline text in the textarea (see `083` + `ComposerInputHighlight`).

Chips are the source of truth for brain/file/agent on send; the textarea holds free-form prose (no `#Title` or `@path` tokens for those kinds).

## Chip kinds (chip row only)

| Kind | Trigger | Icon | Background | Queue / state |
|---|---|---|---|---|
| **brain** | `#` popover pick | `brain` | `--info-bg` | `attachedBrainHits[]` on `ChatComposerDraft` |
| **file** | `@` file pick or tree drag | per-type `fileIconName` | `--bg-hi` | `workspaceChatContext` `attachedFiles` |
| **agent** | `@` subagent pick | duck avatar | `--bg-hi` | `attachedAgents[]` on session draft |

## Inline (not chips)

| Kind | Trigger | Render | State |
|---|---|---|---|
| **feature** | `@` feature pick or Feature pill | `@slug` green underline (`--feature`) | `featureId` on chat; see `083` |
| **skill** | `/skill-name` in input | `/name` orange (`--skill`) | lives in `input` text |

Legacy work/story mentions (`@W-001`, `@S-001`) may still insert a text token when a Works snapshot is present.

## Layout

```
.ai-composer-shell
  .ai-input-row
    .composer-mention-chips     ← brain | file | agent only
    .ai-input-highlight-wrap
      .ai-input-highlight-backdrop   ← colored mirror
      textarea.ai-input--ghost
    .ai-composer-hint
  .ai-composer-meta
    ComposerFeaturePill (icon, when unlinked)
```

Popover menus (`#`, `@`, `/`) stay **above** `.ai-composer-shell`.

## `#` brain flow

1. `#` at start-of-string or after whitespace → `parseBrainMention`.
2. `BrainMentionSuggestions` — debounced `pinky.search`.
3. Pick → chip; **no** `#title` in textarea.
4. On send → `fetchBrainContextForPaths`. Detail: `054-pinky-brain-integration.md`.

## `@` file / agent / feature

| Pick | Textarea | Chip / link |
|---|---|---|
| file | unchanged | file chip |
| agent | unchanged | agent chip |
| feature | inserts `@slug` | `featureId` (no chip) |

## `/` skill

Rendered orange via highlight mirror; dispatches as normal slash text on Enter. `parseLeadingSkill` / `stripLeadingSkill` remain in `ComposerMentionChips.tsx` for helpers; no skill chip row.

## Files

| File | Role |
|---|---|
| `src/components/ComposerMentionChips.tsx` | Chip row (brain/file/agent) + skill parse helpers |
| `src/composerInputHighlight.ts` | Token spans + backdrop HTML |
| `src/components/ComposerInputHighlight.tsx` | Mirror behind textarea |
| `src/components/BrainMentionSuggestions.tsx` | `#` popover |
| `src/components/MentionSuggestions.tsx` | `@` popover rows |
| `src/components/AIChatPanel.tsx` | Wire-up |
| `src/App.css` | `.composer-mention-chip--*`, `.ai-input-highlight-*`, `--feature` |

## Composer hint

Idle, empty input, no chips: `@ files · features · # brain · / commands · …`

## Related

- `083-composer-feature-link.md` — pill, fuzzy popover, infinite scroll, hub badge
- `041-mention-file-preview.md` — `@` file autocomplete + path preview
- `004-subagent-mentions.md` — agent delegation
- `008-skill-slash-menu.md` — `/` skills menu
- `022-chat-composer.md` — composer shell
