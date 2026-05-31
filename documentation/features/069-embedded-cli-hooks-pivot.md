---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18), Node.js hooks
created: 2026-05-29
last_verified: 2026-05-29
tags: [embedded-cli, hooks, pivot, claude-code, status, chatstore-facade, feature-flag, billing-june15, terminal, portable-pty]
---

## Embedded CLI + Hooks-Driven Status (Pivot)

**Purpose:** Replace the central SDK-driven chat-stream with an embedded interactive Claude Code CLI terminal, and drive session status (working / needs-attention / done) from Claude Code **hooks** instead of the Agent SDK event stream. Motivation: Anthropic's 2026-06-15 billing change moves programmatic Agent SDK usage to a separate paid/capped credit pool, while *interactive terminal Claude Code is not affected*. Pivot keeps the left sidebar (043), right panel (035/054), and tab system unchanged by preserving the `chatStore` facade and only swapping its WRITERS.

**Stack:** React 18 + TypeScript (frontend), Rust/Tauri (backend), pure Node.js hook scripts, xterm.js + portable-pty (existing terminal stack).

### Strategy (one line)
`chatStore` (4 Maps read by 19 consumers via selectors) stays byte-identical; only who WRITES it changes: SDK events → hook events. The preserved UI lights up with zero component edits.

### Files
| Type | Path | Purpose | Status |
|------|------|---------|--------|
| Hook script | `~/.quack/hooks/brain/quack-status.js` | Multiplexed hook (Stop/Notification/PermissionRequest/UserPromptSubmit). Env-gated on `QUACK_API_PORT`; POSTs status to localhost Remote API. Zero-dep, never blocks CLI (always exit 0). | ✅ Fase 1 |
| Rust route | `src-tauri/src/lib.rs` — `handle_hook_status` + `/hooks/status` (legacy_router) | Receives hook ping, re-emits `hook-status` Tauri event to frontend. No bearer auth (localhost, mirrors `/terminal/status`). | ✅ Fase 1 |
| Config | `.claude/settings.json` (project) | Registers `quack-status.js` on Stop/Notification/PermissionRequest/UserPromptSubmit (matcher `""`) + PreToolUse/PostToolUse (matcher `ExitPlanMode\|AskUserQuestion`). | ✅ Fase 1 + 2026-05-30 |
| Feature flag | `src/utils/featureFlags.ts` — `isEmbeddedCliEnabled()` / `setEmbeddedCliEnabled()` | localStorage `quack:useEmbeddedCLI`. Out of versioned settings store → rollback without rebuild. | ✅ Fase 2 |
| Listener | `src/hooks/useHookStatusListener.ts` | Tauri `hook-status` listener → chatStore setters. Idle-expiry (5min). Single-writer guard. | ✅ Fase 2 |
| Wiring | `src/App.tsx` (~L433) | `useHookStatusListener()` next to `useRemoteLiveStateSync()`. | ✅ Fase 2 |
| Component | `src/components/AgentTerminalView.tsx` + `.css` | Self-contained xterm host (modeled on spaceship-ai TerminalInstance). Spawns interactive `claude` in agent cwd via `create_agent_terminal` (injects `QUACK_SESSION_ID`/`QUACK_API_PORT`/`QUACK_HOOK_TOKEN`/`COLORTERM`). **ResizeObserver** keeps PTY↔xterm size locked (`fit()`+`resize_terminal`+`proposeDimensions`, `allowProposedApi:true`) → no TUI garbling. Zero-width scrollbar. Auto-launches `clear && claude`. | ✅ Fase 3+5 |
| Backend | `src-tauri/src/terminal.rs` — `create_agent_terminal` + `ensure_status_hooks_installed` + `spawn_process(env_extra, init_size)` | New PTY command: per-project hook install (raw JSON, preserves UserPromptSubmit/PermissionRequest), env injection. | ✅ |
| Flip | `src/App.tsx` center mount | `isEmbeddedCliEnabled() && !isTaskChat && activeSessionId && cwd` → `AgentTerminalView` instead of `ChatView`. | ✅ Fase 5 |

### Data Flow (hook → UI)
```
claude CLI (in PTY, env: QUACK_API_PORT/QUACK_HOOK_TOKEN/QUACK_SESSION_ID)
  → fires hook (Stop / Notification / PermissionRequest / UserPromptSubmit)
  → quack-status.js reads stdin {session_id, hook_event_name, cwd, transcript_path}
  → POST http://127.0.0.1:<port>/hooks/status {quack_session_id, session_id, hook_event_name, ...}
  → handle_hook_status (lib.rs) emits Tauri event "hook-status"
  → useHookStatusListener maps to chatStore:
       UserPromptSubmit → setLoading(true), clear "hook:waiting"
       Stop/StopFailure → setLoading(false), clear "hook:waiting"   (Agent done = P3)
       Notification/PermissionRequest → setPendingQuestion("hook:waiting", true)  (Needs attention = P1)
  → TaskHubView / AgentSessionList re-render (read same Maps) — ZERO edits
  → useRemoteLiveStateSync mirrors chatStore → backend → WS → PWA Task Hub
```

### Status mapping
Final mapping (2026-05-31, herdr method — see Update below). Hooks are the
instant hint; the terminal-screen scan is the authority.

| Source | Signal | Write (via sessionStatusWrites) | Dot |
|---|---|---|---|
| Hook | `UserPromptSubmit` | `markWorking` | yellow |
| Hook | `PermissionRequest` | `markBlocked` | purple |
| Hook | `PreToolUse(ExitPlanMode\|AskUserQuestion)` | `markBlocked` | purple |
| Hook | `PostToolUse(ExitPlanMode\|AskUserQuestion)` | `markWorking` | yellow |
| Hook | `Stop` / `StopFailure` | `markDone` + token backfill | green |
| Hook | `SessionStart` / `SessionEnd` | `markReleased` | clears |
| Screen | blocked (permission / plan / yes-no UI) | `markBlocked` | purple |
| Screen | working (`esc to interrupt` / spinner) | `markWorking` | yellow |
| Screen | idle (prompt box `❯`, debounced 1.5s) | `markDone` | green |
| Screen | unknown (foreign agent / shell / ambiguous menu) | — (defer to hooks) | — |

The targeted `PreToolUse(ExitPlanMode\|AskUserQuestion)` hook + the screen's
`unknown` on a non-yes/no numbered menu together solve the generic AskUserQuestion
case: the screen can't tell it from a slash/settings menu (same widget), so it
defers and the hook supplies the precise blocked signal.

### Key invariants
- **Single-writer**: `useHookStatusListener` writes ONLY when `isEmbeddedCliEnabled()`. When off, SDK feed is authoritative. No blended double-writes.
- **Session key**: `quack_session_id` (injected `QUACK_SESSION_ID`) is the authoritative UI key; `session_id` (Claude's) kept for transcript correlation.
- **Hook gating**: `quack-status.js` no-ops without `QUACK_API_PORT` → safe to register globally.

### Phases (see plan)
1. ✅ Hook→status pipeline. 2. ✅ Frontend listener. 3. ✅ AgentTerminalView + PTY env injection. 4. ✅ Token from transcript on Stop. 5. ✅ Flip + validate consumers. 6. ✅ Delete chat-stream center. 7. ✅ Repoint SDK sends → PTY (strip aggressivo deferred: Codex/Jack). 9. ✅ SDK guard (reframed).

### Update 2026-05-29 (afternoon)
- ⚠️ **Feature flag deleted in Fase 6.** `src/utils/featureFlags.ts` / `isEmbeddedCliEnabled()` / `quack:useEmbeddedCLI` **no longer exist**. Embedded CLI is now **permanently on** (`AgentTerminalView` mounted unconditionally; `useHookStatusListener()` unconditional). The "single-writer flag" / "rollback without rebuild" invariants above are HISTORICAL — there is no flag and no SDK-center rollback. (Doc rows mentioning the flag are kept for history.)
- ✅ **Fase 4 — token from transcript.** New Rust command `sessions::parse_transcript_tail(path) -> {usage, last_text, total_cost_usd}` (reads last ~512KB of the JSONL; takes the LAST assistant `message.usage` = per-turn context fill, not a sum; zero-usage → UI N/A, never errors). `useHookStatusListener` Stop case invokes it and dispatches `CustomEvent('quack:transcript-usage', {sessionKey, usage, cost})`; `App.tsx` listens → `handleTokenUpdate(sessionKey, usage, cost)`. Key matches because the token map is keyed by `chatKey` == hook `quack_session_id`.
- ✅ **Fase 9 — SDK guard (reframed).** Since embedded is permanent, "gate behind embedded flag" would disable Jack/BTW/Kanban entirely. Instead: opt-OUT kill-switch `src/utils/sdkStreamGuard.ts` → `isSdkStreamEnabled()` (default ON; off via `localStorage quack:disableSdkStream='1'`) + `SDK_DISABLED_MESSAGE`. Gated the 3 standalone programmatic SDK sends: `useJackChat`, `useBTW`, `usePopoutKanbanChat`. Lets the user stop paid-pool SDK usage (2026-06-15) without breaking anything by default.
- ✅ **Fase 7 — REPOINT done (strip deferred).** Unblocked by the user ("we can annihilate telegram/whatsapp/pwa → proceed"). `sendMessageForAgent` now early-returns for non-Codex backends by TYPING the prompt into the embedded PTY (`write_to_terminal` on `agent-cli-<sessionId>`, bracketed paste `\x1b[200~…\x1b[201~` + CR) instead of `send_message_via_sdk_streaming`. All 9 programmatic call-sites funnel through it (remote-execute, remote-send-message, WhatsApp auto-start, pendingAutoStart, git-commit, `/clear`, @team) → **zero paid-pool SDK usage on the main agent**; manual typing was already PTY-bound; status stays hook-driven. The aggressive strip (handleClaudeEvent + pending Maps + 3 SDK listeners) was NOT executed: shared with **Codex** (`codex-event`→handleClaudeEvent; OpenAI, not affected by the Anthropic billing change) and **Jack/Kanban** (still use `send_message_via_sdk_streaming`). Removing it would break non-sacrificed features on a no-rollback branch. Do NOT delete the Rust `send_message_via_sdk_streaming` command nor `pendingQuestionIdsMap`. Known limit: model override from remote-execute does not apply to an already-running PTY `claude`. See WS8 "Fase 7 — repoint fatto, strip deferred".

### Update 2026-05-30 — fix dot inaffidabile (giallo/grigio/viola)
- 🐛 **Dot bloccato GIALLO su piano/domanda.** Il viola era derivato solo da `Notification`/`PermissionRequest`, ma in interattivo Claude Code NON spara `Notification` per ExitPlanMode/AskUserQuestion → l'ultimo evento restava `UserPromptSubmit` (loading) → giallo finché l'utente non rispondeva.
- ✅ **Fix:** registrati `PreToolUse`/`PostToolUse` con matcher `ExitPlanMode|AskUserQuestion` (segnale autorevole confermato dalla doc hooks ufficiale); `quack-status.js` ora inoltra `tool_name`+`message`; `useHookStatusListener` → PreToolUse di quei tool = viola + loading off, PostToolUse = loading on + clear. `Notification` **filtrato** (viola solo se `permission`) → elimina i viola "a caso" da notifiche idle.
- ⚠️ Richiede **rebuild** + **re-spawn terminale** (la registrazione hook è Rust per-progetto; i progetti già aperti non hanno i nuovi eventi finché non si crea un nuovo terminale).
- Gotcha: `gotcha-embedded-cli-plan-question-dot-stuck-yellow.md`.

### Update 2026-05-31 — dot reliability: the herdr method (screen as ground truth)
Studied [herdr](https://github.com/ogulcancelik/herdr) (clone in `/tmp/herdr`). Its
reliability does NOT come from hook mapping — it comes from reading the agent's
terminal SCREEN as ground truth and letting it override stale/lossy hooks. Ported:
- **`src/utils/agentScreenDetect.ts`** — faithful port of herdr `claude_code.rs`:
  `detectClaudeScreenState(content) → blocked|working|idle|unknown`. `unknown` (no
  Claude prompt box) defers to hooks → never mislabels a Codex/shell screen as done.
- **`src/hooks/useScreenStateArbitration.ts`** — 700ms loop reading every live agent
  terminal buffer (`readAgentTerminalScreen` / `listAgentTerminalSessionIds` exported
  from AgentTerminalView). Screen is authoritative; `idle` debounced 1.5s.
- **`src/utils/sessionStatusWrites.ts`** — idempotent `markWorking/Blocked/Done/Released`,
  shared (DRY) by the hook listener AND the screen loop so they converge, not fight.
- **Hooks realigned to herdr** + **dead code removed**: dropped `Notification` handling,
  `isBlockingNotification`, the idle-expiry sweep, and the `message` hook-payload field.
  Kept (as precision signal, not screen-redundant) the targeted
  `PreToolUse/PostToolUse(ExitPlanMode|AskUserQuestion)` + `tool_name` — see the
  AskUserQuestion note above. `terminal.rs` EVENTS: SessionStart/UserPromptSubmit/
  PermissionRequest/Stop/SessionEnd + PreToolUse/PostToolUse(ExitPlanMode|AskUserQuestion).
- Tests: `src/tests/agentScreenDetect.test.ts` (9/9). tsc + cargo check clean.
- Gotcha: `gotcha-embedded-cli-plan-question-dot-stuck-yellow.md` (updated to this method).

### Update 2026-05-31 (later) — session name = Claude Code + resume on open
Embedded sessions never saved Claude's session id (the old save was in the SDK
`handleClaudeEvent`, no longer on the main agent), and the title stayed the default
placeholder. Two fixes:
- **Name**: new Rust command `sessions::read_transcript_title(path)` (reuses a
  factored-out `first_user_message_title` helper — DRY with the metadata scan) reads
  the first user message from the transcript head. On `Stop`, `useHookStatusListener`
  calls it and `updateSession({title})` — **always overwrites** (user choice). The
  title lives in `useSessionStore` (shared) → sidebar + Task Hub + tab label update.
- **Resume**: `useHookStatusListener` persists `claudeSessionId` from every `hook-status`
  event (it carries both `quack_session_id` and Claude's `session_id`). Both
  `AgentTerminalView` render sites in `App.tsx` now pass
  `claudeArgs={session.claudeSessionId ? \`--resume <id>\` : undefined}`. The
  `createdTerminals`/`launchedTerminals` guards make `--resume` fire only on a fresh PTY
  launch (app restart / tab reopen), never relaunching a live session.
- Plan: `~/.claude/plans/immutable-purring-flamingo.md`. Files: `sessions.rs`, `lib.rs`,
  `useHookStatusListener.ts`, `App.tsx`. Needs Tauri rebuild (new command).

### Accepted regressions
- Token stats: hooks carry no usage data → backfilled from `transcript_path` on Stop (Fase 4), `N/A` fallback.
- Jack/BTW/Kanban-inline still use the paid SDK pool (gated by the Fase 9 opt-out switch). Remote/Telegram/PWA-write/DroidFactory still SDK until Fase 7 repoint.

### Cross-References
- **043-agent-sidebar**, **054-task-hub-view** — consumers, unchanged.
- **pattern-remote-api-architecture**, **pattern-pwa-task-hub-mirror** — `notify_session_*` + `SessionLiveStateMap` reused.
- Plan: `~/.claude/plans/skill-project-ops-vorrei-ripensare-a-humble-planet.md`.
