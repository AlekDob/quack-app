---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-11
tags: [composer, stop, multitask, esc, turn-status]
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
| `src/components/ComposerMic.tsx` | Mic button + Cursor-style `ComposerDictationBar` (feature 052) |
| `src/dictation.ts` | Dictation engine (`native` macOS / `web` Windows), session + audio meter |
| `src-tauri/src/dictation.rs` | macOS Speech.framework bridge (`dictation_*` commands) |
| `src/components/Icon.tsx` | Added `arrow-up` (send) + `microphone` icons |
| `src/components/TurnStreamStatus.tsx` | Composes `StatusPill` rows for planning / tools / generating / stale |
| `src/components/ComposerQueue.tsx` | Cursor-style follow-up queue cards inside the composer pill |
| `src/components/MentionSuggestions.tsx` | `@` autocomplete popover (agents + files, path preview) |
| `src/components/ComposerContextBar.tsx` | Cursor-style path + branch selectors at the top of the composer pill |
| `src/components/AgentCommitDock.tsx` | Agent `git commit` pill above the composer (hash, message, time, push state) — feature 051 |
| `src/components/ComposerGitActions.tsx` | Changed-files list + Commit & Push split control inside the pill — feature 053 |
| `src/composerGitOps.ts` | Stage / commit / branch / push orchestration for composer git menu |
| `src/components/WorkspacePathPicker.tsx` | Workspace path segment — switch open projects or open a folder |
| `src/components/GitBranchPicker.tsx` | Shared git branch dropdown (composer + Source Control panel) |
| `src/composerCtxMenu.tsx` | Portaled menu helper for context-bar dropdowns |
| `src/App.css` | `.ai-composer-*`, `.ai-composer-context-bar`, `.ai-composer-ctx-*`, `.ai-composer-git*`, `.ai-agent-*`, `.ai-mention-*`, `.ai-mic-btn`, `.ai-dictation-*`, `.ai-attach-btn`, `.ai-effort-*`, `.ai-composer-hint`, `.ai-status-dock-row`, `.ai-live-shimmer`, `.ai-turn-hint`, `.ai-commit-dock*`, `.ai-context-dock*`, `.ai-queue-*` |

## Context bar (path + branch)

Full detail: **`050-composer-context-bar.md`**.

Cursor-style selectors at the **top inside** `.ai-composer-shell` (above queue/textarea/meta):

- **Path** — `~/…` label; menu lists open workspaces + **Open folder…**; switching project or opening a folder starts a **new chat** (`addNewAIChat`).
- **Branch** — checkout/create/delete via shared `GitBranchPicker`. Hidden when not a git repo.

Menus are **portaled** (`ComposerCtxMenu`, fixed coords) so `.ai-panel { overflow: hidden }` does not clip them. Always visible — not gated by `showComposerDock`. No **Run on** target in v1.

## Layout (single row, uniform)

- Shell: `radius-md`, soft rest shadow `0 1px 2px` → lifts to `0 4px 16px` on `:focus-within`. Textarea **transparent** (flush with the shell — no white-field-on-grey), 14px/1.5.
- Input-row pad `8px 12px 2px`; meta-bar pad `2px 10px 8px`, gap 5.
- **Left group:** `+` attach (`.ai-attach-btn`) + subagent pill. `.ai-composer-spacer` splits.
- **Right group:** model chip · effort · permission mode · mic · send.
- **Uniform pills** (`.ai-composer-shell` scope): model chip / effort / mode / context indicator all 28px height, `radius-full`, 11px, weight 500, shared hover. Send + stop are 28×28 icon buttons (send = `arrow-up` on monochrome `--primary-bg`, stop = `stop` on red).
- **Hint row** (`.ai-composer-hint`): `@ mentions · / commands · Ctrl+1–5 effort` (Claude Code only) · `Shift+Enter for newline · ↑ to recall`, shown only when the input is empty and idle.
- Placeholder is dynamic: `Message {activeAgent?.name ?? "Jack"}…` when idle; **`Send follow-up`** while a turn is in flight.

## @-mention autocomplete (feature 041)

Full detail: **`041-mention-file-preview.md`**.

- Trigger: `@` at start-of-token or after whitespace (`parseMention` in `AIChatPanel`).
- Popover sits **inline above** `.ai-composer-shell` (not portaled).
- File rows: icon + basename + parent dir; **path tree preview** on the right when a file row is keyboard/hover-active.
- While open, `.ai-panel` gets **`ai-mention-open`** so `overflow: visible` escapes clipping from panel/tab hosts (`:has()` on ancestors).
- Lazy file index: first `@` keystroke calls `search.listFiles(root, 5000)` once per session.
- Picking a file → `addAttachedFile`; picking an agent → `attachedAgents` (004).

## Follow-up queue (feature 039)

While streaming or tools are running, Enter enqueues the composer text instead
of sending immediately. Cards render **inside** the composer pill above the
textarea (`ComposerQueue`). Full behaviour (drain, Send now, Start
Multitasking → New chat, Stop clears queue): **`039-composer-queue.md`**
(includes the Jul 2026 production-freeze fix — drain one item per turn,
`liveTurnRef` guard).

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
- **Persistence (per session):** each `ChatSession` row stores `ccEffort` (feature 040). Global `localStorage` key `lcp.claudeCode.effort` seeds **new** chats only. Legacy rows without the field restore to **medium**, not global. Full flow + bugfix notes: **`040-per-session-composer-state.md`**.
- Shared constants live in `EffortPopover.tsx`: `CC_EFFORTS`, `CC_EFFORT_DEFAULT`, `normalizeCcEffort()`.

### Popover (`.ai-effort-pop`)

- Portaled with **fixed coordinates** (escapes `.ai-panel { overflow: hidden }`). Position computed from the anchor button via `useLayoutEffect` + `clampPopPos`.
- **Effort slider** (Claude-desktop-style) Faster→Smarter over the five levels; `accent-color: --fg`.
- **Extended thinking** segmented `auto / on / off` (`ccThinking`: `null | true | false`); persisted per session on `ChatSession.ccThinking` (feature 040).
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
  response, generating, tokens/s trail, stream-staleness badge (`Still working
  (Ns)` → `Unusually slow (Ns)` + inline Stop after 30s idle via
  `TurnStreamStatus` / `StaleSuffix`). The dock row can also appear when only
  context files are visible (editor open in this project, no active turn).
- `max-height: 40%` + `overflow-y: auto` on the dock — long `RunningToolList`
  stacks scroll internally instead of pushing the composer off-screen.
- Implementation: `TurnStreamStatus` → `StatusPill` in `chatToolRender.tsx`,
  `ContextFilesDock.tsx`, wired in `AIChatPanel.tsx`.

### Live label shimmer (planning / generating)

Active turn labels use **`.ai-live-shimmer`** so "the agent is working" reads
at a glance without adding a second color system.

| State | Label | Shimmer? |
|---|---|---|
| Planning (no text/tools yet) | `Planning next moves…` | yes — `.ai-turn-hint` row |
| Model warmup | `Loading model…` | yes |
| Tools, no rows yet | `Running tools…` | yes — inside inverted `StatusPill` |
| Tools with progress | `N of M done · …` / `Got N tool results — generating…` | yes while still active; **off** when all done and stream ended |
| Token stream | `Generating…` | yes |
| Stale (≥10s idle) | `Still working (Ns)` / `Unusually slow` | separate `.ai-stale-shimmer` (warn tint when stuck) |

**Visual contract**

- Gradient text clip reuses `@keyframes ai-stale-shimmer` (2.2s ease-in-out).
- Planning row (`.ai-turn-hint`): peak sweeps `--fg-muted` → `--fg` with a
  subtle `--accent-hover` mix at 38%/62% — neutral chrome, not semantic color.
- Inverted pill (`.ai-tcall-status`): variant `.ai-tcall-status .ai-status-pill-main .ai-live-shimmer` peaks on `--primary-fg` so shimmer stays legible on the monochrome pill.
- Spinner: `.ai-spinner-live` — 11px, brighter ring (`--fg-dim` top) beside shimmer labels.
- Font: 12.5px / weight 500 on the planning row (was 12px muted static grey).

**Files:** `TurnStreamStatus.tsx` (class wiring), `App.css` (`.ai-live-shimmer`,
`.ai-spinner-live`, `.ai-turn-hint`, pill override). Pill shell unchanged — see
`006-chat-tool-render.md`.

## Agent commit dock (feature 051)

Cursor-style pill **between** `.ai-status-dock` and `.ai-composer-shell` when the
agent's last Bash `git commit` succeeded in this chat session.

Full detail: **`051-agent-commit-dock.md`**.

| Slot | Content |
|---|---|
| Hash | Short SHA from stdout or `git log -1` |
| Message | `-m` / HEREDOC subject |
| Time | Relative (`just now`, `5m ago`, …) |
| Push | `Pushed` (`upload-cloud`, `--ok`) vs `Local` / `↑N` (`cloud`) |

Stays visible after the turn ends. Cleared on new chat and `/clear`. Hydrates from
saved `tool_results` when reopening a session.

## Composer git actions (feature 053)

Cursor-style **inside** the composer pill (below context bar): changed-file rows with
per-file `+`/ `−`, aggregate **Changes** pill, and **Commit & Push** split button with
chevron menu (branch / commit / push variants).

Full detail: **`053-composer-git-actions.md`**.

- Commit message prompt prefills from composer draft text.
- All commit paths stage non-conflicted files first; push uses publish dialog when no upstream.

## Per-project context files (right side of status dock)

Moved from the old standalone `ai-context-dock` chip above the composer and
the transcript `Files: …` indicator. Full detail: **`037-project-context-dock.md`**.

- Pill: `1 file in context` / `N files in context`; hover popover lists editor
  (ON/OFF) + `@`-queued paths; scoped per `wsId` via `workspaceChatContext.ts`.

## Sticky user turns (transcript scroll)

Cursor-style: while you read a long assistant reply, **your prompt stays pinned**
at the top of `.ai-messages`. On send, `pinUserTurnToTop()` scrolls the latest
user anchor into view; `pinActiveRef` blocks tail-follow until the turn ends.

Full DOM/CSS detail (turn wrappers, sticky containing block, z-index stacking):
**`030-user-message-bar.md`**.

## Rules indicator (CLAUDE.md token weight)

- Header `.ai-rules-indicator` now carries a **colored dot** + `~Nk` token
  count, sized from the rules file's full length (`LoadedRules.bytes`, ~chars/4
  — measured before the 16 KB injection truncation).
- Levels (semantic colour, meaning only): `ok` ≤2500, `warn` ≤6000, `heavy`
  >6000 tokens. Heavy = "taxes every turn, consider trimming" (tooltip). Click
  still opens the file.

## Stop (per-session, multitask-safe)

**Purpose:** Cancel the in-flight turn for **this chat only** — not every open
session, not workspace PTYs. See also `046-process-cleanup.md`.

| Control | Scope | Mechanism |
|---|---|---|
| Composer **Stop** button (red, replaces Send) | Visible chat only | `AIChatPanel.stop()` → local `abortRef` → provider `onAbort` → `claude_code_kill` / `cursor_code_kill` by **stream id** |
| **Esc** (window listener while turn active) | Visible chat only | Same `stop()` path; gated by `chatVisible` so background mounted panels don't all fire |
| Inline Stop in status dock (stale ≥30s) | That panel's turn | `TurnStreamStatus` → `onStop` → `stop()` |
| Archive / done / close tab | That descriptor | `stopChatAgent` → `requestChatStop(chatId)` + `*_kill_session` by transcript `sessionId` |

### Mount asymmetry + Stop

Editor (`WorkspaceShell` `AIChatHost`) and Agent Mode (`AgentChatHost`) keep
**every visited chat** mounted (`display:none` / `pointer-events:none` when
hidden) so background tabs can keep streaming and saving (`001`, `043`). Each
`AIChatPanel` owns its own `streaming`, `abortRef`, and composer — clicking Stop
on the visible tab only hits that instance.

**Gotcha (fixed 2026-07-10):** before `chatVisible`, every mounted panel with
`turnActive` registered a **global** `keydown` listener for Esc. Multitasking
(two+ agents running in background tabs) meant one Esc stopped **all** of them.
Fix: hosts pass `chatVisible={visible}`; the Esc effect bails when false.
`onChatStopRequest` was already filtered by `aiChatId` — lifecycle stop was
always per-session.

### What Stop does *not* touch

- Other open chat tabs / Agent Mode sessions (unless you Esc'd before the fix)
- Workspace terminal tabs (`make dev`, etc.) — PTYs are a separate lifecycle
- Queued follow-ups in **this** chat — Stop clears the queue (`039`)

## Attach + dictation

- `+` opens a hidden `<input type=file accept=image/*>` → `appendImages` (same path as paste/drag, feature 016).
- **Voice dictation (feature 052):** mic in the toolbar opens a Cursor-style recording
  row (waveform, timer, ✕ cancel, ✓ insert) that **replaces the textarea** and hides
  the meta toolbar (`.ai-composer-shell.dictating`). macOS Tauri uses native
  `SFSpeechRecognizer`; Windows uses Web Speech API in WebView2. Mic button renders
  `null` when no engine is available — no dead control. Full detail:
  **`052-composer-voice-dictation.md`**.

## Related

- Stream reading type + spacing: `003-design-system.md`.
- Navigation rail (minimap): `021-chat-nav-rail.md`.
- Follow-up queue while busy: `039-composer-queue.md`.
- Per-session composer draft + knobs: `040-per-session-composer-state.md`.
- `@` file path preview popover: `041-mention-file-preview.md`.
- Composer path + branch bar: `050-composer-context-bar.md`.
- Agent commit indicator above composer: `051-agent-commit-dock.md`.
- Composer git actions (inside pill): `053-composer-git-actions.md`.
- Composer voice dictation: `052-composer-voice-dictation.md`.
- Context & usage ring + drawer (CC): `023-session-usage-panel.md`.
