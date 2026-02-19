---
type: gotcha
project: quack-app
created: 2026-02-19
last_verified: 2026-02-19
tags: [ide, cli, eval, paths, spaces, macos, cursor, vscode, windsurf]
---

# Gotcha: VS Code CLI Wrapper `eval` Breaks Paths with Spaces

## Problem

VS Code-family CLIs (Cursor, VS Code, Windsurf, Athas) on macOS use bash wrapper scripts that internally call:

```bash
CURSOR_CLI="ELECTRON_RUN_AS_NODE=1 \"$ELECTRON\" \"$CLI\""
eval "$CURSOR_CLI" "$@"
```

The `eval` concatenates all arguments into a single string and re-parses them. This means **any path argument containing spaces gets split** into multiple arguments:

```
/Users/user/Obsidian Vault/6 - Projects/file.md
→ becomes: /Users/user/Obsidian  Vault/6  -  Projects/file.md (5 separate args)
```

## Symptoms

- Clicking "Open in IDE" from EditSummaryBar opens **multiple tabs** in Cursor instead of one
- The number of tabs roughly matches the number of space-separated segments in the path
- Happens with any file in a directory containing spaces (e.g., Obsidian Vault, user home dirs)

## Root Cause

`eval` in bash re-parses its arguments. Even though `"$@"` preserves word boundaries when expanded by bash, `eval` joins them into one string first, then re-tokenizes. The double-quoted paths in `$CURSOR_CLI` survive, but the user-provided paths in `"$@"` lose their boundaries.

## Fix

Bypass the CLI wrapper script entirely. Resolve the Electron binary and `cli.js` directly from the `.app` bundle:

```rust
Command::new(electron_path)         // e.g., /Applications/Cursor.app/Contents/MacOS/Cursor
    .env("ELECTRON_RUN_AS_NODE", "1")
    .arg(cli_js_path)               // e.g., .../Resources/app/out/cli.js
    .args(user_args)                // passed directly, no shell involved
    .spawn()
```

This completely avoids the bash `eval` and preserves all path arguments exactly.

## Key Insight

Using `sh -c` with `shell_escape` (single-quoting) does NOT help because `sh -c` removes the quotes before passing args to the `cursor` script, and then `eval` re-parses them without quotes.
