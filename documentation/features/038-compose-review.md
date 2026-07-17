---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-05
last_verified: 2026-07-17
tags: [ai-chat, compose-card, diff, agent-mode, conductor-style, monaco, undo-keep, compose-recap]
---

## Compose Review — Conductor-style agent edit diff

**Purpose:** When Jack edits files, the user reviews changes in an **inline diff tab**
(before → after, red/green Monaco hunks) with **Undo / Keep** and hunk navigation —
not only in a centered modal. Works in **editor layout** (editor pane tab). In
**Agent Mode**, ComposeCard opens the centered **DiffModal** instead of the 50/50
side split (chat stays full-width; same overlay as stream batch-summary edits).

### Files

| Type | Path | Role |
|---|---|---|
| Tab pane | `src/components/ComposeReviewPane.tsx` | Inline diff + dock (nav, Undo, Keep, Esc-close); `openComposeReviewTab` |
| Keys + before-content | `src/composeReview.ts` | `crev:` tab keys, snapshot/tool-call "before" text, `openComposeDiffModal` |
| Recap card | `src/components/composeCard.tsx` | Live recap; file click → review (modal in Agent Mode) |
| Diff widget | `src/components/DiffView.tsx` | Optional `onDiffMount` for hunk navigation |
| Store | `src/store.ts` | `openComposeReview`, `collectComposeReviewTabs`, `focusedComposeReviewKey`, `collectSubagentTabs`, `focusedSubagentKey`, `focusedAgentSidePanelKey` |
| Editor shell | `src/components/WorkspaceShell.tsx` | Portals `ComposeReviewPane` into pane containers |
| Agent shell | `src/components/AgentModeShell.tsx` | Still hosts `crev:` / `sub:` if tabs exist; new ComposeCard clicks skip creating them |
| Tab chrome | `src/components/PaneNode.tsx` | `git-compare` icon + basename label |
| Snapshots | `src/composeSnapshots.ts` | Pre-turn buffer for **Undo** (unchanged contract) |
| Styles | `src/App.css` | `.compose-review-*`, `.agent-main.has-review` |

### User flow

1. Turn includes ≥1 `Write` / `Edit` / `MultiEdit` → **ComposeCard** appears
   (**live during stream**: `N Files · editing…`, per-file list grows, **total `+/-` recap**
   in `.ai-compose-bar-recap`; Undo/Keep only after turn ends).
2. User clicks a file row (or **Review**):
   - **Agent Mode:** `openComposeDiffModal` → global **DiffModal** (snapshot/disk before→after). **Review** expands the list and opens the first file.
   - **Editor layout:** `openComposeReview` → **`crev:`** tab in the editor pane with Undo/Keep dock.
3. **ComposeReviewPane** (IDE only) loads:
   - **Original:** pre-turn snapshot (`composeSnapshots`) or first edit `old_string` / empty for new files.
   - **Modified:** fresh `fs.readFile` (disk truth).
4. Dock (IDE): `^ n of m v` (Monaco `goToDiff`), **Undo `⌘N`**, **Keep `⌘Y`**, **✕**.

Stream edit summaries (082) also use DiffModal; ComposeCard remains the turn-end Files recap + Undo All / Keep All.

### Tab key format

```
crev:{wsId}|{chatId}|{msgIndex}|{encodeURIComponent(path)}
```

`chatId` uses `_` when undefined. Tool calls for the turn are stashed in-memory
(`stashComposeReviewCalls`) keyed by tab key — not persisted (re-open re-reads from chat if needed).

### Data flow

```
ComposeCard click
  → openComposeReviewTab(...)
  → Agent Mode? openComposeDiffModal → DiffModal
  → else store.openComposeReview → crev: tab → ComposeReviewPane
```

Agent Mode does **not** create `crev:` tabs from ComposeCard anymore. Legacy `crev:` tabs (if any) can still render in `AgentModeShell`.

### Relation to other surfaces

| Surface | When used |
|---|---|
| **DiffModal** (`requestDiff` / `openComposeDiffModal`) | Agent Mode ComposeCard; stream batch-summary edits (082); legacy EditDiffCard |
| **ComposeReviewPane** (`crev:` tab) | ComposeCard in **editor/IDE** layout |
| **EditorPane git diff** | User toggles Changes on an open file tab (HEAD vs buffer) |

### CSS

| Class | Role |
|---|---|
| `.compose-review-host` | Full-height column: head + Monaco + dock |
| `.compose-review-dock` | Nav + Undo / Keep (Conductor-style bar) |
| `.agent-main.has-review` | 50/50 row: `.agent-main-chat` \| `.agent-main-review` (compose review **or** subagent transcript) |
| `.agent-review-tabs` | Multi-file tab strip in agent mode (compose review only) |
| `.ai-compose-cursor.is-streaming` | Live recap spinner + border while turn in flight |
| `.ai-compose-bar-recap` | Total additions/deletions pill beside file count |
| `@keyframes ai-compose-enter` / `ai-compose-attention` | Card entrance + post-turn border pulse |

### Gotchas

- **Undo is whole-file**, not per-hunk (Conductor hunk Keep/Undo is a follow-up).
- Snapshot only covers files **open in the workspace buffer** at turn start; new files undo to empty string.
- **`crev:` tabs** live in `layout.editorRoot` even in Agent Mode — the shell renders them, not the hidden editor chrome.
- Re-clicking the same file focuses the existing tab (no duplicate).
- **Agent Mode prefers DiffModal.** Side split stole chat width; ComposeCard now
  calls `openComposeDiffModal` (snapshot + `fs.readFile`) via `getAgentMode()`.
  Undo All / Keep All stay on the card; per-file Undo/Keep dock is IDE-only.
- **Review in Agent Mode** opens the **first** file in the modal and expands the
  list (one DiffModal at a time). IDE **Review** still opens every `crev:` tab.
- DiffModal has no Undo/Keep dock — accept/revert for Agent Mode is ComposeCard
  **Undo All** / **Keep All**, or edit the file in IDE later.
