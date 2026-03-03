---
type: gotcha
project: quack-app
created: 2026-03-02
last_verified: 2026-03-02
tags: [terminal, shell, PATH, environment, macOS, Finder]
---
# GUI-Launched App Has Minimal Shell Environment

## The Problem
When Quack is launched from macOS Finder (not from a terminal), the process inherits a minimal environment. Shell profiles (.zshrc, .bash_profile) are NOT sourced, so PATH from NVM, Volta, Homebrew, etc. is missing. Commands like `idea`, `ng`, or any tool installed via npm global / Homebrew won't be found.

## Root Cause
macOS GUI apps don't inherit the user's login-shell environment. The embedded PTY was spawning shells non-interactively (no `-l` flag), and `execute_command()` ran programs directly via `Command::new()` with only the minimal process PATH.

## Solution
- `shell_env.rs` captures the full login-shell environment at first access via `$SHELL -l -c 'env -0'` (null-separated, 5s timeout, cached in OnceLock)
- `terminal.rs` spawns PTY with `-l` flag and injects login PATH
- `execute_command()` uses login PATH for direct command execution
- `claude_cli.rs` uses login PATH as base for SDK daemon
- Fallback: `get_extended_path()` provides hardcoded common paths if login capture fails

## Key Files
- `src-tauri/src/shell_env.rs` — centralized environment capture
- `src-tauri/src/terminal.rs` — PTY spawn and command execution
- `src-tauri/src/claude_cli.rs` — SDK daemon PATH
- `src-tauri/src/prerequisites.rs` — delegates to shell_env for extended PATH
