---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-11
last_verified: 2026-07-11
tags: [chat, reasoning, thinking, cursor-cli, claude-code, ui, brain-turn-chip]
---

## Reasoning turn chip (Cursor-style)

**Purpose:** Show extended-thinking / chain-of-thought from agentic providers (Claude Code, Cursor CLI Composer, etc.) as a **quiet, collapsible recap** — same visual language as `BrainTurnChip` (054), not the old grey `<details>` blocks with emoji.

**Scope:** Display only. Thinking text still arrives wrapped in `<think>…</think>` inside stream content; `splitThinking()` extracts it before markdown render.

### Files
| Type | Path | Role |
|------|------|------|
| Component | `src/components/ReasoningTurnChip.tsx` | Collapsed header (cloud icon, label, word count, one-line preview); click expands body |
| Inline render | `src/components/chatToolRender.tsx` | `ThinkingBlock` → `ReasoningTurnChip`; dedupe identical thinking per turn in `CompactBlocks` |
| Fallback | `src/components/AIChatPanel.tsx` | Outer chip when message has thinking but **no** `blocks[]` log |
| Extract | `src/chatTextUtils.ts` | `splitThinking()` — strips tags, dedupes fragments |
| Styles | `src/App.css` | `.reasoning-turn-chip*` (mirrors `.brain-turn-chip`) |

### Data flow
1. Provider emits thinking (Claude `stream_event` / Cursor `type:"thinking"` → wrapped as `<think>` in `cliStreamJson.ts` / `cursorStreamJson.ts`).
2. Stream loop appends text to `blocks[]` and `message.content`.
3. `CompactBlocks` walks blocks → `splitThinking(b.text)` → one `ReasoningTurnChip` per unique thinking fragment (inline with prose/tools).
4. If no `blocks` (legacy sessions), `AIChatPanel` renders a single outer `ReasoningTurnChip` from `splitThinking(m.content)`.

### UI contract
| State | What the user sees |
|---|---|
| Collapsed (default) | `☁ Reasoning · N words · first line preview…` + chevron |
| Expanded | Italic pre-wrap body, max-height 240px scroll, left hairline |

No emoji in chrome (brand rule). Icon: `Icon` `cloud` at 11px.

### Gotchas
- **Double reasoning (fixed):** when `blocks.length > 0`, **do not** also render the outer panel — `InterleavedBlocks` already inlined thinking. Old gate was `!(compact && blocks)` which duplicated in the main editor chat.
- **Duplicate text:** Cursor may emit two thinking cycles with identical copy; `seenThinking` Set in `CompactBlocks` + dedupe in `splitThinking()` suppress repeats.
- **`splitThinking` tags:** supports `</think>` and `` pairs; closing tag must be exact (partial `think>` match was a historical bug).
- **Pair with Brain:** `BrainTurnChip` = pre-turn inject recap; `ReasoningTurnChip` = model scratch work during the assistant turn. Different data, same shell pattern.
