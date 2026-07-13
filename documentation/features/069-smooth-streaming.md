---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-13
last_verified: 2026-07-13
tags: [ai-chat, streaming, ux, claude-code, markdown, raf, cursor-style, performance]
---

## Smooth assistant streaming (plain tail + rAF paint)

**Purpose:** Make in-flight assistant prose feel continuous instead of jerky
“word blocks,” especially with Claude Code where token deltas arrive in bursts.
Matches the Cursor/Codex pattern: **plain text while streaming**, full markdown
only after the turn commits.

**Problem (before):** Every `content_block_delta` called `setStreaming` +
`setStreamingBlocks`, which re-ran `renderMarkdown()` on the **entire** growing
string and re-mounted HTML. React commits stacked with bursty CLI output → visible
jumps, worse when tool calls split the turn into multiple text blocks.

### Files

| Type | Path | Role |
|------|------|------|
| Utility | `src/streamPaint.ts` | `createStreamPainter` — coalesce UI commits to one per animation frame |
| Component | `src/components/StreamingPlainText.tsx` | Live tail: `pre-wrap` prose + blinking caret |
| Panel | `src/components/AIChatPanel.tsx` | Live loop + attach-replay use rAF painter; legacy bubble path uses plain tail |
| Render | `src/components/chatToolRender.tsx` | `CompactBlocks` — stable text blocks → markdown; live tail → plain |
| Styles | `src/App.css` | `.ai-stream-plain`, `.ai-stream-caret`, `@keyframes ai-stream-caret-blink` |

### Data flow

```
Provider delta (claudeCode.ts → content event)
  → AIChatPanel: acc += text; appendTextBlock(text)   (mutate blocksThisRound in place)
  → streamPaint.schedule()                            (max 1 rAF pending)
  → rAF callback:
       setStreaming(acc)
       setStreamingBlocks([...blocksThisRound])
  → display[] synthetic assistant row (streaming !== null)
  → InterleavedBlocks / CompactBlocks:
       earlier text blocks (before tool) → MarkdownPreview  (stable — safe to parse)
       last text block while streaming   → StreamingPlainText
  → turn end: commit ChatMessage → streaming cleared → all blocks MarkdownPreview
```

Attach-replay (`claude_code_attach` after refresh) uses the same `createStreamPainter`
pattern so resumed turns don't stutter either.

### Rendering rules (`CompactBlocks`)

| Block | `streaming` | Renderer |
|-------|-------------|----------|
| Text block before last | any | `MarkdownPreview` |
| Last text block | `true` | `StreamingPlainText` + caret |
| Any text block | `false` (committed) | `MarkdownPreview` |

Legacy path (assistant message **without** `blocks[]`, e.g. Ollama): `AIChatPanel`
uses `StreamingPlainText` when `isStreamingThis`, else `MarkdownPreview`.

### `createStreamPainter` API

```ts
const paint = createStreamPainter(() => { /* flush React state */ });
paint.schedule();  // coalesce to next frame
paint.flush();     // cancel pending rAF + run now (turn commit)
paint.cancel();    // drop pending rAF (abort / unmount)
```

`streamPainterRef` on `AIChatPanel` cancels any in-flight painter in `finally` so
an aborted turn cannot paint stale text after `setStreaming(null)`.

### Visual contract

| Token / class | Value |
|---------------|-------|
| `.ai-stream-plain` | 13.5px / 1.55 lh — matches `.ai-msg-body .md-preview` |
| `.ai-stream-plain-text` | `white-space: pre-wrap; word-break: break-word` |
| `.ai-stream-caret` | 2px × 1.05em bar, `--fg-muted`, step blink 1.05s |

No bold, links, or code pills **during** the live tail — intentional trade-off
(same as Cursor). Turn commit swaps to full markdown in one frame.

### Provider notes

| Provider | Delta source | UI benefit |
|----------|--------------|------------|
| **Claude Code** | `--include-partial-messages` → `stream_event` / `text_delta` | Primary target — bursts + interleaved tools |
| **Cursor CLI** | `--stream-partial-output` (see `026`) | Same painter + plain tail |
| **Ollama / API** | `content` events in `chatStream` | Legacy bubble path only (no `blocks` until tools) |

Slow **t/s** in `TurnStreamStatus` (e.g. 6 t/s) is real model throughput, not a
UI bug — this feature removes **render** stutter, not generation latency.

### Related features

| Doc | Relationship |
|-----|----------------|
| `049-markdown-renderer.md` | Final committed prose; streaming is the exception |
| `006-chat-tool-render.md` | `CompactBlocks` chooses plain vs markdown per block |
| `014-claude-code-bridge.md` | CLI emits token deltas; bridge unchanged |
| `022-chat-composer.md` | `TurnStreamStatus` t/s badge — orthogonal metric |
| `026-cursor-cli-bridge.md` | Cursor `--stream-partial-output` at provider layer |

### Gotchas

- Do **not** call `setStreaming` / `setStreamingBlocks` on every delta outside the
  painter — restores jank and defeats rAF coalescing.
- `appendTextBlock` mutates `blocksThisRound` in place; painter copies with spread
  only at flush time.
- `balanceFences` applies on markdown path only — incomplete fences during stream
  are expected; plain tail avoids half-rendered code blocks.
- Multi-round non-agentic loops (`MAX_ROUNDS > 1`) create a fresh painter per round;
  `finally` cancels via `streamPainterRef`.
- Re-enabling live markdown (bold-as-you-type) needs incremental parsing — out of
  scope; measure before adding complexity.
