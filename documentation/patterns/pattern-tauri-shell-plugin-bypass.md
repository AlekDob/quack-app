---
type: pattern
created: 2026-01-11
---

# Tauri Shell Plugin Bypass

Tauri v2 shell plugin has strict regex validation in capabilities that cannot be changed at runtime (compiled into binary).

**Solution**: Create custom Rust commands that use `std::process::Command` directly.

- `reveal_in_finder`: Uses `open -R` on macOS to highlight file in Finder
- `open_external_url`: Whitelist-based URL scheme opener (obsidian://, vscode://, https://)
- `open_folder_in_ide`: Uses `open -a AppName path` instead of CLI commands

**Files**: `src-tauri/src/reveal.rs`, `src-tauri/src/ide_integration.rs`

**Registration**: `src-tauri/src/lib.rs` in `invoke_handler`
