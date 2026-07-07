---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-07
tags: [ai-chat, tool-calls, chatToolRender, cursor-style, conductor-style, drawer, diff-modal, css, presentational, tool-icon-tints, webfetch-markdown, compose-recap, html-preview]
---

## Chat Tool-Call Rendering

**Purpose:** Render an assistant turn's tool calls (Read / Bash / Edit / Grep /
Task / …) in the chat stream — **Conductor-style** grouped chips inline with prose.
Read/bash/search detail opens in a right-side **drawer**; file edits recap in
**ComposeCard** + **ComposeReviewPane** (feature 038). Pure presentational React + CSS.

**Files:** `src/components/chatToolRender.tsx`, `src/components/ToolResultDrawer.tsx`,
`src/toolDrawer.ts`, `src/htmlPreview.ts`, `src/components/HtmlPreviewFrame.tsx`,
`src/components/composeCard.tsx`, `src/composeReview.ts`,
`src/components/ComposeReviewPane.tsx`, styles in `src/App.css`.

### Unified inline layout (editor + agent)

Both docked chat and Agent Mode use the **same** chronology renderer:

| Entry | Implementation | Look |
|---|---|---|
| `InterleavedBlocks` | Always delegates to `CompactBlocks` | prose interleaved with tool runs |
| `CompactBlocks` | Walks `blocks[]`, flushes tool runs | `.ai-iarow` chip rows or solo `ToolCallRow` |
| `InlineActionRow` | One row per consecutive tool run (≥2 tools) | Conductor-style grouped chips |

The old non-compact **pill cloud** (`.ai-tcall-wrap` per Read/Grep) was removed —
editor and agent surfaces now match.

### Inline action chips (`.ai-iarow`)

Consecutive non-task tool calls collapse into one row:

| Chip | Contents |
|---|---|
| Explore (muted) | Reads + searches → `Explored 3 files, 4 searches` or `read N files` |
| Action (prominent) | Bash → `4 ran`; edits → `edited foo.ts`; multi-target → count prefix |
| Expand on click | Reveals underlying `ToolCallRow` list in `.ai-iaction-detail` |

**Explore set:** `Read`, `NotebookRead`, `Grep`, `Glob`, `ToolSearch`, `WebSearch`, `WebFetch`.

**Single-tool runs:** when a flush has exactly **one** tool, `CompactBlocks` renders a
standalone `ToolCallRow` directly (no `.ai-iarow` wrapper). The row gets
`.ai-tcall-standalone` (`margin: 10px 0`) so it keeps the same vertical rhythm as grouped rows.

**Skipped in stream:** `TaskCreate`/`Update`/`List`, `TodoWrite`, `AskUserQuestion` (sidebar / ask-dock).

Edits in the chip row are hidden when `hideEdits` (ComposeCard owns the recap).

### Shared row head: `ToolRowHead`

Used by generic `ToolCallRow` and `EditDiffCard` when expanded from a chip:

| Part | Element | Behaviour |
|---|---|---|
| Primary | `<button class="ai-tcall-open">` icon · name · detail | one click → `onPrimary` |
| Trail | `.ai-tcall-trail` — spinner / check / `±n` stats | status only |

There is **no inline expansion** in the transcript — clicking opens an overlay/drawer.

### Click targets
| Row | `onPrimary` |
|---|---|
| Generic with output | `requestToolDrawer(...)` — right slide-over |
| Generic, no output but file-ref | `openFile(wsId, path)` — new editor tab |
| Edit / Write / MultiEdit (pill) | `requestDiff(...)` — centered DiffModal |
| **HTML preview tool** (`ShowHtmlPreview`, `*html_preview*`) | `requestHtmlPreviewDrawer(...)` — browser drawer; optional **Open in tab** |
| **Write/Edit `.html`** (EditDiffCard) | Globe button in trail → browser drawer with modified HTML |
| ComposeCard file row | `openComposeReviewTab(...)` — `crev:` diff tab (038) |

`fileRefOf(call)` — openable path for `Read`/`Edit`/`Write`/`Notebook*` (not Grep/Glob patterns).

`AgentFileOpen` context: docked → `openFile`; agent mode → file popup (non-edit reads).

`HtmlPreviewOpen` context (`AIChatPanel`): `(previewId, html, title) → openHtmlPreviewTab`
— drawer **Open in tab** and agent HTML tools. See `045-html-preview.md`.

### Result drawer (`ToolResultDrawer` + `toolDrawer.ts`)

App-level right slide-over (`App.tsx`).

| Body mode | When |
|---|---|
| `HtmlPreviewFrame` | `variant: "browser"` + `html` set (agent HTML preview) |
| `MarkdownPreview` | `.md` file reads (`isMarkdownRead` + `stripReadGutter`) |
| `MarkdownPreview` | **WebFetch** / `web_fetch` results (`isMarkdownDrawer`) |
| `<pre>` | Bash, Grep, code reads, other plain text |
| Image | Read of an image path (`imagePath` → data URL) |
| Terminal chrome | Bash variant (`TerminalResultView`) |

### Edits → DiffModal vs Compose Review

| Path | Trigger | UI |
|---|---|---|
| Stream `EditDiffCard` pill | Click inline edit chip (when not `hideEdits`) | Centered `DiffModal` |
| **ComposeCard** | ≥1 edit in turn; click file / Review | **`crev:` tab** — see `038-compose-review.md` |

When ComposeCard is shown, `hideEdits={true}` — no duplicate edit pills in stream.

### ComposeCard (live recap)

Cursor-style bar: `N Files` (+ `· editing…` while streaming), **total diff pill**
(`+80 −35` in `.ai-compose-bar-recap`, live during stream), expandable per-file list.

| Action | When |
|---|---|
| **Undo All** | Turn finished; restores pre-turn snapshot |
| **Keep All** | Collapses recap |
| **Review** | Opens compose-review tab per file |
| File row click | Opens compose-review for that file |

**Prominence:** entrance slide-up + border attention pulse when the turn finishes;
bar uses `--bg-hi`, `--shadow-sm`, taller min-height. Recap pill animates in separately.

Visible **as soon as the first edit completes** (`showComposeCard && isAssistant`, including mid-stream).

### Live turn status (`StatusPill`)

Docked above composer in `.ai-status-dock` (022). Inverted monochrome pill; optional
`RunningToolList` when tools aren't yet in `streamingBlocks`.

### Per-tool icon tints

`toolToneOf` / `.ai-tool-tone-*` on icon glyphs — see table in prior revision; unchanged.

### Key CSS (`src/App.css`)

| Class | Role |
|---|---|
| `.ai-iarow` / `.ai-iarow-chips` | Conductor-style grouped tool row (≥2 tools) |
| `.ai-tcall-standalone` | Solo tool row between prose blocks — extra vertical margin |
| `.ai-ichip` / `.ai-chip` | Compact category / action chips |
| `.ai-compose-cursor` / `.is-streaming` | Live changed-files recap + entrance/attention animations |
| `.ai-compose-bar-recap` | Total `+/-` pill in compose bar |
| `.compose-review-*` | Diff review tab (038) |
| `.tool-drawer` | Read/bash result slide-over |

### Gotchas

- Drawer/DiffModal are global — compact/subagent views share them.
- Edit diff in DiffModal uses tool fragments, not full file; compose review uses snapshot vs disk.
- During streaming with edits: stream shows ComposeCard live + explore/bash chips; edit pills hidden.
