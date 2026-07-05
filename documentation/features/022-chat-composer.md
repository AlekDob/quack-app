---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-05
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
| `src/components/TurnStreamStatus.tsx` | Composes `StatusPill` rows for planning / tools / generating / stale |
| `src/App.css` | `.ai-composer-*`, `.ai-agent-*`, `.ai-mic-btn`, `.ai-attach-btn`, `.ai-effort-*`, `.ai-composer-hint`, `.ai-status-dock-row`, `.ai-context-dock*` |

## Layout (single row, uniform)

- Shell: `radius-md`, soft rest shadow `0 1px 2px` → lifts to `0 4px 16px` on `:focus-within`. Textarea **transparent** (flush with the shell — no white-field-on-grey), 14px/1.5.
- Input-row pad `8px 12px 2px`; meta-bar pad `2px 10px 8px`, gap 5.
- **Left group:** `+` attach (`.ai-attach-btn`) + subagent pill. `.ai-composer-spacer` splits.
- **Right group:** model chip · effort · permission mode · mic · send.
- **Uniform pills** (`.ai-composer-shell` scope): model chip / effort / mode / context indicator all 28px height, `radius-full`, 11px, weight 500, shared hover. Send + stop are 28×28 icon buttons (send = `arrow-up` on monochrome `--primary-bg`, stop = `stop` on red).
- **Hint row** (`.ai-composer-hint`): `@ mentions · / commands · Ctrl+1–5 effort` (Claude Code only) · `Shift+Enter for newline · ↑ to recall`, shown only when the input is empty and idle.
- Placeholder is dynamic: `Message {activeAgent?.name ?? "Jack"}…`.

## Subagent pill (feature 004 integration)

- Default = Jack (`AIIcon` duck) `· PM`. Picking a discovered subagent shows its duck avatar `· Agent`.
- **Active target is DERIVED from `attachedAgents`** (the delegation source of truth) — no parallel state. Selecting adds to `attachedAgents`; the "Jack" top item clears it. Menu only when Claude Code + agents exist.

## Effort + thinking (one control)

Claude Code only. Full bridge detail (`--effort` whitelist, spawn wiring): `014-claude-code-bridge.md`.

### Visual meter (toolbar pill)

- Replaced the old text pill (`effort: {label}` + fixed `.ai-effort-cur` min-width) with a **compact signal-strength meter** (`.ai-effort-meter`): five vertical bars (`.ai-effort-bar-1`…`-5`, heights 4–11px). Lit bars = current level; chevron opens the popover.
- Button: `.ai-effort-btn` — `radius-full`, 11px, same 28px uniform pill as model/mode (`.ai-composer-shell` scope).

### Levels + default

| Index | Level | Maps to |
|---|---|---|
| 1 | Low | `--effort low` |
| 2 | **Medium** | `--effort medium` (**app default**) |
| 3 | High | `--effort high` |
| 4 | xHigh | `--effort xhigh` |
| 5 | Max | `--effort max` |

- **No CLI "default" slot** on the slider — the old index-0 `default`/`null` (omit `--effort`) was removed. Quack always sends an explicit level; fresh installs and `/effort off` reset to **medium**.
- **Persistence:** `localStorage` key `lcp.claudeCode.effort` (same pattern as `lcp.claudeCode.permMode`). Survives tab switches, new chats, and app restarts. `AIChatPanel` seeds `ccEffort` from storage on mount and writes back in a `useEffect`.
- Shared constants live in `EffortPopover.tsx`: `CC_EFFORTS`, `CC_EFFORT_DEFAULT`, `normalizeCcEffort()`.

### Popover (`.ai-effort-pop`)

- Portaled with **fixed coordinates** (escapes `.ai-panel { overflow: hidden }`). Position computed from the anchor button via `useLayoutEffect` + `clampPopPos`.
- **Effort slider** (Claude-desktop-style) Faster→Smarter over the five levels; `accent-color: --fg`.
- **Extended thinking** segmented `auto / on / off` (`ccThinking`: `null | true | false`).
- Replaced the two separate `MetaFlag` pills + the ⚙ tune gate (both removed).

### Compose reminder (typing + shortcuts)

Users often forget the active effort level mid-compose. Reminder is **non-blocking** (`pointer-events: none`).

| Trigger | Behaviour |
|---|---|
| First keystroke | Composer goes from empty → non-empty (`onChange` in `AIChatPanel`) → `bumpEffortPulse()` increments `pulseToken` passed to `EffortPopover`. |
| `Ctrl+1` … `Ctrl+5` | Sets effort to levels 1–5 (Claude Code + composer focused). Toast + pulse. `meta`/`alt`/`shift` modifiers ignored. |

When `pulseToken` bumps:

1. **Button pulse** — `.ai-effort-btn.pulse`: border/background highlight (`ai-effort-pulse`, ~1.1s). Active bars briefly flash `--warn` (`ai-effort-bar-pulse`).
2. **Floating label** — `.ai-effort-flash-label` above the meter (e.g. `Medium`): fade/slide in, hold ~0.4s, float up and out (`ai-effort-label-flash`, ~1.35s). `key={pulseToken}` restarts the animation; `onAnimationEnd` unmounts.

Tooltip on the meter button: `Effort: {label} · Thinking: {auto|on|off} — Ctrl+1–5 to switch`.

### Slash command `/effort`

- `/effort low|medium|high|xhigh|max` — sets level + toast.
- `/effort off` or `/effort default` — resets to **medium** (not CLI default).
- Value submenu when typing `/effort ` (no arg typing needed).

## Plan chip (todos)

- `TodosCard` (`chatPanelChrome.tsx`) moved from a top sticky card to an
  astronave-style **chip above the composer** (`.ai-todos-bar` / `.ai-todos-wrap`).
- Collapsed by default: shows `Plan · {done}/{total}` (or the in-progress item).
  Click expands **upward** into a popover (`.ai-todos-pop`) with the full list
  (reuses `.ai-todos-list` / `.ai-todo-*`). Backdrop closes it. Skipped in
  compact/agent mode (the checklist lives in the sidebar there).

## Live turn status dock

- `StatusPill` / `ai-inline-status` live in **`.ai-status-dock`** — a flex slot
  immediately above `.ai-composer-shell`, NOT inside the scrollable `.ai-messages`.
- **Row layout:** `.ai-status-dock-row` — turn status on the **left**
  (`.ai-inline-status`), per-project context files on the **right**
  (`ContextFilesDock`, feature 037). See `037-project-context-dock.md`.
- Same slot family as `ai-ask-dock` and `ai-todos-bar`: operational chrome the
  user should see while typing, even when scrolled up in the transcript.
- Shows while a turn is in flight: running tools, warming up, waiting for
  response, generating, tokens/s trail, stream-staleness badge (+ inline Stop
  after 30s idle). The dock row can also appear when only context files are
  visible (editor open in this project, no active turn).
- `max-height: 40%` + `overflow-y: auto` on the dock — long `RunningToolList`
  stacks scroll internally instead of pushing the composer off-screen.
- Implementation: `TurnStreamStatus` → `StatusPill` in `chatToolRender.tsx`,
  `ContextFilesDock.tsx`, wired in `AIChatPanel.tsx`.

## Per-project context files (right side of status dock)

Moved from the old standalone `ai-context-dock` chip above the composer and
the transcript `Files: …` indicator. Full detail: **`037-project-context-dock.md`**.

- Pill: `1 file in context` / `N files in context`; hover popover lists editor
  (ON/OFF) + `@`-queued paths; scoped per `wsId` via `workspaceChatContext.ts`.

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
