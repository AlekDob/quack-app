---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-07-05
tags: [claude-code, bridge, subprocess, streaming, stop, process-group, watchdog, rust, performance]
---

## Claude Code Bridge (spawn / stream / attach / stop)

**Purpose:** Run the local `claude` CLI as a child process, stream its `stream-json` events to the chat, let a refreshed frontend re-attach to an in-flight run, and **stop a run cleanly** without leaving runaway subprocesses. The headline fix: pressing Stop now kills the whole process tree instead of orphaning Claude Code's tool children (which pinned the CPU and froze the app).

**Stack:** Rust (`std::process`, `parking_lot`, threads + atomics), Tauri events, `libc` (unix) for `killpg`.

### Files
| Type | Path | Purpose |
|------|------|---------|
| Bridge | `src-tauri/src/claude_code.rs` | spawn, reader/watchdog/wait threads, `kill_process_tree`, all `claude_code_*` commands |
| State | `claude_code.rs` → `ClaudeCodeState` | `children: Map<streamId, pid>`, `buffers`, `session_streams` |
| Dep | `src-tauri/Cargo.toml` | `[target.'cfg(unix)'.dependencies] libc` |

### Tauri commands
| Command | Role |
|---|---|
| `claude_code_check` | resolve & version-probe the `claude` binary (PATH, shell, common install dirs) |
| `claude_code_chat` | spawn a run; returns a `stream id`; emits `claude-stream:<id>` events |
| `claude_code_attach` | replay buffered events + `ended` for a chat that just refreshed |
| `claude_code_active_sessions` | chat-session ids whose pid is still in `children` (powers the hub "working" dot) |
| `claude_code_kill` | stop a run by stream id → `kill_process_tree(pid)` |
| `claude_code_clear_session` | drop buffer + reverse mapping for a chat |

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
- **Watchdog handles the upstream hang** (anthropics/claude-code#1920): a run that streams then goes silent > 600s is force-closed via the same group kill so the frontend never spins forever. Shorter values killed legitimate long Bash/deploy runs with no CLI output.
- The chat permission mode (Auto / Auto-edit / Bypass) is a separate concern — see [015-claude-permission-mode.md](015-claude-permission-mode.md).

### Per-turn knobs (effort, permission mode, thinking)

Forwarded from `AIChatPanel` → `claudeCodeProvider.chat()` → `claude_code_chat` on every spawn (Claude Code only).

| Knob | Frontend state | CLI flag | Default / persistence |
|---|---|---|---|
| **Effort** | `ccEffort: string` | `--effort {low\|medium\|high\|xhigh\|max}` | **medium**; per session `ChatSession.ccEffort` (legacy row w/o field → medium, not global); global key = new-chat default only. See `040`. |
| **Permission mode** | `ccPermMode: string \| null` | `--permission-mode …` | Ask (`null`); per session `ChatSession.ccPermMode` (legacy → Ask); global key = new-chat default. See `015`, `040`. |
| **Extended thinking** | `ccThinking: boolean \| null` | passed when set | `null` = CLI auto; per session `ChatSession.ccThinking`. |

`/effort` slash command and composer `Ctrl+1–5` both write `ccEffort` + session row. `/effort off` resets to **medium**, not CLI default.
