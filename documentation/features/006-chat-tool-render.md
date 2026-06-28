---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-06-28
tags: [ai-chat, tool-calls, chatToolRender, cursor-style, animations, diff, css, presentational]
---

## Chat Tool-Call Rendering

**Purpose:** Render an assistant turn's tool calls (Read / Bash / Edit / Grep /
Task / …) in the chat stream as compact, scannable rows — Cursor/Conductor
style — with hidden-by-default results that reveal on click, smooth entrance
and expand animations, and per-tool icons. Pure presentational React + CSS.
**File:** `src/components/chatToolRender.tsx` + styles in `src/App.css`.

### Two render paths (same file)
| Mode | Driver | Entry | Look |
|---|---|---|---|
| Docked chat (non-compact) | `CompactChat` ctx = false | `InterleavedBlocks` → `ToolCallRow` / `ToolGroupCard` | compact pill rows, click to expand |
| Agent mode (compact) | `CompactChat` ctx = true | `CompactBlocks` → `InlineActionRow` | chip clusters ("6 reads · 2 searches") |

The 2026-06-28 redesign targets the **docked** path (the agent path already had chips).

### `ToolCallRow` (generic, non-edit) anatomy
| Part | Source | Notes |
|---|---|---|
| Icon | `toolIconFor(name)` | falls back to `.ai-tcall-dot` (muted) when null |
| Name | `friendlyToolName(name)` | |
| Detail | `shortDetail(primaryToolDetail(args))` | basename / host; full value in `title` |
| Trail | spinner → check → `<Caret>` | spinner while no result; neutral check when empty-done |
| Result | `<pre>` in `.ai-tcall-reveal` | mounted only when expanded; `ai-reveal-in` animation |

Head is a `<button>` (`.is-toggle`) when there's an expandable result, else a
`<div>` — **same markup** so the row doesn't reflow when the result lands
mid-stream. `expanded` `useState` is declared before any early return (Task /
AskUserQuestion / Edit branches) to keep hook order stable.

### Special-case branches (early returns, before generic)
| `call.function.name` | Render |
|---|---|
| `Task` | duck-avatar subagent chip → opens read-only transcript tab (see `004`) |
| `AskUserQuestion` | one-line summary row (interactive card lives in the ask-dock) |
| Edit / Write / MultiEdit / create_file | `EditDiffCard` — inline unified diff + `±` stats |

### Shared helpers (DRY)
- **`shortDetail(detail)`** — compact path/URL form. Used by both `RunningToolRow`
  (live ticker) and `ToolCallRow` (transcript) so both truncate identically.
- **`<Caret open>`** — rotating chevron (`chevron-right` + CSS `rotate(90deg)`).
  Replaced three `▾/▸` text glyphs (generic row, `ToolGroupCard`, `EditDiffCard`).

### Animation / CSS contract (`src/App.css`)
| Class / keyframe | Role |
|---|---|
| `ai-tcall-in` | row entrance (fade + 2px slide-up) |
| `ai-reveal-in` | result body reveal (max-height + opacity) |
| `.ai-caret.open` | chevron rotate 90° (0.16s) |
| `.ai-tcall-head.is-toggle:hover` | `--bg-hi` row hover |
| `.ai-tcall-reveal .ai-tcall-result-body` | mono, `--bg-alt`, max-height 320px scroll |
| `@media (prefers-reduced-motion)` | disables all the above |

All visual values via CSS variables (neutral chrome — no accent fill; check is
`--fg-muted`, not green, per the Cursor-style brand). Edit card is a contained
`radius-sm` card (border was a latent `border-color`-only rule, now completed).

### Gotchas
- Result `<pre>` is mounted only while expanded (not always-mounted) — keeps big
  outputs out of the DOM; the trade-off is no collapse-out animation, only in.
- `ToolGroupCard` is borderless now; expanded children get `margin-left:14px` so
  the burst still reads as one unit.
- Compact-mode overrides (`.ai-panel.compact .ai-tcall-group*`) are harmless
  leftovers (group lost its padding/border) — left in place, not load-bearing.
