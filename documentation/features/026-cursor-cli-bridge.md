---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-01
last_verified: 2026-07-01
tags: [cursor-cli, bridge, subprocess, streaming, stream-json, rust, cursor-agent]
---

## Cursor CLI Bridge (spawn / stream / kill / list-models)
**Purpose:** Run `cursor-agent` (or fallback `cursor agent`) as a local child process, stream `stream-json` events to the chat, support `--model` / `--resume` / `--force`, list models dynamically, and kill the process group on Stop — parallel to the Claude Code bridge.
**Stack:** Rust (`cursor_code.rs`), shared TS stream-json parser (`cliStreamJson.ts`), Tauri events `cursor-stream:<id>`.

### Files
| Type | Path | Purpose |
|------|------|---------|
| Bridge | `src-tauri/src/cursor_code.rs` | check, list_models, chat spawn, kill, idle watchdog |
| State | `cursor_code.rs` → `CursorCodeState` | `children` pid map, event buffers |
| Provider | `src/providers/cursorCode.ts` | `ChatProvider` id `cursor-cli`; dynamic `listModels()` |
| Shared | `src/providers/cliStreamJson.ts` | Parse `stream-json` lines (shared with CC path) |
| Shared | `src/providers/cliPrompt.ts` | Flatten messages → stdin prompt |
| Settings UI | `src/components/cursorCodeSettings.tsx` | Force mode toggle (`--force`) |
| Config | `src/modelPrefs.ts` | N/A — uses `lcp.cursorCli.forceMode` in provider |

### Tauri commands
| Command | Role |
|---|---|
| `cursor_code_check` | Resolve binary (`cursor-agent`, `~/.local/bin`, shell, fallback `cursor agent`) |
| `cursor_code_list_models` | Parse `cursor-agent --list-models` → `{ id, display_name, is_default }[]` |
| `cursor_code_chat` | Spawn run; emit `cursor-stream:<id>` `{kind: line\|stderr\|end}` |
| `cursor_code_kill` | `kill_process_tree(pid)` for stream id |

### Data Flow
User message → `cursorCliProvider.chat()` → `cursor_code_chat` (stdin prompt, flags) → stdout lines → `parseCliStreamJsonObject` → `ChatStreamEvent[]` → `AIChatPanel` stream

Model list → `invoke("cursor_code_list_models")` → cache 60s in `cursorCode.ts` → `ModelBrowser` / `ModelPickerPopover` groups

### Key Functions
- `cursorCliProvider.listModels() → ProviderModel[]` — dynamic list + synthetic "default" entry
- `getForceMode() → boolean` — reads `lcp.cursorCli.forceMode` (default `true`)
- `invalidateCursorCliCache() → void` — clear availability + models cache after settings change
- `parseCliStreamJsonObject(line, state) → ChatStreamEvent[]` — shared parser

### State
- `lcp.cursorCli.forceMode`: `boolean` — pass `--force` to skip tool prompts (global)
- `modelsCache` / `availabilityCache`: in-module TTL caches in `cursorCode.ts` (60s / 5s)

### External Dependencies
- Binary: `cursor-agent` on PATH or `cursor agent` subcommand
- Auth: user must `cursor-agent login` (outside Quack)

### Config
- `lcp.cursorCli.forceMode`: force mode default `true`

### Gotchas
- **Dynamic models only:** no hardcoded Cursor model list — UI shows whatever `--list-models` returns plus a "Default" row (no `--model` flag).
- **Parser reuse:** stream-json format matches Claude Code closely; parser lives in `cliStreamJson.ts` — extend there, don't duplicate in `cursorCode.ts`.
- **Smoke test pending:** mission w11 — verify live chat in `npm run tauri dev` after `cursor-agent login`.
- **Parallel doc:** spawn/kill/process-group patterns mirror `014-claude-code-bridge.md`.
