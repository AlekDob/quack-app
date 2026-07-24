---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-17
last_verified: 2026-07-24
tags: [ai-chat, cursor-compact, action-summary, worked-for, thought-for, streaming, perf, vitest, isFlatBatch]
---

## Cursor-compact chat action stream

**Purpose:** Make assistant turns read like Cursor’s quiet chronology: live
present-tense tool lines that flip to past tense, optional expand for detail /
inline edit diffs, plus **Worked for** / **Thinking → Thought for** timing —
while mounting **far less text** on first paint than per-tool pills.

**Stack:** React 19 presentational components + pure helpers (vitest) + CSS
variables; Quack tool icons + `--tool-*` tones + semantic `+/-`.

Pairs with **`006-chat-tool-render`** (drawer / ComposeCard / AskQuestion) and
**`056-reasoning-turn-chip`** (thinking body). This doc is the stream chrome
contract. Turn-end Files recap + review surface: **`038-compose-review`**.

### Files

| Path | Role |
|---|---|
| `src/components/chatActionSummary.tsx` | `ActionBatchSummary`, `isFlatBatch`, solo/group, labels, `batchRenderCost` |
| `src/components/chatActionSummary.test.ts` | Labels, `isFlatBatch`, perf (`collapsed ≪ expanded`) |
| `src/components/chatToolRender.tsx` | `CompactBlocks` / `InterleavedBlocks` flush into summaries; `isSubagentDispatch` → duck chip (004) |
| `src/components/TurnWorkedHeader.tsx` | `Worked for 1m 42s` on finished turns |
| `src/formatWorkedDuration.ts` | `4s` / `1m 42s` formatter (+ unit test) |
| `src/components/ReasoningTurnChip.tsx` | Live `Thinking` / done `Thought for…` (056) |
| `src/components/TurnStreamStatus.tsx` | Soft-reduce dock when tools already inline |
| `src/components/AIChatPanel.tsx` | `durationMs` / `thinkingMs` / `thinkingLive` wiring |
| `src/ai.ts` | Optional `ChatMessage.durationMs`, `thinkingMs` |
| `src/App.css` | `.ai-batch-summary*`, live shimmer/icon pulse, `.ai-worked-header` |

### Stream chronology

```
blocks[] → CompactBlocks
  text  → ThinkingBlock (056) + prose
  tools → consecutive run flushed as ActionBatchSummary
usage   → message.durationMs → TurnWorkedHeader (finished only)
CC keepalives → thinkingLive → in-stream Thinking chip
```

### Action batch UI

| Case | UI |
|---|---|
| **≤1 expand leaf** | Flat solo line — no chevron, no nested duplicate. Covers **1 tool** and **N Edit calls on the same file** (one path). Edit: `Edited foo.ts +35 −6` → click opens DiffModal. Explore/bash: detail label → drawer. |
| **2+ expand leaves** | One muted summary (`Explored 2 files, 1 search` / `Edited 4 files, explored 1 file +417`) + chevron. Expand → Grepped/Read rows and/or per-file `Edited name +N` with inline diff snippet. |
| **Live** | Present continuous + **`.ai-live-shimmer`** on the label (and icon pulse). `live = streaming && !allDone`; `allDone` requires every tool **id and** result. |
| **Done** | Past tense + optional `+/-` (git colors via `.ai-compose-add` / `.ai-compose-rem`). |

**Label order (Cursor):** Edited first, then lowercase `explored…` / `N searches`, then Ran…

**Explore set:** Read, NotebookRead, Grep, Glob, ToolSearch, WebSearch, WebFetch.

**Edits stay in the stream** (not stripped when ComposeCard is present). ComposeCard (006 / 038) remains the turn-end Files recap + Undo/Review.

**Skipped from batch:** TaskCreate/TaskUpdate/TaskList, TodoWrite, AskUserQuestion
(composer chip / ask-dock — 067 / 073).

**Subagent dispatch (`Task` / `Agent`):** not batched. `CompactBlocks` flushes the
current summary and mounts a duck-avatar `ToolCallRow` (`isSubagentDispatch`) so
click → transcript drawer still works (004). Two parallel explores → two chips,
not `"Ran 2 actions"`.

### `isFlatBatch` (solo vs group)

Expand tree leaves = **unique edit paths** + **each non-edit tool**.

| Input | Flat? | Why |
|---|---|---|
| 1 tool | yes | Single leaf |
| 2+ `Edit` on `ConversationDrawer.tsx` | yes | One path → one leaf (was the nested-duplicate bug) |
| `Edit` a.ts + `Edit` b.ts | no | Two edit leaves |
| `Edit` + `Read` | no | Edit leaf + explore leaf |

`ActionBatchSummary` → `SoloActionLine` when flat (merges same-file edit diffs
into one `+/-` line); else `BatchGroupSummary`.

### Timing

| Label | Source | When shown |
|---|---|---|
| **Worked for Xm Ys** | Provider `usage.durationMs`, else client clock from turn start | Finished assistant message (`!streaming`) |
| **Thinking** | CC empty content keepalives + open think | Live, before flush |
| **Thought for Xs** | Client clock: keepalive/open → close tag / tool_call / turn end (`thinkingMs`, min ~400ms) | Done chip; legacy → `Reasoning · N words` |

### Status dock (composer live signal)

The composer dock always keeps the inverted pill + spinner + `.ai-live-shimmer`
while tools run or tokens generate — that is the at-a-glance “agent is working”
signal above the textarea (feature 022). When `streamingBlocks` already has
`tool_call`, only the dock’s `RunningToolList` is suppressed (transcript
`ActionBatchSummary` owns the detail rows). Planning / stale / warming-up
unchanged.

### Perf contract

Default paint is **collapsed**: one summary line per batch.

| Helper | Asserts |
|---|---|
| `batchRenderCost(items, "collapsed" \| "expanded")` | Collapsed = 1 short line; expanded includes detail labels + edit bodies |
| `isFlatBatch` | Same-file multi-edit costs one line in both modes |

Vitest (`npm test -- chatActionSummary.test.ts`): explore×24, edit×8,
same-file multi-edit, and label tense / Cursor order.

### CSS

| Class | Role |
|---|---|
| `.ai-batch-summary` | Container — vertical padding (`padding: 4px 0`) |
| `.ai-batch-summary.is-solo` | Flat leaf line (no caret) |
| `.ai-batch-summary.is-live` | Shimmer label + icon pulse; label `overflow: visible` (WebKit) |
| `.ai-batch-summary-head` / `-label` / `-diff` / `-caret` | Summary row |
| `.ai-batch-summary-detail` | Expanded list |
| `.ai-batch-edit-file*` / `.ai-batch-edit-diff*` | Per-file edit + inline preview |
| `.ai-worked-header` | Quiet turn duration |

### Gotchas

- **Solo ≠ `items.length === 1`.** Counting tool calls nested same-file edits
  under a group whose only child duplicated the head. Use `isFlatBatch`.
- **Hooks:** solo vs group are separate components (`SoloActionLine` /
  `BatchGroupSummary`) so hook count stays stable.
- **Live shimmer / WebKit:** `overflow: hidden` + `background-clip: text`
  clips the shimmer — live labels use `overflow: visible`.
- **`allDone`:** requires `id` **and** result. Treating missing id as done
  dropped shimmer mid-stream.
- **CC thinking:** keepalives are empty `content` events — must start
  `thinkingStartedAt` / `thinkingLive` there, not only on the closed
  `<think>` flush (or `Thought for` stays ~0).
- **Circular import:** `chatActionSummary` ↔ `chatToolRender` (shared
  `pathOf` / `extractEditDiffs`). Safe at render time; prefer extracting
  meta helpers if it grows.
- **Do not** also render outer Reasoning when `blocks[]` exists (056).
- **Subagent ≠ batch "other":** `Task`/`Agent` must leave the run via
  `isSubagentDispatch` + `ToolCallRow`. Leaving them in the batch yields
  `"Ran N actions"` / generic Subagent rows with no avatar or drawer (004).
- **Diff click:** stream solo/expand edits → DiffModal (`requestDiff`).
  ComposeCard review in Agent Mode also → DiffModal (038); IDE → `crev:` tab.
