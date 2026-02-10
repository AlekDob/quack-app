---
type: pattern
project: quack-app
created: 2026-01-10
migrated: true
---

# pattern-tauri-file-watcher-events

[2026-01-10] Pattern for event-driven file sync between external processes and Tauri frontend

[2026-01-10] Use case: External process (MCP server, CLI tool) writes to a file, need immediate UI update without polling waste

[2026-01-10] Architecture: Rust Watcher (notify + debouncer) → Tauri Event (app.emit) → Frontend Listener (listen API) → UI Update

[2026-01-10] Rust side: Create WatcherManager struct, use notify::RecommendedWatcher + notify_debouncer_full for 300ms debounce

[2026-01-10] Rust events: app.emit('event-name', payload) where payload is serializable struct

[2026-01-10] Frontend side: useEffect with listen<PayloadType>('event-name', callback) - cleanup with unlisten()

[2026-01-10] Fallback pattern: Keep slow polling (30s) as safety net, events are primary mechanism

[2026-01-10] Benefits: Sub-500ms latency vs 3-5s polling, no CPU/IO waste, scalable to multiple watchers

[2026-01-10] Example implementation: kanban_watcher.rs + useKanbanPolling.ts with kanban:tasks-changed event

[2026-01-10] Registration: Add manager to tauri::Builder.manage() and commands to invoke_handler
