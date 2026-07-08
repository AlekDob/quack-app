---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-08
last_verified: 2026-07-08
tags: [claude-code, background-tasks, bash, subagent, headless, resume, wake, stream-json]
---

## Background task wake (Claude Code `-p`)

**Purpose:** Fix the case where Claude Code launches background work, tells the user
*"I'll wake up when it's done"*, and the Quack chat goes **idle** — never continuing
on its own. Quack drives CC exclusively via `claude -p` (headless / print mode); that
mode's lifecycle rules differ from the interactive TUI harness.

**Scope:** Claude Code only. Cursor CLI and OpenCode use different subprocess models;
this doc does not claim parity for them.

### Problem (user-visible)

1. Agent calls **Bash** with `run_in_background: true` (or launches a background
   **Task** / **Agent** subagent).
2. Assistant text says it will check back when the work finishes.
3. Stream ends; composer shows idle; hub dot flips to **ready**.
4. Nothing happens — user must manually send a follow-up.

### Root cause (Anthropic headless semantics)

Quack spawns `claude -p` per user turn, pipes the prompt on **stdin**, then **closes
stdin** (EOF). See `claude_code.rs` stdin writer thread.

| Background kind | CLI behavior in `-p` | Quack impact |
|---|---|---|
| **Bash** (`run_in_background: true`) | Shell is stopped **~5s after the final `result` event** once stdin has closed. Not designed to outlive the invocation. | Subprocess exits quickly; CC cannot deliver a later "notification" turn inside the same process. |
| **Subagent / workflow** (`Task`, `Agent`, …) | CLI **waits** for completion because the result is part of the turn output. Default cap: **10 min** (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`). | If cap hit, process exits early; our **600s idle watchdog** can also kill a silent wait. |

References: [Anthropic headless docs](https://code.claude.com/docs/en/headless) (background tasks at exit), [claude-code#65498](https://github.com/anthropics/claude-code/issues/65498) (documented cleanup).

**Interactive TUI** keeps a long-lived harness that receives system notifications between
turns. **`-p` does not** — especially for plain background Bash.

### Fix (two layers)

#### Layer 1 — spawn env (`claude_code.rs` → `apply_clean_env`)

| Variable | Value | Why |
|---|---|---|
| `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` | `0` | No artificial 10 min cap on subagent/workflow waits; true hangs still reaped by the 600s idle watchdog. |
| `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` | `1` | If a prior `-p` run ended mid-turn, the next spawn can pick up without the user re-explaining context. |

#### Layer 2 — auto-resume nudge (`backgroundWake.ts` + `AIChatPanel`)

When a **Claude Code** turn's `finally` block runs:

1. Inspect the last assistant message in the in-flight `conversation` array.
2. If it launched **Bash** with `run_in_background` and did **not** already call
   `BashOutput` in the same message → schedule a wake watcher.
3. After **12s grace** (`GRACE_MS`), poll `claude_code_active_sessions` every **8s**.
4. While the chat-tab `sessionId` is still in `activeSessions` → **do nothing** (CC is
   waiting internally, e.g. on a subagent).
5. When the subprocess is **gone** → auto-send one user turn with
   `BACKGROUND_WAKE_PROMPT` (English), which becomes a normal `--resume` continuation.

**Guards (no infinite loops):**

- Skip if the outgoing user text is already `BACKGROUND_WAKE_PROMPT`.
- Cancel pending wake on: new user send, Stop, chat unmount, session switch.
- Wake prompt is a single nudge per scheduled watcher (not a poll loop of resumes).

### Files

| File | Role |
|---|---|
| `src/backgroundWake.ts` | Detection (`lastTurnLaunchedBackgroundBash`), scheduler (`scheduleBackgroundWake`), prompt constant |
| `src/components/AIChatPanel.tsx` | Wires wake into `sendUserText` `finally`; `cancelBackgroundWake` on send/stop/unmount |
| `src-tauri/src/claude_code.rs` | Spawn env vars in `apply_clean_env` |
| `src/ipc.ts` | `claudeCode.activeSessions()` — poll target |

Cross-links: spawn/stream/kill model in [014-claude-code-bridge.md](014-claude-code-bridge.md); hub "working" dot uses the same `activeSessions` list via [009-agent-hub.md](009-agent-hub.md).

### Detection logic

```text
lastTurnLaunchedBackgroundBash(assistantMsg):
  - assistant role + tool_calls present
  - at least one Bash call with run_in_background === true (or "true")
  - no BashOutput tool_call in the same message (CC already continued in-process)
```

Subagent-only background turns are **not** auto-nudged — CC should wait in-process
once `PRINT_BG_WAIT_CEILING_MS=0` is set. The poll loop still benefits them: while
`activeSessions` includes the chat, we never fire the nudge.

### Constants (`backgroundWake.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `GRACE_MS` | 12_000 | Wait after turn end before first poll (covers CLI's ~5s Bash cleanup window) |
| `POLL_MS` | 8_000 | Re-check while subprocess still alive |
| `MAX_ACTIVE_POLLS` | 450 | ~1h ceiling on passive polling while CC waits internally |

### What we do **not** fix

- **Long-lived dev servers** (`npm run dev` in background Bash) cannot survive past
  the `-p` invocation — Anthropic documents this. Use an interactive `claude` session,
  a workspace terminal tab, or `claude --bg` for processes that must outlive one printed
  result.
- **Cursor / OpenCode** — no `BashOutput` / CC notification harness; separate bridges
  ([026-cursor-cli-bridge.md](026-cursor-cli-bridge.md), [028-opencode-bridge.md](028-opencode-bridge.md)).
- **User-visible toast** on auto-wake — not implemented yet; wake is silent today.

### Verify

1. `npm run tauri dev`, Claude Code provider, workspace with a slow command.
2. Prompt: *"Run `sleep 30 && echo done` in the background and tell me when you'll check back."*
3. Turn ends with idle UI → within ~12–20s a new turn should start automatically
   (resume nudge) and CC should `BashOutput` or report results.
4. Agent Hub: while CC subprocess is alive, chat stays **working**; after exit + wake,
   stream restarts.
5. Press **Stop** during the grace window → no auto nudge fires.

### Gotchas

- Auto-wake sends a **real user message** into the transcript (the nudge prompt). It
  is not a hidden system injection — it will appear in history and disk persistence.
- If the user queues a follow-up in the composer while grace is running, the next
  `sendUserText` cancels the watcher (`cancelBackgroundWake`).
- Background Bash killed at exit may already be dead when CC resumes — the model should
  report failure via `BashOutput`; that is expected in `-p` mode, not a Quack bug.
