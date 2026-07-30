---
type: feature
project: quack-desktop
created: 2026-07-13
last_verified: 2026-07-30
tags: [composer, mention, chips, brain, files, skills, agents, features, cursor-style, ai-chat, inline-highlight]
related: [054-pinky-brain-integration.md, 054-works-layer.md, 083-composer-feature-link.md, 041-mention-file-preview.md, 004-subagent-mentions.md, 008-skill-slash-menu.md, 022-chat-composer.md, 055-file-composer-drag.md]
---

# 072 — Composer mention chips (Cursor-style)

**Purpose:** When the user cites brain docs (`#`) or subagents (`@`), show **colored chips** above the composer textarea. **Files**, **features**, and **skills** render as **colored inline text** in the textarea via `ComposerInputHighlight`.

Chips are the source of truth for brain/agent on send. File cites insert `@rel/path` into the textarea (and still queue in `workspaceChatContext` for the turn context + Context dock). Skills/features live in the input text.

## Chip kinds (chip row only)

| Kind | Trigger | Icon | Background | Queue / state |
|---|---|---|---|---|
| **brain** | `#` popover pick | `brain` | `--info-bg` | `attachedBrainHits[]` on `ChatComposerDraft` |
| **agent** | `@` subagent pick | duck avatar | `--bg-hi` | `attachedAgents[]` on session draft |

## Inline (not chips)

| Kind | Trigger | Render | State |
|---|---|---|---|
| **file** | `@` file pick, tree drag, `/file` | `@rel/path` blue (`--file-link-fg`) | `attachedFiles` + text token |
| **feature** | `@` feature pick or Feature pill | `@slug` green underline (`--feature`) | `featureId` on chat; see `083` |
| **skill** | `/skill-name` in input | `/name` orange (`--skill`) | lives in `input` text |

Legacy work/story mentions (`@W-001`, `@S-001`) may still insert a text token when a Works snapshot is present.

## Layout

```
.ai-composer-shell
  .ai-input-row
    .composer-mention-chips     ← brain | agent only
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
| file | inserts `@rel/path` | queue only (no chip row) |
| agent | unchanged | agent chip |
| feature | inserts `@slug` | `featureId` (no chip) |

## `/` skill

Rendered orange via highlight mirror; dispatches as normal slash text on Enter. `parseLeadingSkill` / `stripLeadingSkill` remain in `ComposerMentionChips.tsx` for helpers; no skill chip row.

## Files

| File | Role |
|---|---|
| `src/components/ComposerMentionChips.tsx` | Chip row (brain/agent) + skill parse helpers |
| `src/composerInputHighlight.ts` | Token spans + backdrop HTML (skill / feature / file) |
| `src/components/ComposerInputHighlight.tsx` | Mirror behind textarea |
| `src/components/BrainMentionSuggestions.tsx` | `#` popover |
| `src/components/MentionSuggestions.tsx` | `@` popover rows |
| `src/components/AIChatPanel.tsx` | Wire-up |
| `src/App.css` | `.composer-mention-chip--*`, `.tok-skill` / `.tok-feature` / `.tok-file`, `--feature` |

## Composer hint

Idle, empty input, no chips: `@ files · features · # brain · / commands · …`

## Related

- `083-composer-feature-link.md` — pill, fuzzy popover, infinite scroll, hub badge
- `041-mention-file-preview.md` — `@` file autocomplete + path preview
- `055-file-composer-drag.md` — explorer drag → `@rel` + context queue
- `004-subagent-mentions.md` — agent delegation
- `008-skill-slash-menu.md` — `/` skills menu
- `022-chat-composer.md` — composer shell
