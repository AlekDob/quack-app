---
type: pattern
created: 2026-02-11
---

# Teammate Stream Drill-Down

## Overview

When a Claude Agent SDK teammate is working, clicking its TeammateWidget opens a dedicated tab showing the teammate's real-time activity stream. Full visibility into tool calls, text output, thinking blocks, and session completion.

## Architecture

```
JSONL File (~/.claude/projects/{project}/{sessionId}.jsonl)
  -> notify crate (200ms debounce)
Rust: TeammateSessionWatcher (teammate_watcher.rs)
  -> app.emit("teammate-event:{sessionId}", serde_json::Value)
Frontend: TeammateStreamTab.tsx (listen API)
  -> useState append -> EventCard renders
```

## Key Design Decisions

1. **Watch JSONL files, not SDK stdout** -- Teammate sessions are internal SDK subprocesses. Events are NOT emitted to parent's stdout. SDK writes session logs as JSONL.

2. **Parse as serde_json::Value** -- JSONL includes extra fields not in ClaudeEvent enum. Using Value avoids deserialization failures.

3. **Byte position tracking** -- On file change, seek to last known offset. Avoids re-parsing entire file.

4. **Simplified rendering** -- Uses own lightweight EventCard instead of StreamMessage (too many dependencies).

## Files

| File | Role |
|------|------|
| `src-tauri/src/teammate_watcher.rs` | Rust file watcher + Tauri commands |
| `src/components/TeammateStreamTab.tsx` | Dedicated tab UI |
| `src/components/TeammateWidget.tsx` | Clickable widget |
| `src/App.tsx` | handleTeammateDrillDown + tab renderer |

## Gotchas

- JSONL file may not exist immediately when teammate starts
- `emit_existing_events` emits individual events (not batched)
- File watcher watches parent directory (NonRecursive), filters by session_id
