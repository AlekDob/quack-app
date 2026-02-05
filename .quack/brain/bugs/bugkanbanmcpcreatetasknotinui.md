---
type: bug
project: quack-app
created: 2026-01-10
migrated: true
---

# bug_kanban_mcp_create_task_not_in_ui

[2026-01-10] Bug: kanban_create_task succeeds (returns success message) but task doesn't appear in Kanban UI. Analysis complete - CRITICAL RACE CONDITION FOUND in file sync mechanisms.

Root cause: Two different storage systems operate independently without synchronization. MCP server writes directly to JSON file, while React app uses Tauri Store with its own file locking/cache layer.

Storage Path Conflict: MCP server uses plain fs write to ~/Library/Application Support/com.quack.terminal/quack-kanban-tasks.json while React uses Tauri Store.load() which wraps the same file.

Race Condition Pattern: 1) MCP writes task to file, 2) MCP reads back & verifies (line 362-364), 3) React polls 5 seconds later, 4) Tauri Store.reload() has timing gap, 5) Frontend shows empty list.

Polling Mechanism Issue: useKanbanPolling runs every 5 seconds but window.hidden check + isPollingRef prevents rapid updates. When called during store.reload(), timing race can occur.

File Synchronization Gap: Tauri Store.reload() (line 69 in kanbanStorage.ts) tries to reload but there's no guarantee of file system sync between MCP write and React reload on same file.

Store.reload() is called in frontend but it doesn't force a true disk read - it just invalidates Tauri's internal cache. If MCP writes between store creation and reload, the file data may be inconsistent.

Impact: High - users see task created successfully but UI is blank. They assume task failed and try creating again, leading to duplicate task creation or confusion.

Frequency: Intermittent because it depends on timing of polling interval vs MCP write speed and Tauri Store cache invalidation.
