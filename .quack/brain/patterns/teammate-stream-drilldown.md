---
type: pattern
project: quack-app
created: 2026-02-11
---

# Teammate Stream Drill-Down

## Overview

When a Claude Agent SDK teammate is working, clicking its TeammateWidget opens a dedicated tab showing the teammate's real-time activity stream. This gives full visibility into what each teammate is doing — tool calls, text output, thinking blocks, and session completion.

## Architecture

```
JSONL File (~/.claude/projects/{project}/{sessionId}.jsonl)
    ↓ notify crate (200ms debounce)
Rust: TeammateSessionWatcher (teammate_watcher.rs)
    ↓ app.emit("teammate-event:{sessionId}", serde_json::Value)
Frontend: TeammateStreamTab.tsx (listen API)
    ↓ useState append
EventCard renders: text | tool_use | tool_result | thinking | result
```

## Key Design Decisions

1. **Watch JSONL files, not SDK stdout** — Teammate sessions are internal SDK subprocesses. Their events are NOT emitted to the parent's stdout. The SDK writes session logs as JSONL files, which we watch instead.

2. **Parse as serde_json::Value** — The JSONL format includes extra fields (parentUuid, isSidechain, cwd, version, gitBranch, timestamp) not present in the `ClaudeEvent` Rust enum. Using `Value` avoids deserialization failures.

3. **Byte position tracking** — On file change, seek to last known byte offset and read only new lines. Avoids re-parsing the entire file on each event.

4. **Simplified rendering** — TeammateStreamTab uses its own lightweight EventCard component instead of reusing StreamMessage (which has too many dependencies and would create circular imports).

## Files

| File | Role |
|------|------|
| `src-tauri/src/teammate_watcher.rs` | Rust file watcher + Tauri commands |
| `src/components/TeammateStreamTab.tsx` | Dedicated tab UI for teammate stream |
| `src/components/TeammateWidget.tsx` | Clickable widget (sessionId + onDrillDown props) |
| `src/components/StreamMessage.tsx` | Passes onTeammateDrillDown to widgets |
| `src/App.tsx` | handleTeammateDrillDown + tab content renderer |

## Prop Drilling Chain

```
App.tsx (handleTeammateDrillDown)
  → ChatView (onTeammateDrillDown)
    → MessageList (onTeammateDrillDown)
      → ChatMessage (onTeammateDrillDown)
        → StreamMessage (onTeammateDrillDown)
          → TeammateWidget (onDrillDown)
```

## Tauri Commands

- `start_teammate_watcher(session_id, agent_name)` — Find JSONL, emit existing events, start file watcher
- `stop_teammate_watcher(session_id)` — Remove watcher and position tracking
- `read_teammate_session(session_id)` — Read all events from JSONL (initial load)

## Session ID Sources

- **Agent events** (agent start/stop): `ClaudeAgentEvent.session_id` — available directly on the event
- **Task tool events** (teammate spawned in chat): `teamStore.teammateStatus.get(agentName)?.sessionId` — looked up from the Zustand store

## Tab System Integration

- Tab type: `'teammate-stream'`
- Tab ID: `teammate-{sessionId}`
- Tab fields: `teammateSessionId`, `teammateName`
- Closable, with teammate's color applied
- Icon: eye/monitor SVG

## Gotchas

- JSONL file may not exist immediately when teammate starts — the SDK creates it after first write
- `emit_existing_events` in Rust emits individual events (not batched) — frontend accumulates via `listen`
- The `read_teammate_session` command is for initial hydration; live updates come through the watcher
- File watcher watches the parent directory (NonRecursive), then filters by session_id in filename
