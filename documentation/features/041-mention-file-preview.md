---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-05
last_verified: 2026-07-13
tags: [composer, mention, autocomplete, files, path-preview, ai-chat, cursor-style, drag-drop]
---

## @-Mention File Path Preview

**Purpose:** Cursor-style autocomplete when the user types `@` in the chat
composer: file rows show **filename + parent directory**, and a **side tree
preview** (`src → components → File.tsx`) with file-tree indent guides helps
disambiguate same-named files. Subagent rows keep the duck avatar + description
from feature 004.

**Stack:** React 19, plain CSS tokens (`App.css`), lazy `search.listFiles` IPC.

### Files

| Type | Path | Role |
|---|---|---|
| Component | `src/components/MentionSuggestions.tsx` | Two-column popover: match list + optional path preview; exports `MentionItem` |
| Component | `src/components/MentionPathPreview.tsx` | Mini path tree for the highlighted file row |
| Host | `src/components/AIChatPanel.tsx` | `parseMention`, `mentionState`/`mentionIndex`, `mentionMatches`, `acceptMention`, `citeFileFromDrop`; toggles `.ai-mention-open` on `.ai-panel` |
| Service | `src/fileComposerDrag.ts` | Pointer drag from explorer → composer cite (055); shares `addAttachedFile` outcome |
| Styles | `src/App.css` | `.ai-mention-popover*`, `.ai-mention-path-*`, overflow escape rules |
| Utils | `src/pathUtils.ts` | `basename`, `dirname`, `relPath` for row labels |
| Icons | `src/fileIcons.ts` | `fileIconName` per extension in list + preview leaf |

### Data flow

```
Keystroke in textarea
  → parseMention(input, cursor)
  → mentionState { query, start, end }
  → lazy search.listFiles(root, 5000) → mentionFiles cache
  → mentionMatches: agents (≤4) then files (≤8 total)
  → MentionSuggestions (keyboard/mouse pick)
  → acceptMention: splice @token, addAttachedFile or attachedAgents
```

### Popover layout

- **Placement:** inline in `.ai-panel`, stacked **above** `.ai-composer-shell`
  (same slot as slash suggestions / agent chips). **Not portaled** — fixed
  portal was tried and reverted (broke two-column flex layout).
- **Shell:** `.ai-mention-popover` — flex row, `max-height: 220px`, shares
  horizontal margin with composer (`0 10px`), top radii only, `border-bottom:
  none` so it reads as one surface with the composer pill below.
- **Left:** `.ai-mention-list` reuses `.ai-slash-suggestions` scroll list.
  - **Agent row:** avatar + `@name` + description hint (unchanged from 004).
  - **File row:** type icon + **basename** (primary) + **dirname(rel)** (muted mono subtitle).
- **Right:** `.ai-mention-path-preview` (168px) — only when the **active**
  keyboard/hover index is a `file` item. Each segment is a `.ai-mention-path-row`
  with `--tree-depth` indent guides (same repeating-gradient pattern as
  `.tree-row::before` in the explorer).

### Clipping fix (overflow)

`.ai-panel { overflow: hidden }` clips anything that extends past the panel
box (including a tall mention menu above the composer). While the menu is open:

| Selector | Rule |
|---|---|
| `.ai-panel.ai-mention-open` | `overflow: visible` |
| `.ai-tab-host:has(.ai-mention-open)` | `overflow: visible` |
| `.ai-side-panel-body:has(.ai-mention-open)` | `overflow: visible` |

`AIChatPanel` adds `ai-mention-open` when `mentionState && mentionMatches.length > 0`
(including during an active turn / follow-up queue). Scrolling stays on
`.ai-messages { overflow-y: auto }` — only the panel chrome escape hatch changes.

**Do not** portal this menu to `document.body` for clipping alone — it breaks
width alignment and the list/preview flex row.

### Keyboard

Same as before (handled in `AIChatPanel` textarea `onKeyDown`):

| Key | Action |
|---|---|
| `↑` / `↓` | Move `mentionIndex` |
| `Tab` / `Enter` | `acceptMention(active)` |
| `Escape` | Close (`setMentionState(null)`) |

Takes precedence over `/` slash menu when both could apply.

### Drag from explorer (feature 055)

Full detail: **`055-file-composer-drag.md`**.

Alternate path to the same cite outcome — no `@` popover:

```
FileTree file row drag → composer drop
  → citeFileFromDrop(absPath)
  → @relPath at cursor + addAttachedFile
```

Keyboard `@` autocomplete and explorer drag are independent entry points;
both queue the file for the next message via `workspaceChatContext`.

### Related

- Subagent delegation + Task tool: **`004-subagent-mentions.md`**
- Composer shell, status dock, hint row: **`022-chat-composer.md`**
- Per-project `@` file queue on send: **`037-project-context-dock.md`**
- Drag file from explorer onto composer: **`055-file-composer-drag.md`**
