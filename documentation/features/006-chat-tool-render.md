---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-03
tags: [ai-chat, tool-calls, chatToolRender, cursor-style, drawer, diff-modal, css, presentational]
---

## Chat Tool-Call Rendering

**Purpose:** Render an assistant turn's tool calls (Read / Bash / Edit / Grep /
Task / …) in the chat stream as compact one-line pills — Cursor/Conductor style.
Detail is NOT inline: read/bash/search output opens in a right-side **drawer**,
edits open in the centered **DiffModal**. Pure presentational React + CSS.
**Files:** | `src/components/chatToolRender.tsx`, `src/components/ToolResultDrawer.tsx`,
`src/toolDrawer.ts`, `src/components/composeCard.tsx`, styles in `src/App.css`.

### Two render paths (same file)
| Mode | Driver | Entry | Look |
|---|---|---|---|
| Docked chat (non-compact) | `CompactChat` ctx = false | `InterleavedBlocks` → `ToolCallRow` / `EditDiffCard` | wrapping pill cloud |
| Agent mode (compact) | `CompactChat` ctx = true | `CompactBlocks` → `InlineActionRow` | chip clusters ("6 reads · 2 searches") |

### Layout: wrapping pills, edits/tasks standalone
`InterleavedBlocks` (non-compact) lays consecutive tool calls into `.ai-tcall-wrap`
— a `flex-wrap` row of pills, side by side, flowing onto the next line. Tools that
`isWrapStandalone(name)` (edits, `Task`/`Agent`, `AskUserQuestion`) break out onto
their own row instead — they're actions worth their own line. Real text between
runs breaks the wrap; empty text / de-duped re-emits don't.

### Shared row head: `ToolRowHead`
Both the generic row and `EditDiffCard` render through one `ToolRowHead` → all rows
look identical. A content-hugging bordered pill (`.ai-tcall` is `align-items:flex-start`):

| Part | Element | Behaviour |
|---|---|---|
| Primary | `<button class="ai-tcall-open">` icon · name · detail | one click → `onPrimary` |
| Trail | `.ai-tcall-trail` — spinner / check / `±n` stats | status only; no caret (detail is in an overlay) |

There is **no inline expansion** any more — clicking opens an overlay, so the row
stays a compact one-liner.

### Click targets
| Row | `onPrimary` |
|---|---|
| Generic with output | `requestToolDrawer(...)` — right slide-over |
| Generic, no output but file-ref | `openFile(wsId, path)` — new editor tab |
| Edit / Write / MultiEdit | `requestDiff(...)` — centered DiffModal (Monaco before/after) |

`fileRefOf(call)` returns an openable path for `Read`/`Edit`/`Write`/`Notebook*`
(NOT Grep/Glob — patterns). The file opener comes from the `AgentFileOpen` context:
- **docked** — `AIChatPanel` provides `openFile(wsId, path)`.
- **agent mode** — `AgentModeShell` provides the file popup; `AIChatPanel`
  **forwards** it (`parentFileOpen`) in compact mode so it isn't clobbered.

### Result drawer (`ToolResultDrawer` + `toolDrawer.ts`)
A right-side slide-over rendered once at app level (`App.tsx`, beside `DiffModal`).
`requestToolDrawer({title, subtitle, result, markdown, onOpenFile})` → it slides in
(animates IN **and** OUT via `shown`+translateX; Esc / backdrop / `useModalFocus`).
Body: `MarkdownPreview` for `.md` reads (gutter stripped) else `<pre>`. If the tool
is file-ref, the header shows an **"Open in editor"** button.

### Edits → DiffModal (`requestDiff`)
`EditDiffCard` shows a Cursor-style pill — past-tense verb (`toolVerb` capitalized:
"Edited"/"Wrote"/"Created") · basename (full path in `title`) · bold `−n`/`+n`. Click
joins the edit fragments into one original/modified pair and calls `requestDiff(...)`
with `langOf(path)` — the same centered Monaco diff the source-control panel uses.
Write/create → empty original → renders all-added. The `DiffModal` itself is a
full-viewport overlay (`inset:0`, `z-index:1000` — above the chat/rail chrome) with
a fade+scale entrance animation (`prefers-reduced-motion` guarded).

### Result rendering: code-view vs Markdown (inside the drawer)
`isMarkdownRead(call)` (Read of `.md`/`.mdx`/`.markdown`) → render via `MarkdownPreview`
after `stripReadGutter(text)` strips Claude Code's `cat -n` prefix (`/^\s*\d+\t/gm`).
**Scope is deliberate** — Bash/Grep output and code files are NOT Markdown, so they
stay raw `<pre class="ai-tcall-result-body">`.

### ComposeCard + hideEdits dedup

`ComposeCard` (`composeCard.tsx`) is the end-of-turn changed-files recap
(Cursor-style bar: count + Undo / Keep / Review, expandable file list). Threshold:
**≥1 edit** in the assistant message (was ≥2).

When `ComposeCard` is shown, `InterleavedBlocks` receives `hideEdits={true}` so
per-file Edit pills are NOT duplicated inline — the recap card is canonical.
`hideEdits` applies to both docked (`InterleavedBlocks`) and compact
(`CompactBlocks`) paths.

### Live turn status (`StatusPill`)

During an in-flight turn, `StatusPill` renders tool/stream state as compact
pills. **Docked above the composer** in `.ai-status-dock` (feature 022), not in
the message scroll. Includes optional `RunningToolList` below the header pill
when tools aren't already rendered inline in `streamingBlocks`.

### Shared helper (DRY)
- **`shortDetail(detail)`** — compact path/URL form (basename / host). Used by both
  `RunningToolRow` (live ticker) and `ToolCallRow` (transcript).

### Key CSS (`src/App.css`)
| Class | Role |
|---|---|
| `.ai-tcall-wrap` | `flex-wrap` pill cloud for read/search runs |
| `.ai-tcall-head` / `.is-interactive` | content-hugging bordered pill + hover |
| `.ai-tcall-open` / `.ai-tcall-trail` | primary click area / status cluster |
| `@keyframes ai-tcall-in` | row entrance (fade + slide) |
| `.tool-drawer` / `.tool-drawer-scrim` | right slide-over (translateX) + backdrop |
| `.ai-tcall-result-body` / `.ai-tcall-result-md` | drawer body (mono / rendered md) |
| `@media (prefers-reduced-motion)` | disables entrance + drawer transitions |

Neutral chrome — no accent fill; the done-check is `--fg-muted`, the only color is
the green/red `±` edit stats (semantic).

### Gotchas
- The drawer/DiffModal are **universal** — `ToolCallRow` is also used in compact mode
  and the subagent transcript view, so clicking a row there opens the same overlay.
  If that's unwanted in agent mode, gate on `CompactChat`.
- Edit diff in the DiffModal is built from the tool's `old_string`/`new_string`
  fragments (joined), NOT the full file — so it shows the changed region, not whole-file context.
