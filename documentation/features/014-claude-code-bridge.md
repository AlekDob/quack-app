---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-07-13
tags: [claude-code, bridge, subprocess, streaming, stop, process-group, watchdog, rust, performance]
---

## Claude Code Bridge (spawn / stream / attach / stop)

**Purpose:** Run the local `claude` CLI as a child process, stream its `stream-json` events to the chat, let a refreshed frontend re-attach to an in-flight run, and **stop a run cleanly** without leaving runaway subprocesses. The headline fix: pressing Stop now kills the whole process tree instead of orphaning Claude Code's tool children (which pinned the CPU and froze the app).

**Stack:** Rust (`std::process`, `parking_lot`, threads + atomics), Tauri events, `libc` (unix) for `killpg`.

### Files
| Type | Path | Purpose |
|------|------|---------|
| Bridge | `src-tauri/src/claude_models.rs` | `claude_code_list_models` — dynamic picker catalog (`059`) |
| Bridge | `src-tauri/src/claude_code.rs` | spawn, reader/watchdog/wait threads, `kill_process_tree`, `claude_print_text`, all `claude_code_*` commands |
| State | `claude_code.rs` → `ClaudeCodeState` | `children: Map<streamId, pid>`, `buffers`, `session_streams` |
| Background wake | `src/backgroundWake.ts` | auto `--resume` nudge when a `-p` turn ends after `run_in_background` Bash — see [048-background-task-wake.md](048-background-task-wake.md) |
| Dep | `src-tauri/Cargo.toml` | `[target.'cfg(unix)'.dependencies] libc` |

### Tauri commands
| Command | Role |
|---|---|
| `claude_code_check` | resolve & version-probe the `claude` binary (PATH, shell, common install dirs) |
| `claude_auth_status` | lightweight OAuth/credentials probe — `{ status, reason?, subscriptionType? }`; no usage API call |
| `claude_code_list_models` | dynamic composer catalog from `/model` — **`059-claude-code-model-catalog.md`** |
| `claude_code_chat` | spawn a run; returns a `stream id`; emits `claude-stream:<id>` events |
| `claude_code_attach` | replay buffered events + `ended` for a chat that just refreshed |
| `claude_code_active_sessions` | chat-session ids whose pid is still in `children` (powers the hub "working" dot) |
| `claude_code_kill` | stop a run by stream id → `kill_process_tree(pid)` |
| `claude_code_kill_session` | stop by chat-tab `sessionId` (archive / done / close tab) → lookup stream → `kill_process_tree` |
| `claude_code_clear_session` | drop buffer + reverse mapping for a chat |
| `claude_code_list_sessions` | scan `~/.claude/projects/<encoded-cwd>/*.jsonl`; summaries for ⟲ Sessions picker |
| `claude_code_load_session` | parse one JSONL into `LoadedMessage[]` for resume hydrate |

Session id ↔ Quack chat UI (chip, terminal resume, picker badges): `044-provider-session-bridge.md`.

### Per-run thread model (one spawn → 4 threads)
| Thread | Job | Touches the `Child`? |
|---|---|---|
| stdin writer | write prompt, drop pipe → EOF | takes `child.stdin` |
| stdout reader | `read_line` loop → emit `{kind:"line"}` + buffer | takes `child.stdout` |
| stderr reader | same → `{kind:"stderr"}` | takes `child.stderr` |
| watchdog | every 5s; if idle > `IDLE_TIMEOUT` (600s) after first event → `kill_process_tree(pid)` | NO (pid + `AtomicBool finished`) |
| wait | `child.wait()` → emit `{kind:"end"}`, set `buf.ended`, remove pid | **owns** the `Child` |

### Stop / kill flow (the fix)
- On spawn, `claude` is put in its **own process group**: `cmd.process_group(0)` (unix) / `CREATE_NEW_PROCESS_GROUP` (windows). So `pgid == child pid`.
- `kill_process_tree(pid)` signals the **whole group**: `libc::kill(-(pid as i32), SIGKILL)` (unix) / `taskkill /PID <pid> /T /F` (windows). This reaps node + every tool/search child at once.
- `claude_code_kill` only reads the pid from `children` (brief lock) and signals — it never locks the `Child`. The wait thread, blocked in `child.wait()`, returns the instant the group dies, emits `end`, and removes the pid.

### State design (why pid, not `Child`)
- `children` stores `streamId → u32 pid`, NOT `Arc<Mutex<Child>>`.
- The `Child` is owned solely by the wait thread; `child.wait()` blocks for the whole run.
- Watchdog/kill coordinate via the **pid** (Copy, lock-free) + an `AtomicBool finished` set by the wait thread before it touches shared state.

### Notes / gotchas
- **The bug this fixes (two causes, compounded):** see [../claude-stop-process-group.md](../claude-stop-process-group.md).
  1. The old wait thread did `child.lock().wait()`, holding the mutex for the entire run → `claude_code_kill` and the watchdog's `try_wait` blocked behind it, so **Stop couldn't kill a live run** until it finished on its own.
  2. `Child::kill()` SIGKILLs only the parent `claude`; its tool children (Bash, file searches like `bfs`/`find`) were **orphaned** to launchd and kept running → ~524% CPU, whole-machine slowdown.
  Breadcrumb in code: `// Brain: claude-stop-kills-process-group`.
- **Process-group caveat:** a grandchild that calls `setsid` itself escapes the group; in practice Claude Code's tool subprocesses stay in-group, so this covers the real cases.
- **`active_sessions` stays honest:** `claude_code_kill` does NOT remove the map entry — the wait thread removes it on actual exit, so the hub's "working" indicator clears only once the process is truly gone.
- **Lifecycle kill:** `claude_code_kill_session` mirrors `claude_code_kill` but keyed by chat-tab `sessionId` — used when the user archives/marks done/closes a tab without pressing Stop. Scoped to that chat only; workspace terminals are untouched (`046-process-cleanup.md`).
- **Watchdog handles the upstream hang** (anthropics/claude-code#1920): a run that streams then goes silent > 600s is force-closed via the same group kill so the frontend never spins forever. Shorter values killed legitimate long Bash/deploy runs with no CLI output.
- **Background tasks in `-p` mode:** full design in [048-background-task-wake.md](048-background-task-wake.md). Summary: plain `run_in_background` Bash shells are stopped ~5s after the final result once stdin closes; subagents are waited on with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` + `CLAUDE_CODE_RESUME_INTERRUPTED_TURN=1` set in `apply_clean_env`. Frontend auto-resume via `backgroundWake.ts` when Bash background ends with no live subprocess.
- The chat permission mode (Auto / Auto-edit / Bypass) is a separate concern — see [015-claude-permission-mode.md](015-claude-permission-mode.md).

### Per-turn knobs (effort, permission mode, thinking)

Forwarded from `AIChatPanel` → `claudeCodeProvider.chat()` → `claude_code_chat` on every spawn (Claude Code only).

| Knob | Frontend state | CLI flag | Default / persistence |
|---|---|---|---|
| **Effort** | `ccEffort: string` | `--effort {low\|medium\|high\|xhigh\|max}` | **medium**; per session `ChatSession.ccEffort` (legacy row w/o field → medium, not global); global key = new-chat default only. See `040`. |
| **Permission mode** | `ccPermMode: string \| null` | `--permission-mode …` | Ask (`null`); per session `ChatSession.ccPermMode` (legacy → Ask); global key = new-chat default. See `015`, `040`. |
| **Extended thinking** | `ccThinking: boolean \| null` | passed when set | `null` = CLI auto; per session `ChatSession.ccThinking`. |

`/effort` slash command and composer `Ctrl+1–5` both write `ccEffort` + session row. `/effort off` resets to **medium**, not CLI default.

### Spawn environment (`apply_clean_env`)

Set on every `claude_code_chat` spawn (in addition to `NO_COLOR`, `CI`, `CODETTA_PERM_HOOK`, …):

| Env var | Value | Role |
|---|---|---|
| `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` | `0` | Uncapped wait for background subagents in `-p` (see 048) |
| `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` | `1` | Auto-continue if prior headless run ended mid-turn |
| `ENABLE_TOOL_SEARCH` | `false` | Eager-load deferred tools (`AskUserQuestion`, `ExitPlanMode`) — ToolSearch often misses them (073 / 015) |

### Auth status + guided sign-in

Full design: **[052-claude-code-login-ux.md](052-claude-code-login-ux.md)**.

Summary: `claude_auth_status` (credentials probe, no usage API) + composer
`ClaudeLoginBanner` + `terminal.claude_login` (440px terminal, PTY watch,
success toast, auto-close tab) + ModelBrowser signed-in state + chat stderr
rewrite in `claudeCode.ts`.

### End-of-turn usage + context snapshot

Full design: **[023-session-usage-panel.md](023-session-usage-panel.md)**. Gotcha:
**[cc-context-ring-result-usage.md](../gotcha/cc-context-ring-result-usage.md)**.

| `result` field | Use |
|---|---|
| `usage` (turn total) | Cost chip, cumulative billing, cache-read ledger |
| `contextTokens` (derived) | Context ring % — last API `message_start` / `message_delta` snapshot |

`claudeCode.ts` parses `stream_event` with `--include-partial-messages`. Do
**not** use summed `result.usage` cache fields for context window %.

### Frontend streaming UX

Token deltas surface as `content` events in `AIChatPanel`. UI coalescing + plain
tail rendering (no per-delta markdown parse) live in **`069-smooth-streaming.md`**
— bridge Rust/TS contract unchanged; only the chat paint path improved.

