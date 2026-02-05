---
type: bug
project: quack-app
created: 2026-01-10
migrated: true
---

# kanban-event-driven-fix

[2026-01-10] FIXED: Kanban tasks created via MCP didn't appear in UI until polling cycle (3-5s delay)

[2026-01-10] Root cause: MCP server wrote to file via fs.writeFileSync() while Frontend used Tauri Store with cache - race condition between two storage systems

[2026-01-10] Solution: Event-driven architecture - Rust file watcher (kanban_watcher.rs) emits kanban:tasks-changed events when file changes

[2026-01-10] Frontend: useKanbanPolling now listens to events for immediate updates + 30s fallback polling (not 3s!)

[2026-01-10] Files created: src-tauri/src/kanban_watcher.rs (246 LOC), src/components/KanbanWatcherInitializer.tsx

[2026-01-10] Files modified: src-tauri/src/lib.rs (+5 lines), src/hooks/useKanbanPolling.ts (event listener + 30s fallback), src/App.tsx (+2 lines)

[2026-01-10] Pattern: Similar to Brain VaultWatcherManager - uses notify + notify-debouncer-full (300ms debounce)

[2026-01-10] Event flow: MCP writes → File changes → Rust watcher emits event → Frontend reloads → UI updates < 500ms

[2026-01-10] Acceptance criteria: Task created via MCP appears IMMEDIATELY (< 500ms) in Kanban UI, no continuous polling waste
