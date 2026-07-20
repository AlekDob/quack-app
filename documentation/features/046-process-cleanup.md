---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-08
last_verified: 2026-07-17
tags: [task-manager, process-tree, pty, terminal, agent-lifecycle, claude-code, cursor-cli, cleanup, sysmon, footprint]
---

## Process cleanup & Task Manager

**Purpose:** Give Alek a live view of **Quack's own process tree** (app + PTY shells + CLI agents + anything they spawned) and ensure closing UI surfaces actually reaps the matching OS processes — without killing unrelated workspace terminals.

**Stack:** Rust `sysinfo` + `libc` process-group kill (unix) / `taskkill /T` (windows); React modal + status-bar glance; Zustand store hooks; small pub/sub buses.

### Two separate lifecycles (critical)

| User action | What gets killed | What stays alive |
|---|---|---|
| **Close terminal tab** (✕ on "Terminal 1") | That PTY's process group only (`zsh` + `make`/`node`/`grep` children **under that shell**) | Other terminal tabs; all chat agents |
| **Close chat tab** / **Mark done** / **Archive** | That chat's agent subprocess only (`claude` / `cursor-agent` + tools **they** spawned) | All workspace PTY terminals (e.g. dev server in Terminal 1) |
| **Stop** in composer (button, stale inline, Esc on visible chat) | That chat's turn only (`abortRef` + kill by stream id) | Other chat sessions; terminals untouched |
| **Close workspace** | All PTYs in that workspace + all its chat agents | Other open workspaces |

PTY terminals and CLI chat agents are **independent trees**. Killing `claude` does not touch a manually opened terminal running `make dev full`.

### Task Manager (monitoring)

| Piece | Path | Role |
|---|---|---|
| Modal UI | `src/components/TaskManagerModal.tsx` | Table: process name, role guess, PID, CPU %, RAM; Kill button for descendants |
| Status bar chip | `src/components/StatusBar.tsx` | `NN% · X MB` every 5s; click → Task Manager |
| Open bus | `src/taskManagerBus.ts` | `openTaskManager()` / `onTaskManagerOpen` |
| Command | `src/actions.ts` → `view.task_manager` | **Ctrl+Alt+U** |
| Rust backend | `src-tauri/src/sysmon.rs` | `process_stats`, `process_kill` |
| Mount | `src/App.tsx` | `<TaskManagerModal/>` |

**Scope:** `process_stats` walks **strict descendants** of the Quack app pid, plus
**related macOS WebKit UI helpers** (`WebKit.WebContent` / Networking / GPU) that
host the WKWebView — those run as XPC under `launchd`, not as Quack children, so a
tree-only view hid the real CPU/RAM hog. Related rows are labeled
`Quack UI (WebKit)`, are **not killable**, and are capped to the heaviest few
started at/after Quack. `process_kill` still refuses anything outside the strict
tree (including Quack itself and WebKit).

**Companion:** Perf Audit window (`086`) reuses the StatusBar's 5s `process_stats`
sample for a read-only process table + switch/hydrate timeline; it does not
replace Task Manager (no kill).

**CPU semantics:** per-core percent since the previous 2s sample (can exceed 100% on multi-threaded processes). Status bar shows the **sum** across the tree (+ related WebKit when present).

**Role column heuristics** (`TaskManagerModal.roleOf`): Quack root → related WebKit → `claude` → Claude Code; `node` → Vite / permission hook / generic Node; `zsh`/`bash` → Terminal shell. ProcStat fields: `killable`, `related`.

### Agent stop on chat lifecycle

| Piece | Path | Role |
|---|---|---|
| Orchestrator | `src/stopChatAgent.ts` | `requestChatStop(chatId)` + provider-specific Rust kill by **chat-tab `sessionId`** |
| Panel abort bus | `src/aiStopBus.ts` | HTTP providers (Anthropic, OpenAI, OpenCode, Ollama) — `AIChatPanel` aborts `AbortController` |
| Store hooks | `src/store.ts` | `closeAIChat`, `setAIChatLifecycle(done\|archived)`, `closeWorkspace` → `stopChatAgent` |
| Panel listener | `src/components/AIChatPanel.tsx` | `onChatStopRequest` → local `stop()`; `chatVisible` gates Esc |
| Hosts | `WorkspaceShell.tsx` `AIChatHost`, `AgentModeShell.tsx` `AgentChatHost` | Pass `chatVisible={visible}` into `AIChatPanel` |
| CC kill by session | `src-tauri/src/claude_code.rs` → `claude_code_kill_session` | `session_streams[chatSessionId]` → `kill_process_tree(pid)` |
| Cursor kill by session | `src-tauri/src/cursor_code.rs` → `cursor_code_kill_session` | same pattern |

`claude_code_kill` / `cursor_code_kill` (by stream id) still power the in-panel **Stop** button; session-scoped kills power lifecycle cleanup.

### PTY kill on terminal close

| Piece | Path | Role |
|---|---|---|
| Store | `src/store.ts` → `closeTerminal` | `pty.kill(ptyId)` then remove tab + descriptor |
| Tab ✕ | `src/store.ts` → `closeTab` | `kind === "terminal"` → `closeTerminal` |
| Rust | `src-tauri/src/pty.rs` → `pty_kill` | `kill_pty_tree`: unix `SIGHUP` + `SIGKILL` on **negated pid** (whole PTY session group); windows `taskkill /T /F` |

**Before (bug):** `child.kill()` on the shell pid only → `make dev full` / orphaned `grep` from a closed terminal tab could survive and burn CPU.

**After:** closing the terminal tab reaps the full stack under that shell.

**Intentionally NOT killed on tab unmount:** `TerminalCore` unmount (workspace switch, hot reload) leaves the PTY alive for re-attach — only `closeTerminal` / `closeWorkspace` / idle sweeper kill.

### Idle terminal close (optional)

`src/footprintSettings.ts` — `idleTerminalCloseEnabled` (default **false**). When enabled, `store.ts` sweeper (60s interval) calls `closeTerminal` on untouched shells. Popped-out terminals are skipped (activity never reaches the touch map).

### Data flow — archive a chat

```
AIChatsRail context menu "Archive"
  → setAIChatLifecycle(wsId, chatId, "archived")
    → stopChatAgent(descriptor)          // kill claude/cursor for THIS session only
    → closeAiTabInLayout                 // remove editor tab; descriptor kept, hidden from hub
```

### Data flow — close terminal tab

```
PaneNode tab ✕
  → closeTab(wsId, termKey)
    → closeTerminal(wsId, termId)
      → pty_kill(ptyId)                  // kill THAT PTY process group
      → remove terminal descriptor + tab from layout
```

### Gotchas

- **Don't confuse Task Manager totals with macOS Activity Monitor** — the status bar is Quack-scoped only.
- **Multiple `zsh` rows = multiple terminal tabs** (or Tasks-panel runs), not chat sessions. They persist until explicitly closed or idle-swept.
- **Agent bash tools vs user terminals:** a `grep` at 99% CPU under `claude` is killed when you archive/stop that chat; a `grep` under your Terminal 1 `zsh` is only killed when you close Terminal 1.
- **`closeWorkspace` is the nuclear option** — kills every PTY and every agent in that project. Closing a single chat or terminal does not.
- **Kill button** in Task Manager only works on strict descendants; mis-clicks on unrelated OS processes are refused by Rust.
- **Multitask + Esc (fixed 2026-07-10):** background `AIChatPanel` instances stay mounted for parallel agents. Stop **click** was always per-panel; **Esc** used to register on every panel with `turnActive` and cancel all in-flight turns. Now only the visible host's panel listens (`chatVisible`). See `022-chat-composer.md` § Stop.

### Related features

- `014-claude-code-bridge.md` — `kill_process_tree`, `claude_code_kill`, `claude_code_kill_session`
- `026-cursor-cli-bridge.md` — `cursor_code_kill`, `cursor_code_kill_session`
- `009-agent-hub.md` — Mark done / Archive lifecycle (now stops agent subprocess)
- `032-startup-hydration.md` — PTY re-attach after reload (`pty.listSessions`)
