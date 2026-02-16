# Bug: WebKit WebContent Memory Leaks Causing High CPU/RAM

## Symptom
`com.apple.WebKit.WebContent` process consumes 1+ GB RAM and 30-50% CPU after extended Quack usage. When force-killed, Quack shows a white screen (expected: Tauri shell survives but WebView dies).

## Root Cause
Multiple memory leaks in the React frontend and Rust backend compound over time:

### CRITICAL Leaks (Fixed)
1. **Events array unbounded growth** (`src/hooks/useClaudeChat.ts:332`) — The `events[]` array grew without limit during each stream. Every event (~500-1000 bytes) was pushed and then spread via `[...events]` into React state on every update. Long sessions (1000+ events) could reach 50-100 MB per session.
   - **Fix**: Added `MAX_EVENTS_PER_STREAM = 500` cap with `splice()` trimming.

2. **seenEventIds delayed cleanup** (`src/services/claudeSDK.ts:103`) — Global Map tracking event deduplication used a 5-second `setTimeout` for cleanup, creating race windows where orphaned Sets accumulated (~2-5 MB).
   - **Fix**: Immediate `delete()` on stream end instead of delayed cleanup.

### HIGH Leaks (Fixed)
3. **taskToolToKanbanMap never cleared** (`src/hooks/useClaudeChat.ts:19`) — Global Map mapping tool_use_ids to Kanban task IDs. Only deleted on successful task completion; failed/abandoned tasks accumulated forever.
   - **Fix**: Clear on `clearConversation()` + safety valve at 100 entries.

4. **Nested timer leak** (`src/components/RepositoryGroup.tsx:479,2520`) — `setInterval` created inner `setTimeout` calls for tooltip show/hide. The `clearInterval` cleanup did NOT cancel pending `setTimeout`s, causing state updates after unmount.
   - **Fix**: Track inner timeouts and cancel in cleanup function.

5. **Rust stderr Vec unbounded** (`src-tauri/src/claude_cli.rs:1682`) — `Vec<String>` collected ALL stderr lines from Node.js SDK. Sessions >30min accumulated 10k+ lines (1-2 MB per session).
   - **Fix**: Circular buffer capped at 200 lines.

6. **MCP stderr reader untracked** (`src-tauri/src/mcp.rs:561`) — Spawned `tokio::spawn` task reading MCP server stderr without cleanup logging. Task exits naturally when process dies, but was invisible.
   - **Fix**: Added exit logging for observability.

### MEDIUM Leaks (Not yet fixed — monitor)
- `usageSessions[]` in ChatContext (append-only, no cap)
- `tabsByTerminal` Map in uiStore (entries never removed on terminal close)
- `explorerTree` cache in fileSystemStore (no LRU eviction)
- `teammateStatus` Map in teamStore (only cleared on `clearTeam()`)

## Memory Impact Estimates
| Scenario | Estimated RAM Leak |
|----------|-------------------|
| Normal session (1-2h, 3-5 agents) | ~50-100 MB |
| Long session (8h, agents active) | ~200-500 MB |
| Intensive session (24h, multi-agent) | 500 MB - 1 GB+ |

## Prevention Patterns
1. Always cap arrays/Maps with `MAX_SIZE` constants
2. Never use `setTimeout` inside `setInterval` without tracking
3. Clean global Maps on both success AND failure paths
4. Use immediate cleanup in `finally` blocks, not delayed `setTimeout`
5. Cap Rust `Vec` buffers for long-running I/O operations

## Related Commits
- `e38f863` — fix(memory): prevent WebView memory leaks causing high CPU/RAM usage

## Date
2026-02-14
