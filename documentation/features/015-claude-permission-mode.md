---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-07-13
tags: [claude-code, permissions, permission-mode, overlay, auto-allow, store, slash-command, plan-mode, exit-plan-mode, build-handoff, ask-user-question]
---

## Claude Code Permission Mode (Ask / Plan / Auto-edit / Auto / Agent)

**Purpose:** Let the user pick, per chat, how much Claude Code is allowed to do without confirming — from "card on every edit" to "run everything". The chosen mode is the SINGLE driver of auto-allow: the frontend permission overlay enforces it, because the CLI's own `--permission-mode` is inert while the PreToolUse hook intercepts every call.

**Stack:** React 19 + TS strict, module-level store (pub/sub-free, keyed Maps), localStorage persistence.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Bridge store | `src/permModeStore.ts` | `setPermMode(opts, mode)`, `getPermModeFor(req)` — mode keyed by CC session id (+ cwd fallback) |
| Ask cache | `src/askQuestionStore.ts` | `publishAskInput(sessionId, tool_input)` — full question payload before deny-redirect (073) |
| Enforcer | `src/components/ClaudePermissionOverlay.tsx` | `isForThisPanel(req)` route guard; `modeAutoAllow(req)` + `WRITE_TOOLS`; auto-allows after the safety gates |
| Producer | `src/components/AIChatPanel.tsx` | `ccPermMode` state, `/mode` handler; publishes via `setPermMode`; passes owner props to overlay |
| Composer chip | `src/components/ComposerPermMode.tsx` | Cursor-style tinted mode pill + portaled menu (`document.body`) |
| Mode catalog | `src/presets/permModes.ts` | `PERM_MODE_OPTIONS` — label, desc, `icon`, `tone` per mode; `permModeOption()` |
| Slash hint | `src/slashCommands.ts` | `/mode ask\|plan\|auto-edit\|auto\|agent` |
| Plan tab trigger | `src/components/ClaudePermissionOverlay.tsx` | `onPlanReady(requestId, plan)` — fires once per `ExitPlanMode` request as soon as `tool_input.plan` lands; `onPlanBuild(requestId, plan)` — Build handoff (see below) |
| Hook gate (backend) | `src-tauri/src/claude_code.rs` | `apply_clean_env` sets `CODETTA_PERM_HOOK=1`; `build_hook_command` emits `permissionDecision:'allow'` when that env is absent (no-op for foreign sessions) |

### Modes
| UI label | Stored value | Effect |
|---|---|---|
| Ask (default) | `null` | card on every gated tool; the safe default a fresh install gets |
| Plan | `plan` | plan only, no edits; Read/Grep/Glob auto + **read-only Bash auto** + **Task/subagent delegation auto** (`Task`/`Agent`/`TaskCreate`/`TaskUpdate`/`TaskList`/`TodoWrite`); writing Bash + file edits still card; `ExitPlanMode` always cards |
| Auto-edit | `acceptEdits` | auto-allow file-edit tools (`Edit`/`MultiEdit`/`Write`/`NotebookEdit`); Bash & rest still card |
| Auto | `auto` | auto-allow everything (Bash included); privacy gate + AskUserQuestion redirect still apply |
| Agent | `bypassPermissions` | overlay allows EVERY tool, **before** the privacy gate too → no cards, no guard. Hook stays on (see gotcha). UI was **Bypass** until 2026-07-13. |

### Composer mode chip (2026-07-13)

Cursor-style **semantic tint + icon** on the active mode pill; dropdown rows show a colored dot with the same glyph.

| UI label | Icon | Tone token | Color |
|---|---|---|---|
| Ask | `circle` | `--info` | neutral grey |
| Plan | `file-text` | `--warn` | amber |
| Auto-edit | `edit` | `--tool-edit` | green |
| Auto | `zap` | `--ok` | green |
| Agent | `bot` | `--tool-task` | pink |

- **Portaled menu** — `ComposerPermMode` renders the dropdown on `document.body` with `position: fixed` (same pattern as `EffortPopover`, `ComposerCtxMenu`). Fixes the menu painting **under the file-tree sidebar** when it extended left of the chat column.
- **Shift+Tab** still cycles modes; toast uses `permModeOption().label`.
- **Slash aliases** for Agent: `/mode agent` (primary), plus `holo`, `bypass`, `yolo` → stored `bypassPermissions`.

### Data Flow
- `AIChatPanel` holds `ccPermMode` per chat. Restored from `ChatSession.ccPermMode` on session switch; global `localStorage["lcp.claudeCode.permMode"]` seeds **new** chats only (feature 040). Legacy rows without the field restore to **Ask** (`null`), not global. See `040-per-session-composer-state.md`.
- `permModeStore` records the mode in `bySession` (by CC session id) and `byCwd` (normalized root) — the cwd fallback covers the first tool call of a fresh chat before its session id has streamed back.
- A `claude:permission-request` arrives → every mounted `ClaudePermissionOverlay` hears it (global event). `isForThisPanel` drops requests that belong to another workspace or another CC session within the same workspace. The surviving overlay runs its gates **in order**: **AskUserQuestion** → `publishAskInput` + deny redirect (073) → **Agent (`bypassPermissions`) allow-all** → privacy exclusion → read-only allow → `modeAutoAllow(req)` → (in Plan mode: stop, show card) → saved/always-allow rules → show card.
- `modeAutoAllow` calls `getPermModeFor(req)` (session id, then cwd, else `"default"`): `auto` → allow all; `acceptEdits` → allow only `WRITE_TOOLS`; `plan` → allow `PLAN_EXPLORE_TOOLS` (`Task`/`Agent`/`TaskCreate`/`TaskUpdate`/`TaskList`/`TodoWrite`) **or** Bash when `isReadOnlyBash` (head ∈ `READ_ONLY_BASH`, or `git` + read-only subcommand, and no chain/redirect/pipe/subshell via `BASH_CHAIN_RE`); else → no mode-based allow.

### State
| Where | What | Lifetime |
|---|---|---|
| `permModeStore` module Maps | `bySession`, `byCwd` | app session (in-memory) |
| `localStorage` `lcp.claudeCode.permMode` | default for **new** chats | across restarts |
| `ChatSession.ccPermMode` | saved mode per transcript row | localStorage `lcp.ollama.history.{wsId}` |
| `AIChatPanel` `ccPermMode` | per-chat React state | restored on mount / switch |
| `ClaudePermissionOverlay` `queue` | pending permission cards for THIS panel's CC session | component (purged on session switch) |

### Notes / gotchas
- **Why a module store, not a prop:** the overlay registers its `claude:permission-request` listener once and lives for the whole app — it can't read a panel's React state without closure-staleness. Pattern cloned from `aiTaskStore.ts`.
- **Order matters:** mode auto-allow runs AFTER the privacy gate and read-only allow so those safety checks always win, and BEFORE saved always-allow rules since the mode is the broader intent.
- **Agent mode is enforced by the overlay, NOT by the CLI (gotcha):** `--dangerously-skip-permissions` does NOT disable PreToolUse hooks — the hook still fires and still POSTs, so running bypass "hook-off" on the backend left a stale hook in `settings.local.json` carding everything. So EVERY mode (Agent included) keeps the hook on; `bypassPermissions` is allowed in the listener **before** the privacy gate. Bonus: reading the mode live from `permModeStore` means flipping to Agent mid-run takes effect on the next tool call.
- **Plan-mode explore auto-allow (2026-07-13):** `PLAN_EXPLORE_TOOLS` lets Jack delegate via Task/subagent and maintain TodoWrite checklists without permission cards, while **file edits, writing Bash, and `ExitPlanMode` still card**. Rationale: Plan mode exploration with subagents was unusable (dozens of cards); Jack must still call `ExitPlanMode` before the user can Build. `AskUserQuestion` is **not** in the set — user answers stay interactive.
- **Plan mode ignores saved always-allow rules:** otherwise a persisted "always allow Edit on .ts" would slip an edit past plan mode (the hook's `allow` overrides the CLI's plan block). In plan mode only read-only + explore allows fire; everything else cards.
- **Plan-mode read-only Bash:** `READ_ONLY_BASH` lists provably-read commands only (`ls cat head tail wc pwd echo grep rg tree stat file which type date whoami uname hostname du df printenv sort uniq cut basename dirname realpath`); `git` is gated separately on `GIT_RO_SUBCMDS` (`status log diff show blame ls-files rev-parse describe`). Deliberately excluded: runners (`env`/`xargs`/`sudo`/`nohup`), in-place editors (`sed -i`), and `git branch/tag/config/remote` (mutating forms exist). Any redirect/pipe/chain/subshell (`;`/`&`/`|`/`` ` ``/`<`/`>`/newline/`$(`) rejects the command via `BASH_CHAIN_RE` first, so a safelisted head can't smuggle a second command. Read/Grep/Glob never reach `modeAutoAllow` — they auto-allow upstream as `READ_ONLY_HOOK_TOOLS`.
- **`NEVER_BLANKET_ALLOW` (`Bash`, `ExitPlanMode`):** even if the user clicks a bare-name "always allow", these are refused a blanket rule — `Bash` because one name would allow arbitrary commands, `ExitPlanMode` because it's a per-plan approval that blanket-allowing would defeat.
- **`/mode off` resets to Ask (`null`)**, not to a permissive default — the safe direction.
- Mode is normalized: `default` is stored as `null` (Ask) so "no mode set" and "explicitly Ask" are the same state.
- **"Allow all" card shortcut:** the card's emphasized action flips the chat to Auto in one click. The overlay takes an `onAllowAll` prop wired by `AIChatPanel` to `setCcPermMode("auto")` — so the composer mode chip + localStorage stay in sync (the overlay does NOT write `permModeStore` directly, which would diverge from the UI). On click it also resolves every already-queued request as allow. This is the "otherwise it asks 100 times" fix; Auto keeps the privacy gate + AskUserQuestion redirect.
- **Card visuals:** styled to match the airy neutral composer — `--radius-md` + `--shadow-md`, hairline `--border` (not accent), SVG header icon (no emoji), two action clusters (quiet granular "always/this-session" chips left; Deny · Allow once · **Allow all** right). Allow once = solid neutral (Enter default); Allow all = monochrome primary (`--primary-bg`).
- **Foreign-session gate (the real root cause of "permessi dal nulla" across workspaces):** the PreToolUse hook Codetta installs lives in `<workspace>/.claude/settings.local.json` forever, so it ALSO fires for claude sessions Codetta didn't spawn — a terminal `claude`, Claude Desktop — running in that folder. Codetta spawns its own claude with `CODETTA_PERM_HOOK=1` (set in `apply_clean_env`); the inlined Node hook checks that env as its FIRST statement and, when absent, emits `permissionDecision:'allow'` and returns **before** POSTing — a no-op so Claude's own permission-mode and `permissions.allow` rules apply. Only Codetta-spawned sessions reach the localhost server. **Gotcha (fixed 2026-07-10):** an earlier version used `ask` for foreign sessions, which forced a hook-level prompt on every gated tool and made Claude Desktop/terminal unusable in instrumented workspaces.
- **Route guard (`isForThisPanel`) — two layers:** the permission server is app-wide (one port, one global `claude:permission-request` event), so the event fires for EVERY running CC session — including background agents in other open workspaces and **other chats in the same workspace** (multiple `AIChatPanel` instances stay mounted via `AIChatHost` lazy portals). `AIChatPanel` passes three owner props to the overlay:
  1. `ownerRoot={root}` — workspace cwd gate. Different project → drop immediately.
  2. `ownerSessionId={claudeSessionId}` — **authoritative within a workspace.** When the request carries `session_id` (always, from the PreToolUse hook), only the panel whose captured CC session id matches enqueues the card. This fixes "permission card stuck on every chat in Virgilio" — the old guard matched cwd alone, so every tab in the same folder showed the same pending Bash card even after switching to an unrelated session.
  3. `ownerStreaming={streaming !== null || runningTools}` — pre-init fallback for the first tool call before the `system/init` event streams back a `session_id`. Only the panel with an in-flight turn can claim the request; idle background tabs in the same workspace no longer fan out.
  **Queue purge:** a `useEffect` on `[ownerRoot, ownerSessionId, ownerStreaming]` filters the overlay queue through `isForThisPanel` so stale cards disappear when the user switches chat or the CC session id lands. Pattern mirrors `AgentHubWatcher.resolveChat`, which already preferred `claudeSessionId` over cwd for hub status — the overlay was the missing piece.
  **Decision order inside `isForThisPanel`:** (1) reject different `cwd`; (2) if `req.session_id` present → match `ownerSessionId`, or require `ownerStreaming` when the panel hasn't captured init yet; (3) cwd-only fallback when `session_id` absent (shouldn't happen); (4) default `false` — never accept orphan requests.
- The overlay/cards themselves are documented alongside the bridge — see [014-claude-code-bridge.md](014-claude-code-bridge.md).
- **Plan tab opens independently of the decision:** `onPlanReady` fires as soon as the plan text is non-empty, regardless of whether the user later Builds or "Keep discussing"s the card — reading the plan shouldn't require deciding first. This does not change `respond()`/`claude_perm_decide` at all. See [061-plan-mode-tab.md](061-plan-mode-tab.md).
- **`ExitPlanMode` card — Cursor-style Build handoff (2026-07-13):** when `tool_name === "ExitPlanMode"`, the card is a plan-review variant (`.cc-perm-plan-card`), not a generic tool gate. Actions:
  - **Keep discussing** (`deny`) — Jack stays in Plan mode; user can refine the plan in chat. `Esc` shortcut.
  - **Build** (`allow` after handoff) — primary action (`Enter`). Calls `onPlanBuild(requestId, plan)` wired by `AIChatPanel` → `handoffStoryToBuilder` + `applyPreset("builder")` + `setCcPermMode("bypassPermissions")` (Milo · Agent). Then `claude_perm_decide: allow` so CC exits plan mode. **No "Allow all"** on this card — that shortcut would flip to Auto and let Jack implement without a formal handoff.
  - Title copy: "Plan ready — build with Milo or keep discussing with Jack".
  - See [068-quack-plan-harness.md](068-quack-plan-harness.md) for story/work side effects.
