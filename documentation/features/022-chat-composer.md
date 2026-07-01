---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-01
tags: [chat, composer, input, subagent, dictation, effort, ux]
---

# 022 — Chat composer (roomier "spaceship" pass)

**Purpose:** The chat input redesigned for calm density, inspired by
`spaceship-ai`'s composer *choreography* (not its palette — Quack stays
neutral, Jack the duck stays the assistant). One airy pill with a
single-row, uniform toolbar; who-you're-addressing on the left, model/effort/
mode/mic/send on the right.

## Components

| File | Role |
|---|---|
| `src/components/AIChatPanel.tsx` | Composer shell, textarea, hint row, toolbar layout, `renderModelChip`, wiring |
| `src/components/SubagentPill.tsx` | "Who the message goes to" pill + upward menu (Jack default / discovered subagents) |
| `src/components/EffortPopover.tsx` | Single control for BOTH reasoning effort (slider) and extended thinking (segmented) |
| `src/components/ComposerMic.tsx` | Voice dictation (Web Speech API), graceful `null`-render when unavailable |
| `src/components/Icon.tsx` | Added `arrow-up` (send) + `microphone` icons |
| `src/App.css` | `.ai-composer-*`, `.ai-agent-*`, `.ai-mic-btn`, `.ai-attach-btn`, `.ai-effort-*`, `.ai-composer-hint` |

## Layout (single row, uniform)

- Shell: `radius-md`, soft rest shadow `0 1px 2px` → lifts to `0 4px 16px` on `:focus-within`. Textarea **transparent** (flush with the shell — no white-field-on-grey), 14px/1.5.
- Input-row pad `8px 12px 2px`; meta-bar pad `2px 10px 8px`, gap 5.
- **Left group:** `+` attach (`.ai-attach-btn`) + subagent pill. `.ai-composer-spacer` splits.
- **Right group:** model chip · effort · permission mode · mic · send.
- **Uniform pills** (`.ai-composer-shell` scope): model chip / effort / mode / context indicator all 28px height, `radius-full`, 11px, weight 500, shared hover. Send + stop are 28×28 icon buttons (send = `arrow-up` on monochrome `--primary-bg`, stop = `stop` on red).
- **Hint row** (`.ai-composer-hint`): `@ mentions · / commands · Shift+Enter for newline · ↑ to recall`, shown only when the input is empty and idle.
- Placeholder is dynamic: `Message {activeAgent?.name ?? "Jack"}…`.

## Subagent pill (feature 004 integration)

- Default = Jack (`AIIcon` duck) `· PM`. Picking a discovered subagent shows its duck avatar `· Agent`.
- **Active target is DERIVED from `attachedAgents`** (the delegation source of truth) — no parallel state. Selecting adds to `attachedAgents`; the "Jack" top item clears it. Menu only when Claude Code + agents exist.

## Effort + thinking (one control)

- Pill shows `effort: {label}`; the value span has a fixed `min-width` (`.ai-effort-cur`) so the pill never resizes as effort changes — otherwise the whole right group (and the popover) would drift.
- Popover (`.ai-effort-pop`, astronave-style surface, opens upward) holds:
  - **Effort slider** (Claude-desktop-style) Faster→Smarter over `default/low/medium/high/xhigh/max`, `accent-color: --fg`. Index 0 = default (null).
  - **Extended thinking** segmented `auto / on / off`.
- Replaced the two separate `MetaFlag` pills + the ⚙ tune gate (both removed).

## Plan chip (todos)

- `TodosCard` (`chatPanelChrome.tsx`) moved from a top sticky card to an
  astronave-style **chip above the composer** (`.ai-todos-bar` / `.ai-todos-wrap`).
- Collapsed by default: shows `Plan · {done}/{total}` (or the in-progress item).
  Click expands **upward** into a popover (`.ai-todos-pop`) with the full list
  (reuses `.ai-todos-list` / `.ai-todo-*`). Backdrop closes it. Skipped in
  compact/agent mode (the checklist lives in the sidebar there).

## Rules indicator (CLAUDE.md token weight)

- Header `.ai-rules-indicator` now carries a **colored dot** + `~Nk` token
  count, sized from the rules file's full length (`LoadedRules.bytes`, ~chars/4
  — measured before the 16 KB injection truncation).
- Levels (semantic colour, meaning only): `ok` ≤2500, `warn` ≤6000, `heavy`
  >6000 tokens. Heavy = "taxes every turn, consider trimming" (tooltip). Click
  still opens the file.

## Attach + dictation

- `+` opens a hidden `<input type=file accept=image/*>` → `appendImages` (same path as paste/drag, feature 016).
- Mic uses `SpeechRecognition`/`webkitSpeechRecognition`; finalised transcript is appended to the input; pulses while listening. Renders nothing when the API is absent (e.g. WKWebView) — no dead control.

## Related

- Stream reading type + spacing: `003-design-system.md`.
- Navigation rail (minimap): `021-chat-nav-rail.md`.
