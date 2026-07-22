---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-22
tags: [ai-chat, tool-calls, chatToolRender, cursor-style, compact-summary, drawer, diff-modal, css, presentational, tool-icon-tints, webfetch-markdown, compose-recap, html-preview, ask-user-question, spend-limit]
related: [082-cursor-compact-action-stream.md, 091-spend-limit-card.md]
---

## Chat Tool-Call Rendering

**Purpose:** Presentational layer for assistant tool calls in chat — drawers,
ComposeCard, AskUserQuestion rows, icon tones — plus the chronology walker that
feeds **Cursor-compact** stream summaries.

**Stream chrome (summaries, Worked for / Thought for, solo vs group, perf):**
see **`082-cursor-compact-action-stream.md`** — primary UX contract.

**Spend-limit prose → warn card:** see **`091-spend-limit-card.md`**.

**Stack:** React 19 + CSS variables. Quack icons + `--tool-*` tones.

### Files

| Path | Role |
|---|---|
| `src/components/chatToolRender.tsx` | `InterleavedBlocks` / `CompactBlocks`, `ToolCallRow`, AskQuestion, tones |
| `src/components/ProseWithSpendLimit.tsx` | Compact/legacy prose bridge → MD or spend-limit card (091) |
| `src/components/chatActionSummary.tsx` | Compact batch UI (082) |
| `src/components/ToolResultDrawer.tsx` + `src/toolDrawer.ts` | Read/bash/search slide-over |
| `src/htmlPreview.ts` + `HtmlPreviewFrame.tsx` | HTML preview drawer / tabs (045) |
| `src/components/composeCard.tsx` + `composeReview.ts` | Turn-end Files recap (038) |
| `src/App.css` | Tool / compose / batch / ask styles |

### Chronology walker

| Entry | Behaviour |
|---|---|
| `InterleavedBlocks` | Always → `CompactBlocks` |
| `CompactBlocks` | Walks `blocks[]`; flushes consecutive tools into `ActionBatchSummary` (082); `Task`/`Agent` → duck-avatar `ToolCallRow` (004); thinking → `ReasoningTurnChip` (056); text → `ProseWithSpendLimit` (091) |
| `ProseWithSpendLimit` | Committed prose: spend-limit lines → `SpendLimitCard`; else MD. Streaming → plain tail (069) |
| `StreamingPlainText` | Live prose tail (069) |

**Skipped in stream:** TaskCreate/TaskUpdate/TaskList, TodoWrite, AskUserQuestion
(sidebar / ask-dock — 067 / 073). **`Task`/`Agent` subagent dispatch** is not
skipped — rendered as clickable duck chips (004). Edits **remain** in the
compact summary; ComposeCard still recaps at turn end.

### AskUserQuestion (transcript row only)

Interactive card lives in `.ai-ask-dock` above the composer (`AIChatPanel`).
`ToolCallRow` renders a **compact** one-liner (`Question` + summary) so options
are not duplicated in the scrollable transcript.

| Export | Role |
|---|---|
| `AskQuestionCard` | Docked interactive card (options, Other…, Esc dismiss) |
| `parseAskQuestions` / `coerceToolArgs` / `mergeAskQuestionArgs` | Defensive parse + hook-args merge |
| `isAskUserQuestionTool` | Name matcher |

See **`073-ask-user-question-dock.md`**.

### Shared row head: `ToolRowHead`

Used by generic `ToolCallRow` and `EditDiffCard`:

| Part | Behaviour |
|---|---|
| Primary | icon · name · detail → drawer / DiffModal / file |
| Trail | spinner / check / `±n` |

### Click targets

| Row | Action |
|---|---|
| Generic with output | `requestToolDrawer(...)` |
| File-ref, no output | `openFile` / agent popup |
| Edit / Write / MultiEdit | DiffModal or compose-review (038) |
| HTML preview tool | `requestHtmlPreviewDrawer` (045) |
| ComposeCard file row | Agent Mode → DiffModal; IDE → `openComposeReviewTab` (038) |
| Compact solo edit / batch expand | DiffModal or inline preview (082) |

### Result drawer

App-level right slide-over (`App.tsx`): markdown reads, WebFetch, bash terminal
chrome, images — see prior modes; unchanged.

### ComposeCard (live recap)

Turn-end / mid-stream Files bar: `N Files`, total `+/-`, Undo All / Keep /
Review. Visible as soon as the first edit completes. Does **not** remove edit
lines from the compact stream (082).

**Open review:** Agent Mode → centered DiffModal (`openComposeDiffModal`);
IDE layout → `crev:` ComposeReviewPane tabs. See **038**.

### Live turn status

`.ai-status-dock` + `TurnStreamStatus` (022). Pill + spinner + shimmer stay
visible while tools/tokens run; only the dock tool *list* soft-reduces when
tools already appear in `streamingBlocks` (082).

### Per-tool icon tints

`toolToneOf` / `.ai-tool-tone-*` on glyphs — used by compact summaries and
`ToolCallRow`.

### Key CSS

| Class | Role |
|---|---|
| `.ai-batch-summary*` | Compact stream (082) |
| `.ai-worked-header` | Turn duration (082) |
| `.ai-compose-cursor` / `.ai-compose-bar-recap` | Files recap |
| `.ai-live-shimmer` | Live status / Thinking |
| `.reasoning-turn-chip*` | 056 |
| `.tool-drawer` / `.ai-ask-card` | Drawer / ask dock |
| `.ai-spend-limit-*` | Org spend-limit card (091) |

### Gotchas

- Drawer/DiffModal are global — all chat surfaces share them.
- Edit DiffModal uses tool fragments, not full file; compose review uses snapshot vs disk.
- **Reasoning:** inline via `CompactBlocks`; never duplicate outer chip when `blocks[]` exists — 056.
- Legacy `.ai-iarow` / `.ai-ichip` CSS may remain; live path is `.ai-batch-summary`.
