---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-07-29
tags: [claude-code, permissions, permission-mode, overlay, auto-allow, store, slash-command, plan-mode, exit-plan-mode, build-handoff, ask-user-question, tool-search, plan-file-write]
---

## Claude Code Permission Mode (Ask / Plan / Auto-edit / Auto / Agent)

**Purpose:** Let the user pick, per chat, how much Claude Code is allowed to do without confirming — from "card on every edit" to "run everything". The chosen mode is the SINGLE driver of auto-allow: the frontend permission overlay enforces it, because the CLI's own `--permission-mode` is inert while the PreToolUse hook intercepts every call.

**Stack:** React 19 + TS strict, module-level store (pub/sub-free, keyed Maps), localStorage persistence.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Bridge store | `src/permModeStore.ts` | `setPermMode` / `getPermModeFor` — **bySession** authoritative; `byCwd` never holds `"plan"`; unknown session_id → Ask (no cwd leak) |
| Ask cache | `src/askQuestionStore.ts` | `publishAskInput(sessionId, tool_input)` — full question payload before deny-redirect (073) |
| Enforcer | `src/components/ClaudePermissionOverlay.tsx` | `isForThisPanel(req)` route guard; `panelPermMode` + `modeAutoAllow`; `PLAN_EXPLORE_TOOLS` / `PLAN_READ_TOOLS`; `planSessionExplore` flag; auto-allows after safety gates |
| Producer | `src/components/AIChatPanel.tsx` | `ccPermMode` state, `/mode` handler; publishes via `setPermMode`; passes `ownerRoot` / `ownerSessionId` / `ownerStreaming` / **`ownerPermMode`** to overlay |
| Hook payload (backend) | `src-tauri/src/claude_perm.rs` | `PermissionRequest` includes `parent_tool_use_id` from PreToolUse hook JSON (subagent sidechain routing) |
| Composer chip | `src/components/ComposerPermMode.tsx` | Cursor-style tinted mode pill + portaled menu (`document.body`) |
| Mode catalog | `src/presets/permModes.ts` | `PERM_MODE_OPTIONS` — label, desc, `icon`, `tone` per mode; `permModeOption()` |
| Slash hint | `src/slashCommands.ts` | `/mode ask\|plan\|auto-edit\|auto\|agent` |
| Plan tab trigger | `src/components/ClaudePermissionOverlay.tsx` | `onPlanReady(requestId, plan)` — fires once per `ExitPlanMode` as soon as `tool_input.plan` lands; buy-in CTA via `planBuyInStore` + `PlanBuyInCard` |
| Plan buy-in | `src/planBuyInStore.ts`, `src/components/PlanBuyInCard.tsx` | Milo chip (**Pass the ball to Milo**); full plan on side surface (`061` / `084`); auto-send on build |
| Hook gate (backend) | `src-tauri/src/claude_code.rs` | `apply_clean_env` sets `CODETTA_PERM_HOOK=1`; `build_hook_command` emits `permissionDecision:'allow'` when that env is absent (no-op for foreign sessions) |

### Modes
| UI label | Stored value | Effect |
|---|---|---|
| Ask (default) | `null` | card on every gated tool; the safe default a fresh install gets |
| Plan | `plan` | plan only, no edits; explore bypass (reads / Task / non-mutating Bash); writes card; `ExitPlanMode` held for [088](088-plan-milo-handoff.md) buy-in (not a generic card) |
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
- `permModeStore` records the mode in `bySession` (by CC session id) and `byCwd` (normalized root) — the cwd fallback covers the first tool call of a fresh chat before its session id has streamed back. **`ownerPermMode` on the overlay is authoritative for cards** — when Jack explores sibling dirs or parallel subagents run, hook `cwd`/`session_id` lookups can desync from the composer chip; `panelPermMode(ownerPermMode, req)` prefers the live composer value.
- A `claude:permission-request` arrives → every mounted `ClaudePermissionOverlay` hears it (global event). `isForThisPanel` drops requests that belong to another workspace or another CC session within the same workspace. The surviving overlay runs its gates **in order**: **AskUserQuestion** → `publishAskInput` + deny redirect (073) → **Agent (`bypassPermissions`) allow-all** → privacy exclusion → read-only allow → `modeAutoAllow(req, planSessionExplore, mode)` → (in Plan mode: stop, show card) → saved/always-allow rules → show card.
- `modeAutoAllow` uses `panelPermMode` (composer first, else `getPermModeFor(req)`): `auto` → allow all; `acceptEdits` → allow only `WRITE_TOOLS`; `plan` → `planModeAutoAllow` (see below).

### Plan-mode auto-allow sets (2026-07-14)

| Set | Tools / rule | When it fires |
|---|---|---|
| `READ_ONLY_HOOK_TOOLS` | `Read`, `Grep`, `Glob`, `NotebookRead` | All modes — upstream of `modeAutoAllow`, after privacy gate |
| `PLAN_READ_TOOLS` | `ToolSearch`, `WebSearch`, `WebFetch` | Plan only, inside `planModeAutoAllow` |
| `PLAN_EXPLORE_TOOLS` | `Task`, `Agent`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TodoWrite` | Plan only — Jack delegates without cards |
| Sidechain | any tool when `parent_tool_use_id` present | Plan only — subagent inner steps; still blocks `WRITE_TOOLS`, non-read-only `Bash`, `ExitPlanMode` |
| `isReadOnlyBash` / `isPlanExploreBash` | non-mutating Bash (pipes, env assigns, `find -exec`, `2>/dev/null`; block `rm`/`git commit`/stdout redirects/`exec`/`eval` as command heads) | Plan only — explore bypass by default (no "Allow exploration" click needed) |
| `planSessionExplore` | in-memory flag per chat turn | User clicked **Allow exploration** — broad auto-allow except writes + `ExitPlanMode` |
| `isPlanFileWrite` | `WRITE_TOOLS` targeting a path under `.claude/plans/` | Plan only — CC's internal plan scratch file; auto-allow so Plan mode is prompt-free. Every other write still cards |

Hook payload shape (relevant fields):

```json
{
  "session_id": "...",
  "cwd": "...",
  "tool_name": "Bash",
  "tool_input": { ... },
  "parent_tool_use_id": "..."
}
```

`parent_tool_use_id` is forwarded by `claude_perm.rs` and emitted on `claude:permission-request` so the overlay can distinguish subagent sidechain calls from Jack's own writes.

### State
| Where | What | Lifetime |
|---|---|---|
| `permModeStore` module Maps | `bySession`, `byCwd` | app session (in-memory) |
| `localStorage` `lcp.claudeCode.permMode` | default for **new** chats | across restarts |
| `ChatSession.ccPermMode` | saved mode per transcript row | localStorage `lcp.ollama.history.{wsId}` |
| `AIChatPanel` `ccPermMode` | per-chat React state | restored on mount / switch |
| `ClaudePermissionOverlay` `queue` | pending permission cards for THIS panel's CC session | component (purged on session switch) |
| `ClaudePermissionOverlay` `planSessionExploreRef` | user opted to stop Plan-mode carding for this run | in-memory; resets on chat/session switch |

### Notes / gotchas
- **Why a module store, not a prop:** the overlay registers its `claude:permission-request` listener once and lives for the whole app — it can't read a panel's React state without closure-staleness. Pattern cloned from `aiTaskStore.ts`.
- **Order matters:** mode auto-allow runs AFTER the privacy gate and read-only allow so those safety checks always win, and BEFORE saved always-allow rules since the mode is the broader intent.
- **Agent mode is enforced by the overlay, NOT by the CLI (gotcha):** `--dangerously-skip-permissions` does NOT disable PreToolUse hooks — the hook still fires and still POSTs, so running bypass "hook-off" on the backend left a stale hook in `settings.local.json` carding everything. So EVERY mode (Agent included) keeps the hook on; `bypassPermissions` is allowed in the listener **before** the privacy gate. Bonus: reading the mode live from `permModeStore` means flipping to Agent mid-run takes effect on the next tool call.
- **Plan-mode explore auto-allow (2026-07-13):** `PLAN_EXPLORE_TOOLS` lets Jack delegate via Task/subagent and maintain TodoWrite checklists without permission cards, while **file edits, writing Bash, and `ExitPlanMode` still card**. Rationale: Plan mode exploration with subagents was unusable (dozens of cards); Jack must still call `ExitPlanMode` before the user can Build. `AskUserQuestion` is **not** in the set — user answers stay interactive.
- **Plan-mode subagent follow-up (2026-07-14):** `PLAN_READ_TOOLS` (`ToolSearch`/`WebSearch`/`WebFetch`) + `NotebookRead` in the read-only hook set. Subagent sidechains auto-allow when the hook payload carries `parent_tool_use_id` (forwarded in `claude_perm.rs`). Read-only Bash allows safe `;`/`&&` chains (`sleep 1; echo done`, `cd ../sibling && grep …`) and adds `sleep`/`find`/`test`. **`ownerPermMode`** prop from `AIChatPanel` — `panelPermMode()` prefers composer Plan over `permModeStore` lookups that miss when subagent `cwd` diverges. **"Allow exploration"** (Plan only) sets `planSessionExploreRef` — stops carding without flipping the composer to Auto; `ExitPlanMode` + file writes still gate.
- **Plan mode ignores saved always-allow rules:** otherwise a persisted "always allow Edit on .ts" would slip an edit past plan mode (the hook's `allow` overrides the CLI's plan block). In plan mode only read-only + explore allows fire; everything else cards.
- **Plan-file write auto-allow (`isPlanFileWrite`, 2026-07-22):** Claude Code sometimes writes its own plan scratch file at `~/.claude/plans/*.md` during Plan mode. That is not a project edit, but `planModeAutoAllow` blocked ALL `WRITE_TOOLS`, so it carded an "Edit" prompt every time. `isPlanFileWrite(req)` now auto-allows `Edit`/`Write`/`MultiEdit`/`NotebookEdit` **only** when the target path is under `.claude/plans/` (guarded in both `planModeAutoAllow` and `isPlanSidechainExplore`); every other write in Plan mode still cards exactly as before. Complements the prompt gate that tells Jack to prefer `ExitPlanMode` over writing scratch files — native CC still writes them sometimes.
- **Plan-mode explore Bash gotcha (`find -exec`, 2026-07-16):** `\bexec\b` in the dangerous-Bash regex matched `find … -exec`, so Plan still carded common explore commands (exactly the "don't annoy me in Plan" complaint). Fix: `exec`/`eval` are only refused as **command heads**; `;`/`&` split ignores escaped `\;` (find terminator). Plan remains explore-bypass by default — only file writes + `ExitPlanMode` card.
- **`NEVER_BLANKET_ALLOW` (`Bash`, `ExitPlanMode`):** even if the user clicks a bare-name "always allow", these are refused a blanket rule — `Bash` because one name would allow arbitrary commands, `ExitPlanMode` because it's a per-plan approval that blanket-allowing would defeat.
- **`/mode off` resets to Ask (`null`)**, not to a permissive default — the safe direction.
- Mode is normalized: `default` is stored as `null` (Ask) so "no mode set" and "explicitly Ask" are the same state.
- **"Allow all" / "Allow exploration" card shortcut:** outside Plan, **Allow all** flips the chat to Auto (`onAllowAll` → `setCcPermMode("auto")`) and resolves the queue. **In Plan mode** the same button reads **Allow exploration** — it sets an in-memory `planSessionExplore` flag (composer stays Plan) and auto-allows reads/subagents; `ExitPlanMode` and file writes still card. Auto keeps the privacy gate + AskUserQuestion redirect.
- **Card visuals:** styled to match the airy neutral composer — `--radius-md` + `--shadow-md`, hairline `--border` (not accent), SVG header icon (no emoji), two action clusters (quiet granular "always/this-session" chips left; Deny · Allow once · **Allow all / Allow exploration** right). Allow once = solid neutral (Enter default); Allow all / Allow exploration = monochrome primary (`--primary-bg`). In Plan mode the rightmost action reads **Allow exploration**, not Allow all.
- **Foreign-session gate (the real root cause of "permessi dal nulla" across workspaces):** the PreToolUse hook Codetta installs lives in `<workspace>/.claude/settings.local.json` forever, so it ALSO fires for claude sessions Codetta didn't spawn — a terminal `claude`, Claude Desktop — running in that folder. Codetta spawns its own claude with `CODETTA_PERM_HOOK=1` (set in `apply_clean_env`); the inlined Node hook checks that env as its FIRST statement and, when absent, emits `permissionDecision:'allow'` and returns **before** POSTing — a no-op so Claude's own permission-mode and `permissions.allow` rules apply. Only Codetta-spawned sessions reach the localhost server. **Gotcha (fixed 2026-07-10):** an earlier version used `ask` for foreign sessions, which forced a hook-level prompt on every gated tool and made Claude Desktop/terminal unusable in instrumented workspaces.
- **Route guard (`isForThisPanel`) — owner props:** the permission server is app-wide (one port, one global `claude:permission-request` event), so the event fires for EVERY running CC session — including background agents in other open workspaces and **other chats in the same workspace** (multiple `AIChatPanel` instances stay mounted via `AIChatHost` lazy portals). `AIChatPanel` passes four owner props to the overlay:
  1. `ownerRoot={root}` — workspace cwd gate. Different project → drop immediately.
  2. `ownerSessionId={claudeSessionId}` — **authoritative within a workspace.** When the request carries `session_id` (always, from the PreToolUse hook), only the panel whose captured CC session id matches enqueues the card. This fixes "permission card stuck on every chat in Virgilio" — the old guard matched cwd alone, so every tab in the same folder showed the same pending Bash card even after switching to an unrelated session.
  3. `ownerStreaming={streaming !== null || runningTools}` — pre-init fallback for the first tool call before the `system/init` event streams back a `session_id`. Only the panel with an in-flight turn can claim the request; idle background tabs in the same workspace no longer fan out.
  4. **`ownerPermMode={ccPermMode}`** — composer permission mode for this chat. Drives Plan vs Auto card labels, **Allow exploration** vs **Allow all**, and `modeAutoAllow` when `permModeStore` is stale. Mirrored in `ownerRef` for the global listener.
  **Queue purge:** a `useEffect` on `[ownerRoot, ownerSessionId, ownerStreaming]` filters the overlay queue through `isForThisPanel` so stale cards disappear when the user switches chat or the CC session id lands. Pattern mirrors `AgentHubWatcher.resolveChat`, which already preferred `claudeSessionId` over cwd for hub status — the overlay was the missing piece.
  **Decision order inside `isForThisPanel`:** (1) reject different `cwd`; (2) if `req.session_id` present → match `ownerSessionId`, or require `ownerStreaming` when the panel hasn't captured init yet; (3) cwd-only fallback when `session_id` absent (shouldn't happen); (4) default `false` — never accept orphan requests.
- The overlay/cards themselves are documented alongside the bridge — see [014-claude-code-bridge.md](014-claude-code-bridge.md).
- **`permModeStore` isolation (2026-07-20):** `"plan"` is **never** written to `byCwd`. Lookup with a known `session_id` that has no recorded mode returns Ask (`default`) — does **not** inherit another chat’s mode via cwd. Prevents “Plan chip / plan permissions” bleeding across sessions in the same project. Vitest: `permModeStore.test.ts`.
- **Plan tab opens independently of the decision:** `onPlanReady` fires as soon as the plan text is non-empty, regardless of whether the user later Builds or denies — reading the plan shouldn't require deciding first. See [061-plan-mode-tab.md](061-plan-mode-tab.md).
- **`ExitPlanMode` → Pass the ball to Milo chip (2026-07-20 / 2026-07-29):** full flow in [088-plan-milo-handoff.md](088-plan-milo-handoff.md). Overlay publishes `planBuyInStore`; chat shows Milo chip only (no plan body); side Plan tab holds markdown; chip hidden while AskUserQuestion docked; Features-first Build; ExitPlanMode prompts only when composer is Plan.
- **AskUserQuestion deny-redirect (073):** first gate always denies with a reason telling the model Quack is showing clickable options — never allow headless under `-p`. `publishAskInput` caches full `tool_input` for the dock. Subagent sidechain calls are denied the same way but **do not** mount `.ai-ask-dock` (parent stream filter) — orchestrator must re-ask. See [073-ask-user-question-dock.md](073-ask-user-question-dock.md), [004-subagent-mentions.md](004-subagent-mentions.md).
- **MCP tools in the PreToolUse matcher (2026-07-17):** `PERMISSION_GATED_TOOLS` includes `mcp__.+` so `mcp__<server>__<tool>` calls hit the Quack card. Without this, CC under `-p` + Ask falls through to the native permission prompt (no TTY) and returns *"Claude requested permissions… but you haven't granted it yet"* with **no Allow button**. Same rationale as gating `WebFetch`/`WebSearch`. Overlay shows `pinky → brain_search`-style labels; Always / This session persist per full tool name. Hook fail-open timer is **50s** (matches `DECISION_TIMEOUT`) — the old 3s timer auto-allowed before the user could click.
- **Eager tools for Plan/Ask docks (2026-07-16):** Quack sets `ENABLE_TOOL_SEARCH=false` on every CC spawn (`apply_clean_env`). Without it, CC defers `AskUserQuestion` + `ExitPlanMode` behind ToolSearch and `select:ExitPlanMode` often fails upstream — Jack pastes plans as prose and neither dock appears. Requires a **new** CC turn (env is per-process); resume alone is not enough if the old process is still alive.
