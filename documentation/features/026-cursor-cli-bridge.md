---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-01
last_verified: 2026-07-11
tags: [cursor-cli, bridge, subprocess, streaming, stream-json, rust, cursor-agent, lazy-load, composer, tool-call, images]
---

## Cursor CLI Bridge (spawn / stream / kill / list-models)
**Purpose:** Run `cursor-agent` (or fallback `cursor agent`) as a local child process, stream `stream-json` events to the chat, support `--model` / `--resume` / `--force`, list models dynamically, and kill the process group on Stop — parallel to the Claude Code bridge.
**Stack:** Rust (`cursor_code.rs`), dual TS parsers (`cursorStreamJson.ts` + `cliStreamJson.ts`), Tauri events `cursor-stream:<id>`.

### Files
| Type | Path | Purpose |
|------|------|---------|
| Bridge | `src-tauri/src/cursor_code.rs` | check, list_models, chat spawn, kill, idle watchdog |
| State | `cursor_code.rs` → `CursorCodeState` | `children` pid map, event buffers |
| Provider | `src/providers/cursorCode.ts` | `ChatProvider` id `cursor-cli`; lazy + live `listModels()` |
| Cursor parser | `src/providers/cursorStreamJson.ts` | Composer-native NDJSON (`tool_call`, `thinking`, `result`) |
| Shared parser | `src/providers/cliStreamJson.ts` | Claude-shaped `stream_event` / `assistant` / `user` fallback |
| Shared | `src/providers/cliPrompt.ts` | Flatten messages → stdin prompt |
| Session | `src/providerSession.ts` | Resume id in `providerSessionIds["cursor-cli"]` |
| Settings UI | `src/components/cursorCodeSettings.tsx` | Force mode toggle (`--force`) |
| Reasoning UI | `src/components/ReasoningTurnChip.tsx` | Collapsed thinking recap (056) |
| Images | `src/imageAttach.ts`, `AIChatPanel.tsx` | Path-in-prompt attachments (016) |

### Tauri commands
| Command | Role |
|---|---|
| `cursor_code_check` | Resolve binary (`cursor-agent`, `~/.local/bin`, shell, fallback `cursor agent`) |
| `cursor_code_list_models` | Parse `cursor-agent --list-models` → `{ id, display_name, is_default }[]` |
| `cursor_code_chat` | Spawn run; emit `cursor-stream:<id>` `{kind: line\|stderr\|end}` |
| `cursor_code_kill` | `kill_process_tree(pid)` for stream id |
| `cursor_code_kill_session` | kill by chat-tab `sessionId` (archive / done / close tab) |

### Spawn flags
| Flag | When | Why |
|---|---|---|
| `-p` | always | Headless print mode |
| `--output-format stream-json` | always | NDJSON events to stdout |
| `--stream-partial-output` | always (2026-07-11) | Live text deltas; smoother streaming |
| `--force` | `lcp.cursorCli.forceMode` (default true) | Skip tool permission prompts |
| `--model <id>` | when not "default" | Composer, Codex, etc. |
| `--resume <id>` | when `providerSessionIds["cursor-cli"]` set | Server-side session continuity |

### Data Flow
User message → `cursorCliProvider.chat()` → `cursor_code_chat` (stdin prompt, flags) → stdout lines → **both parsers** → `ChatStreamEvent[]` → `AIChatPanel` stream

**Parser order (per line):**
1. `parseCursorStreamJsonObject` — if it returns events, use those.
2. Else `parseCliStreamJsonObject` — Claude-compatible `stream_event` / `assistant` lines.

**Models (lazy):** mount → `listModels()` returns `[DEFAULT_MODEL]` if cache cold → picker/browser open → `refreshCursorModelsLive()` → `cursor_code_list_models` → cache 60s

### Cursor-native stream-json (Composer 2.5+)
| `type` | `subtype` | Mapped to |
|---|---|---|
| `system` | `init` | `{ kind: "session", id }` via cli parser |
| `thinking` | `delta` | buffers text (heartbeat `content ""`) |
| `thinking` | `completed` | `<think>…</think>` content event |
| `tool_call` | `started` | `{ kind: "tool_call", call }` — name from `grepToolCall` → `grep` |
| `tool_call` | `completed` | `{ kind: "tool_result", tool_use_id, content }` |
| `assistant` | — | prose via cli parser |
| `result` | — | `{ kind: "usage", tokens }` — camelCase `inputTokens` OK |

Tool names: strip trailing `ToolCall` from JSON keys (`readToolCall` → `read`). Lowercase names map through `TOOL_LABELS` in `chatToolRender.tsx`.

### Key Functions
- `parseCursorStreamJsonObject(obj, state) → ChatStreamEvent[]` — Composer-native lines
- `createCursorStreamJsonState()` — thinking buffer + emitted tool ids
- `cursorCliProvider.listModels() → ProviderModel[]` — default row at startup; full list after live refresh
- `refreshCursorModelsLive() → ProviderModel[]` — subprocess `--list-models`; updates cache
- `getForceMode() → boolean` — reads `lcp.cursorCli.forceMode` (default `true`)
- `isAgenticProviderId("cursor-cli") → true` — display-only tool calls in chat

### Image attachments
No CLI multimodal flag — [Cursor headless docs](https://cursor.com/docs/cli/headless) recommend **file paths in the prompt**; the agent reads images via its own tools.

Quack flow (016):
1. User pastes/drops image → `save_image_attachment` → temp path.
2. `AIChatPanel` adds turn context: `Analyze … using your tools: /path/to/img.webp`.
3. Same temp-path pattern as Claude Code Read-tool hints.

`ProviderModel.supportsVision: true` on all Cursor CLI models (tool-read path, not native vision API).

### State
- `lcp.cursorCli.forceMode`: `boolean` — pass `--force` to skip tool prompts (global)
- `modelsCache` / `availabilityCache`: in-module TTL caches in `cursorCode.ts` (60s)
- `providerSessionIds["cursor-cli"]`: resume session id (see `044-provider-session-bridge.md`)

### External Dependencies
- Binary: `cursor-agent` on PATH or `cursor agent` subcommand
- Auth: user must `cursor-agent login` (outside Quack)

### Gotchas
- **Two stream formats:** Composer uses native `tool_call`/`thinking`, not Claude `stream_event`. Extend **`cursorStreamJson.ts`**, not only `cliStreamJson.ts`.
- **Doubled reply (`--stream-partial-output`):** Cursor emits each token as its own `assistant` message, then a FINAL `assistant` message repeating the whole text. The Claude-shaped anti-dup guard (`currentMsgGotDeltas`) never fires here (no `stream_event`/`text_delta`), so the reply rendered twice. Fix: `cliStreamJson.ts` accumulates streamed assistant text in `partialAssistantBuf` and drops the trailing full-text snapshot (reset on `message_start`/`result`).
- **Lazy model list:** defer `--list-models` to picker/browser (025).
- **Effort tiers in catalog:** Cursor exposes Low/Medium/High/xHigh/Max/Fast as **separate model ids** in `--list-models` (e.g. `Opus 4.8 1M Extra High`). Quack has **no** `EffortPopover` for Cursor — pick the tier as the model. Claude Code uses a separate effort knob + `--effort` (`022`, `059`).
- **Lifecycle kill:** `cursor_code_kill_session` — see `046-process-cleanup.md`.
- **Images ≠ multimodal:** path-in-prompt only; model must invoke read/view tools itself.
