---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-11
last_verified: 2026-07-17
tags: [chat, reasoning, thinking, cursor-cli, claude-code, ui, brain-turn-chip, thought-for]
---

## Reasoning turn chip (Cursor-style)

**Purpose:** Show extended-thinking / chain-of-thought from agentic providers
as a quiet, collapsible recap — same shell as `BrainTurnChip` (054). Live
label **Thinking**; done label **Thought for Xs** when a client clock is
available.

**Stream placement:** inline via `CompactBlocks` → `ThinkingBlock`. Turn wall
time is separate — **Worked for** on `TurnWorkedHeader` (082).

### Files

| Path | Role |
|---|---|
| `src/components/ReasoningTurnChip.tsx` | Header + expand body; live/done labels |
| `src/components/chatToolRender.tsx` | `ThinkingBlock`; dedupe in `CompactBlocks` |
| `src/components/AIChatPanel.tsx` | Outer chip when no `blocks[]`; `thinkingMs` / `thinkingLive` |
| `src/chatTextUtils.ts` | `splitThinking()` |
| `src/formatWorkedDuration.ts` | Shared `4s` / `1m 42s` formatter |
| `src/ai.ts` | Optional `ChatMessage.thinkingMs` |
| `src/App.css` | `.reasoning-turn-chip*` |

### Data flow

1. Provider emits thinking (Claude / Cursor → wrapped `<think>` in stream JSON parsers).
2. **Claude Code** also emits empty `content` keepalives on `thinking_delta` —
   `AIChatPanel` starts `thinkingStartedAt` + `thinkingLive` on those (not only
   on the closed flush).
3. Flush closes the clock → `thinkingMs` on the assistant message (span ≥ ~400ms).
4. `CompactBlocks` → one `ReasoningTurnChip` per unique thinking fragment.
5. Legacy (no `blocks[]`): outer chip from `splitThinking(m.content)`.

### UI contract

| State | Label |
|---|---|
| Live (`streaming` / `thinkingLive`, maybe empty body) | `Thinking` + shimmer; no chevron until text exists |
| Done + `thinkingMs` | `Thought for 4s`; expand body |
| Legacy (no duration) | `Reasoning · N words · preview…` |
| Expanded | Italic pre-wrap, max-height 240px |

Icon: `cloud` at 11px. No emoji.

### Gotchas

- **Double reasoning:** when `blocks.length > 0`, do not also render the outer
  chip — `InterleavedBlocks` already inlined thinking.
- **Duplicate text:** `seenThinking` + `splitThinking` dedupe.
- **`splitThinking` tags:** open/close must be exact.
- **Pair with Brain:** BrainTurnChip = pre-turn inject; this chip = model
  scratch during the turn.
- **Worked for** (082) = whole-turn wall time, not thinking-only.
