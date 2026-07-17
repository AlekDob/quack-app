---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-17
last_verified: 2026-07-17
tags: [ai-chat, cursor-compact, action-summary, worked-for, thought-for, streaming, perf, vitest]
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
contract.

### Files

| Path | Role |
|---|---|
| `src/components/chatActionSummary.tsx` | `ActionBatchSummary`, solo line, labels, `batchRenderCost` |
| `src/components/chatActionSummary.test.ts` | Label + perf regression (`collapsed ≪ expanded`) |
| `src/components/chatToolRender.tsx` | `CompactBlocks` / `InterleavedBlocks` flush into summaries |
| `src/components/TurnWorkedHeader.tsx` | `Worked for 1m 42s` on finished turns |
| `src/formatWorkedDuration.ts` | `4s` / `1m 42s` formatter (+ unit test) |
| `src/components/ReasoningTurnChip.tsx` | Live `Thinking` / done `Thought for…` (056) |
| `src/components/TurnStreamStatus.tsx` | Soft-reduce dock when tools already inline |
| `src/components/AIChatPanel.tsx` | `durationMs` / `thinkingMs` / `thinkingLive` wiring |
| `src/ai.ts` | Optional `ChatMessage.durationMs`, `thinkingMs` |
| `src/App.css` | `.ai-batch-summary*`, `.ai-worked-header`, edit-diff preview |

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
| **1 tool** | Flat solo line — no chevron, no nested duplicate. Edit: `Edited foo.ts +35 −6` → click opens DiffModal. Explore/bash: detail label → drawer. |
| **2+ tools** | One muted summary (`Explored 2 files, 1 search` / `Edited 4 files, explored 1 file +417`) + chevron. Expand → Grepped/Read rows and/or per-file `Edited name +N` with inline diff snippet. |
| **Live** | Present continuous: `Exploring…` / `Editing…` / `Running…` / `Thinking` (shimmer). Counts update as tools land. |
| **Done** | Past tense + optional `+/-` (git colors via `.ai-compose-add` / `.ai-compose-rem`). |

**Label order (Cursor):** Edited first, then lowercase `explored…` / `N searches`, then Ran…

**Explore set:** Read, NotebookRead, Grep, Glob, ToolSearch, WebSearch, WebFetch.

**Edits stay in the stream** (not stripped when ComposeCard is present). ComposeCard (006 / 038) remains the turn-end Files recap + Undo/Review.

**Skipped:** Task*/TodoWrite/AskUserQuestion (sidebar / ask-dock — 067 / 073).

### Timing

| Label | Source | When shown |
|---|---|---|
| **Worked for Xm Ys** | Provider `usage.durationMs`, else client clock from turn start | Finished assistant message (`!streaming`) |
| **Thinking** | CC empty content keepalives + open think | Live, before flush |
| **Thought for Xs** | Client clock: keepalive/open → close tag / tool_call / turn end (`thinkingMs`, min ~400ms) | Done chip; legacy → `Reasoning · N words` |

### Status dock soft-reduce

When `streamingBlocks` already has `tool_call` (or inline prose), hide generic
“Running tools…” / “Generating…” so the transcript owns the narrative. Keep
Planning (until `thinkingLive`), stale/idle, and warming-up.

### Perf contract

Default paint is **collapsed**: one summary line per batch.

| Helper | Asserts |
|---|---|
| `batchRenderCost(items, "collapsed" \| "expanded")` | Collapsed = 1 short line; expanded includes detail labels + edit bodies |

Vitest (`npm test -- chatActionSummary.test.ts`): explore×24 and edit×8 batches
prove `collapsed.chars ≪ expanded.chars`; solo stays one line either mode.

### CSS

| Class | Role |
|---|---|
| `.ai-batch-summary` | Container — vertical padding (`padding: 4px 0`) |
| `.ai-batch-summary.is-solo` | Single-tool flat line |
| `.ai-batch-summary-head` / `-label` / `-diff` / `-caret` | Summary row |
| `.ai-batch-summary-detail` | Expanded list |
| `.ai-batch-edit-file*` / `.ai-batch-edit-diff*` | Per-file edit + inline preview |
| `.ai-worked-header` | Quiet turn duration |

### Gotchas

- **Hooks:** solo vs group are separate components (`SoloActionLine` /
  `BatchGroupSummary`) so hook count stays stable.
- **CC thinking:** keepalives are empty `content` events — must start
  `thinkingStartedAt` / `thinkingLive` there, not only on the closed
  `<think>` flush (or `Thought for` stays ~0).
- **Circular import:** `chatActionSummary` ↔ `chatToolRender` (shared
  `pathOf` / `extractEditDiffs`). Safe at render time; prefer extracting
  meta helpers if it grows.
- **Do not** also render outer Reasoning when `blocks[]` exists (056).
