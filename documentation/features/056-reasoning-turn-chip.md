---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-11
last_verified: 2026-07-17
tags: [chat, reasoning, thinking, cursor-cli, claude-code, ui, brain-turn-chip]
---

## Reasoning turn chip (Cursor-style)

**Purpose:** Show extended-thinking / chain-of-thought from agentic providers (Claude Code, Cursor CLI Composer, etc.) as a **quiet, collapsible recap** — same visual language as `BrainTurnChip` (054), not the old grey `<details>` blocks with emoji.

**Scope:** Display + client thinking clock. Thinking text still arrives wrapped in `<think>…</think>` inside stream content; `splitThinking()` extracts it before markdown render. `ChatMessage.thinkingMs` is measured in `AIChatPanel` (open tag → close tag).

### Files
| Type | Path | Role |
|------|------|------|
| Component | `src/components/ReasoningTurnChip.tsx` | Collapsed header; live/done labels |
| Inline render | `src/components/chatToolRender.tsx` | `ThinkingBlock` → `ReasoningTurnChip`; dedupe in `CompactBlocks` |
| Fallback | `src/components/AIChatPanel.tsx` | Outer chip when message has thinking but **no** `blocks[]` log |
| Extract | `src/chatTextUtils.ts` | `splitThinking()` — strips tags, dedupes fragments |
| Duration | `src/formatWorkedDuration.ts` | `4s` / `1m 42s` formatter |
| Styles | `src/App.css` | `.reasoning-turn-chip*` (mirrors `.brain-turn-chip`) |

### Data flow
1. Provider emits thinking (Claude `stream_event` / Cursor `type:"thinking"` → wrapped as `<think>` in `cliStreamJson.ts` / `cursorStreamJson.ts`).
2. Stream loop appends text to `blocks[]` and `message.content`; client clock starts on first think open, stops on close.
3. `CompactBlocks` walks blocks → `splitThinking(b.text)` → one `ReasoningTurnChip` per unique thinking fragment (inline with prose/tools). Live when streaming + incomplete/open think on the last text block.
4. If no `blocks` (legacy sessions), `AIChatPanel` renders a single outer `ReasoningTurnChip` from `splitThinking(m.content)`.

### UI contract
| State | What the user sees |
|---|---|
| Live (streaming) | `Thinking` (+ optional shimmer) + chevron |
| Done + `thinkingMs` | `Thought for 4s` + chevron; expand body |
| Legacy (no duration) | `Reasoning · N words · first line preview…` + chevron |
| Expanded | Italic pre-wrap body, max-height 240px scroll, left hairline |

No emoji in chrome (brand rule). Icon: `Icon` `cloud` at 11px.

### Gotchas
- **Double reasoning (fixed):** when `blocks.length > 0`, **do not** also render the outer panel — `InterleavedBlocks` already inlined thinking. Old gate was `!(compact && blocks)` which duplicated in the main editor chat.
- **Duplicate text:** Cursor may emit two thinking cycles with identical copy; `seenThinking` Set in `CompactBlocks` + dedupe in `splitThinking()` suppress repeats.
- **`splitThinking` tags:** supports `` pairs; closing tag must be exact (partial `think>` match was a historical bug).
- **Pair with Brain:** `BrainTurnChip` = pre-turn inject recap; `ReasoningTurnChip` = model scratch work during the assistant turn. Different data, same shell pattern.
- **Worked for** is separate (`TurnWorkedHeader` + `durationMs` on the message) — wall time for the whole turn, not thinking-only.
