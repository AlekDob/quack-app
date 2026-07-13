---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-13
last_verified: 2026-07-13
tags: [ai-chat, streaming, ux, claude-code, markdown, raf, typewriter, cursor-style, performance]
---

## Smooth assistant streaming (char reveal + rAF paint)

**Purpose:** Make in-flight assistant prose feel like steady typing instead of
jerky blocks — especially with Claude Code bursts. Two layers: rAF-coalesced React
updates + **char-by-char reveal** capped at 2 glyphs/frame. Plain text while
streaming; full markdown on turn commit.

**Problem (before):** Every `content_block_delta` called `setStreaming` +
`setStreamingBlocks`, which re-ran `renderMarkdown()` on the **entire** growing
string and re-mounted HTML. React commits stacked with bursty CLI output → visible
jumps, worse when tool calls split the turn into multiple text blocks.

### Files

| Type | Path | Role |
|------|------|------|
| Utility | `src/streamPaint.ts` | `createStreamPainter` — coalesce UI commits to one per animation frame |
| Utility | `src/typewriterReveal.ts` | `charsToReveal` — time-based budget, max 2 chars/frame |
| Hook | `src/useTypewriterReveal.ts` | rAF reveal loop (~54 chars/s, gentle catch-up) |
| Component | `src/components/StreamingPlainText.tsx` | Inline char reveal + thin pulsing caret |
| Panel | `src/components/AIChatPanel.tsx` | Live loop + attach-replay use rAF painter; legacy bubble path uses plain tail |
| Render | `src/components/chatToolRender.tsx` | `CompactBlocks` — stable text blocks → markdown; live tail → plain |
| Styles | `src/App.css` | `.ai-stream-plain`, `.ai-stream-caret` (inline pulse) |

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

### Char-by-char reveal

Inspired by Vercel AI SDK [`smoothStream`](https://ai-sdk.dev/docs/reference/ai-sdk-core/smooth-stream)
(server-side word buffering) — ported **client-side** because Quack streams from
Claude Code CLI, not `streamText()`.

`useTypewriterReveal(target, active)` trails the buffered `target` with `posRef`:

```
CLI burst (50–200 chars) → streamPaint → setStreaming(target grows)
                              ↓
                    useTypewriterReveal rAF loop
                              ↓
              visible = target.slice(0, pos)   // max +2 chars/frame
                              ↓
              StreamingPlainText + inline caret
```

| Constant | Default | Role |
|----------|---------|------|
| `BASE_CHARS_PER_SEC` | 54 | Steady reading pace |
| `MAX_CHARS_PER_FRAME` | 2 | Hard cap — prevents visible “word blocks” |
| catch-up boost | `1 + min(3, lag/140)` | Speed up when buffer runs ahead; still char-limited |

**Iteration history (why char-by-char):**

| Pass | Approach | Problem |
|------|----------|---------|
| v1 | Plain text + per-delta `renderMarkdown` | Full re-parse jank |
| v2 | rAF `streamPaint` only | Bursts still visible |
| v3 | Word `Intl.Segmenter` + 2–6 words/tick catch-up | Felt like blocks |
| **v4** | **Char reveal, max 2/frame** | Current — smooth typewriter |

`charsToReveal(lag, elapsedMs)` is pure (unit-testable). Hook effect depends only
on `active` — reads `targetRef` so parent rAF batching does not restart the loop.

### Visual contract

| Token / class | Value |
|---------------|-------|
| `.ai-stream-plain` | 13.5px / 1.55 lh — matches `.ai-msg-body .md-preview` |
| `.ai-stream-plain-text` | `pre-wrap` + **inline** caret after last glyph |
| `.ai-stream-caret` | 1.5px `currentColor`, soft opacity pulse (not step-blink) |

No bold, links, or code pills **during** the live tail — intentional trade-off.
Turn commit swaps to full markdown in one frame.

### `createStreamPainter` API

```ts
const paint = createStreamPainter(() => { /* flush React state */ });
paint.schedule();  // coalesce to next frame
paint.flush();     // cancel pending rAF + run now (turn commit)
paint.cancel();    // drop pending rAF (abort / unmount)
```

`streamPainterRef` on `AIChatPanel` cancels any in-flight painter in `finally` so
an aborted turn cannot paint stale text after `setStreaming(null)`.

### Rendering rules (`CompactBlocks`)

| Block | `streaming` | Renderer |
|-------|-------------|----------|
| Text block before last | any | `MarkdownPreview` |
| Last text block | `true` | `StreamingPlainText` + caret |
| Any text block | `false` (committed) | `MarkdownPreview` |

Legacy path (assistant message **without** `blocks[]`, e.g. Ollama): `AIChatPanel`
uses `StreamingPlainText` when `isStreamingThis`, else `MarkdownPreview`.

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
- Tuning: `BASE_CHARS_PER_SEC` / `MAX_CHARS_PER_FRAME` in `typewriterReveal.ts`.
