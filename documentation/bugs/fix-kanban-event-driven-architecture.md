---
type: bug
created: 2026-01-10
tags: [kanban, event-driven, file-watcher, mcp, tauri]
---

# kanban-event-driven-fix

FIXED: Kanban tasks created via MCP didn't appear in UI until polling cycle (3-5s delay)

Root cause: MCP server wrote to file via fs.writeFileSync() while Frontend used Tauri Store with cache - race condition between two storage systems

Solution: Event-driven architecture - Rust file watcher (kanban_watcher.rs) emits kanban:tasks-changed events when file changes

Frontend: useKanbanPolling now listens to events for immediate updates + 30s fallback polling (not 3s!)

Files created: src-tauri/src/kanban_watcher.rs (246 LOC), src/components/KanbanWatcherInitializer.tsx

Files modified: src-tauri/src/lib.rs (+5 lines), src/hooks/useKanbanPolling.ts (event listener + 30s fallback), src/App.tsx (+2 lines)

Pattern: Similar to Brain VaultWatcherManager - uses notify + notify-debouncer-full (300ms debounce)

Event flow: MCP writes → File changes → Rust watcher emits event → Frontend reloads → UI updates < 500ms

Acceptance criteria: Task created via MCP appears IMMEDIATELY (< 500ms) in Kanban UI, no continuous polling waste
