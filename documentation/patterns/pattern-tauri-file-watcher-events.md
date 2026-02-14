---
type: pattern
created: 2026-01-10
---

# Tauri File Watcher Events

Pattern for event-driven file sync between external processes and Tauri frontend.

**Use case**: External process (MCP server, CLI tool) writes to a file, need immediate UI update without polling waste.

**Architecture**: Rust Watcher (notify + debouncer) -> Tauri Event (app.emit) -> Frontend Listener (listen API) -> UI Update

**Rust side**: Create WatcherManager struct, use `notify::RecommendedWatcher` + `notify_debouncer_full` for 300ms debounce.

**Frontend side**: `useEffect` with `listen<PayloadType>('event-name', callback)` -- cleanup with `unlisten()`.

**Fallback pattern**: Keep slow polling (30s) as safety net, events are primary mechanism.

**Benefits**: Sub-500ms latency vs 3-5s polling, no CPU/IO waste, scalable to multiple watchers.

**Registration**: Add manager to `tauri::Builder.manage()` and commands to `invoke_handler`.
