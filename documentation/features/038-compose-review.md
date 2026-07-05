---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-05
last_verified: 2026-07-05
tags: [ai-chat, compose-card, diff, agent-mode, conductor-style, monaco, undo-keep, compose-recap]
---

## Compose Review — Conductor-style agent edit diff

**Purpose:** When Jack edits files, the user reviews changes in an **inline diff tab**
(before → after, red/green Monaco hunks) with **Undo / Keep** and hunk navigation —
not only in a centered modal. Works in **editor layout** (editor pane tab) and
**Agent Mode** (50/50 split beside the chat).

### Files

| Type | Path | Role |
|---|---|---|
| Tab pane | `src/components/ComposeReviewPane.tsx` | Inline diff + dock (nav, Undo, Keep, Esc-close) |
| Keys + before-content | `src/composeReview.ts` | `crev:` tab keys, snapshot/tool-call "before" text |
| Recap card | `src/components/composeCard.tsx` | Live recap; file click → `openComposeReviewTab` |
| Diff widget | `src/components/DiffView.tsx` | Optional `onDiffMount` for hunk navigation |
| Store | `src/store.ts` | `openComposeReview`, `collectComposeReviewTabs`, `focusedComposeReviewKey`, `collectSubagentTabs`, `focusedSubagentKey`, `focusedAgentSidePanelKey` |
| Editor shell | `src/components/WorkspaceShell.tsx` | Portals `ComposeReviewPane` into pane containers |
| Agent shell | `src/components/AgentModeShell.tsx` | Reads `crev:` / `sub:` tabs via `focusedAgentSidePanelKey`; splits chat \| review or subagent transcript |
| Tab chrome | `src/components/PaneNode.tsx` | `git-compare` icon + basename label |
| Snapshots | `src/composeSnapshots.ts` | Pre-turn buffer for **Undo** (unchanged contract) |
| Styles | `src/App.css` | `.compose-review-*`, `.agent-main.has-review` |

### User flow

1. Turn includes ≥1 `Write` / `Edit` / `MultiEdit` → **ComposeCard** appears
   (**live during stream**: `N Files · editing…`, per-file list grows, **total `+/-` recap**
   in `.ai-compose-bar-recap`; Undo/Keep only after turn ends).
2. User clicks a file row (or **Review** for all) → `openComposeReview(wsId, chatId, msgIndex, path, calls)`.
3. A **`crev:`** tab opens:
   - **Editor layout:** in the active/sibling editor pane (avoids opening on top of an `ai:` tab when possible).
   - **Agent Mode:** right half of `.agent-main` (chat stays left); mini-tab strip when multiple files.
4. **ComposeReviewPane** loads:
   - **Original:** pre-turn snapshot (`composeSnapshots`) or first edit `old_string` / empty for new files.
   - **Modified:** fresh `fs.readFile` (disk truth).
5. Dock: `^ n of m v` (Monaco `goToDiff`), **Undo `⌘N`** (restore snapshot + close tab), **Keep `⌘Y`** (close tab), **✕** (close).

Inline edit pills stay hidden while ComposeCard is shown (`hideEdits={showComposeCard}`) — the recap + review tab are canonical.

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
  → store.openComposeReview
  → layout.editorRoot gains/focuses crev: tab
  → WorkspaceShell (editor) OR AgentModeShell (agent) mounts ComposeReviewPane
  → DiffView inline (sideBySide=false)
```

Agent Mode does **not** mount `WorkspaceShell`; it watches the same layout keys via
`collectComposeReviewTabs` / `focusedComposeReviewKey`.

### Relation to other surfaces

| Surface | When used |
|---|---|
| **ComposeReviewPane** (`crev:` tab) | ComposeCard file click, Review all |
| **DiffModal** (`requestDiff`) | `EditDiffCard` pill click in stream (legacy one-off) |
| **EditorPane git diff** | User toggles Changes on an open file tab (HEAD vs buffer) |

Future: route stream edit chips to compose review when turn context is available.

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
