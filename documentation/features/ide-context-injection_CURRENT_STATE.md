# Feature
- Name: IDE Context Injection
- Surfaces:
  - Chat input action bar — IDE chip icon (shows active file/selection; click toggles enabled/disabled)
  - Project Context Panel accordion — displays file, selection range, IDE name
  - Agent system prompt — `<ide_opened_file>`, `<ide_selection>`, `<ide_diagnostics>`, `gitStatus:` blocks

# Entry Points
- UI: `src/components/ChatInput.tsx` — IDE chip rendered when `previewFile || editorSelection || externalIdeContext`; click calls `toggleIdeContext()`
- UI: `src/components/ProjectContextPanel.tsx` — reads same store state, displays context label
- State: `src/stores/fileSystemStore.ts` — `ideContextEnabled`, `externalIdeContext`, `previewFile`, `editorSelection`, `toggleIdeContext()`
- Poll hook: `src/hooks/useExternalIdeContext.ts` — 5 s interval, calls `invoke('get_ide_context', { workspacePath })`; mounted in `App.tsx:717`
- Build: `src/utils/ideContextBuilder.ts :: buildContextPrefix(gitSummary, workspacePath)` — called at send time in App.tsx (lines ~2444, ~3130)
- Backend IPC: `src-tauri/src/ide_integration.rs :: get_ide_context(workspace_path)` — Tauri command; Mac-only guard in callers
- Forwarded to sidecar: `src-tauri/src/claude_cli.rs` — attaches `ideContext` string field on `ClaudeRequest`; sidecar reads it in `stream-claude.js`

# How It Works (as implemented)
1. `App.tsx` mounts `useExternalIdeContext(explorerPath)` which polls `get_ide_context` every 5 s → stores `externalIdeContext` in `fileSystemStore`
2. `get_ide_context` (Rust) scans `~/.claude/ide/*.lock` files, finds lock whose `workspaceFolders` matches the path, verifies PID alive, connects via WebSocket `ws://127.0.0.1:{port}` with `authToken` header
3. Rust sends MCP-style JSON-RPC requests to the IDE extension, parses active file, selection, open tabs, diagnostics → returns `ExternalIdeContext`
4. ChatInput chip reflects state: shows filename / line range; greyed out when `ideContextEnabled = false`
5. On message send, `buildContextPrefix(gitSummary, workingDir)` is called: checks `ideContextEnabled`; on Mac tries external IDE first, falls back to internal (`previewFile` / `editorSelection` from store)
6. Returns XML-formatted string: `<ide_opened_file>…</ide_opened_file>`, `<ide_selection …/>`, `<ide_diagnostics>…</ide_diagnostics>`, `gitStatus: …`
7. String is passed as `ide_context: Option<String>` on `ClaudeRequest` struct → Rust serialises it as `config.ideContext` → Node.js sidecar prepends it to the user message (`effectivePrompt = ideContext + "\n\n" + prompt`)
8. Agent receives context at the top of the human turn; system prompt stays stable across messages → token cache is preserved

# Contracts (minimal, exact)
- Store actions: `toggleIdeContext() -> flip ideContextEnabled bool` | `setExternalIdeContext(ctx|null) -> store` | `setPreviewFile(path|null)` | `setEditorSelection(sel|null)`
- IPC: `invoke('get_ide_context', { workspacePath: string }) -> ExternalIdeContext | null`
- Types:
  ```
  ExternalIdeContext { active_file, selection: IdeSelectionContext|null, open_tabs, diagnostics, ide_name }
  IdeSelectionContext { file_path, language, text, start_line, end_line, start_char, end_char }
  IdeDiagnostic { file, severity, message, line }
  IdeLockFile { port, pid, workspace_folders, ide_name, transport, auth_token }  // ~/.claude/ide/*.lock
  ```
- Persistence: `~/.claude/ide/*.lock` — JSON, written by Claude Code extension; read-only by Quack. `ideContextEnabled` not persisted (defaults `true` per session).

# Relevant Files (only)
Core
- `src/utils/ideContextBuilder.ts` — formats XML prefix, entry for `buildContextPrefix`
- `src-tauri/src/ide_integration.rs` — lock file discovery, WebSocket query, type definitions

UI
- `src/components/ChatInput.tsx` — IDE chip icon, toggle interaction
- `src/components/ProjectContextPanel.tsx` — accordion display of active context

State
- `src/stores/fileSystemStore.ts` — `ideContextEnabled`, `externalIdeContext`, `previewFile`, `editorSelection`

Backend
- `src-tauri/src/claude_cli.rs` — `ClaudeRequest { ide_context }`, serialises to `config.ideContext`

Sidecar
- `src-tauri/node-sdk/stream-claude.js` — reads `config.ideContext`, appends to system prompt under `## IDE Context`

Hooks
- `src/hooks/useExternalIdeContext.ts` — poll loop, mounted once in App.tsx

# Common Change Points
- `src/utils/ideContextBuilder.ts :: formatContextPrefix` — change XML tag format or add new context fields
- `src/utils/ideContextBuilder.ts :: buildContextPrefix` — change priority logic (external vs internal)
- `src-tauri/src/ide_integration.rs :: query_ide_context` — change WebSocket protocol / MCP methods sent to IDE
- `src-tauri/src/ide_integration.rs :: discover_lock_files` — change lock file location or format
- `src/hooks/useExternalIdeContext.ts` — change poll interval (`POLL_INTERVAL_MS = 5000`)
- `src/stores/fileSystemStore.ts` — add/remove context fields or persistence for `ideContextEnabled`
- `src-tauri/node-sdk/stream-claude.js:550` — change how ideContext is injected into system prompt
- `src/components/ChatInput.tsx` — update chip display logic (line ~2269)
