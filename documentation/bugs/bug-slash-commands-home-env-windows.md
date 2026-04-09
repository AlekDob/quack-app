---
type: bug_fix
project: quack-app
created: 2026-04-09
tags: [windows, cross-platform, slash-commands, env-vars]
---

# Fix: slash_commands.rs uses `std::env::var("HOME")` — breaks all slash commands on Windows

## Problem

`src-tauri/src/slash_commands.rs` contains 8 occurrences of `std::env::var("HOME")` that fail silently on Windows. Windows uses `USERPROFILE` env var, not `HOME`, causing:

1. `list_slash_commands()` at line 200 fails to load global commands on Windows (silent failure)
2. `install_bundled_commands()` at line 570 fails to install bundled commands like `/background` on Windows
3. All slash command expansion for user-created global commands breaks on Windows
4. The `/brain` built-in command still works because it's hardcoded in Rust and doesn't rely on `HOME` env var

## Symptom Reported

User on Windows reports "Quack Brain button in chat area produces no effect".

**Primary root cause**: The button called `onSendMessage('/brain')` directly, bypassing `handleSend()` which does slash command expansion. The raw `/brain` text was sent to the SDK, which doesn't recognize it as a native command → no effect. See `bugs/fix-brain-button-bypasses-handleSend.md`.

**Secondary issue (this entry)**: The broader slash command infrastructure also breaks on Windows due to `HOME` env var.

## Root Cause (this entry: HOME env var)

8 instances of `std::env::var("HOME")` in:
- Line 200: `list_slash_commands()` - loading global commands from `~/.claude/commands/`
- Line 570: `install_bundled_commands()` - installing bundled commands
- Plus 6 more occurrences in command expand/create/update/delete functions

These calls fail when `HOME` env var doesn't exist on Windows, and the errors are silently swallowed instead of being propagated.

## Solution

Replace all 8 occurrences with a cross-platform helper function:

```rust
fn get_home_dir() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())
}
```

This pattern:
1. Tries `HOME` first (Linux/macOS preference)
2. Falls back to `USERPROFILE` (Windows)
3. Returns descriptive error if neither exists

## Related

- **diary/2026-02-17**: Documents same fix applied to `rules.rs` (7 occurrences)
- **gotcha-windows-path-separators.md**: Documents Windows path handling issues
- **rules.rs**: Already uses the same `get_home_dir()` pattern correctly
- **agency.rs**: Already uses the same `get_home_dir()` pattern correctly

## Key Insight

Cross-platform Rust code must handle environment variable differences between OSes. Always use fallback chains for OS-specific variables rather than assuming one exists. The `std::env::var()` + `or_else()` pattern is the idiomatic way to handle this in Rust.

## Verification

- [ ] Verify all 8 occurrences are replaced
- [ ] Test `/background` bundled command loads on Windows
- [ ] Test `/brain` still works on all platforms
- [ ] Test global slash command expansion on Windows
- [ ] Run existing tests: `cargo test`
