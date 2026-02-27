# Implementation Tasks: Claude Code Memory Settings

## Phase 1: Rust Backend

- [x] 1.1 Add `get_claude_settings_flag` Tauri command in `hooks.rs`
- [x] 1.2 [P] Add `set_claude_settings_flag` Tauri command in `hooks.rs`
- [x] 1.3 [P] Add `open_claude_memory_folder` Tauri command
- [x] 1.4 Register all 3 new commands in `lib.rs` invoke_handler

## Phase 2: Frontend

- [x] 2.1 Add Memory section to `ClaudeCodeSettings.tsx`
- [x] 2.2 Add Auto Memory toggle row
- [x] 2.3 [P] Add env var override indicator
- [x] 2.4 Add "Open Memory Folder" button row + inline error message

## Phase 3: Validation

- [ ] 3.1 Manual test: toggle flow (requires `cargo build`)
- [ ] 3.2 [P] Manual test: Open Folder (requires `cargo build`)

## Notes

- TypeScript compiles clean (`tsc --noEmit` passes)
- Rust compilation blocked by sandbox (read-only filesystem for cargo cache)
- Phase 3 requires manual testing after building the app outside sandbox
