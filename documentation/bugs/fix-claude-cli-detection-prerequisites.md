---
type: bug_fix
created: 2026-02-09
tags: [prerequisites, onboarding, claude-cli, windows, detection, npm, path]
---

# Bug Fix: Claude CLI Not Detected in Prerequisites Check

## Problem

Prerequisites Check onboarding step was not detecting Claude CLI even when installed and running on the system. Git and Node.js were correctly detected, but Claude Code CLI showed as not found.

**Error observed**: "Failed to install Claude CLI. Please try installing manually."

## Root Cause

The check was only looking for Claude CLI installed via `npm install -g @anthropic-ai/claude-code`, but:

1. **npm global directory doesn't exist**: On Windows, `C:\Users\{user}\AppData\Roaming\npm` may not exist until first global package install
2. **Alternative installation methods**: Claude CLI can be installed locally (e.g., `~/.local/bin/claude`) via other installers, not just npm

The `npm list -g @anthropic-ai/claude-code --depth=0` command was failing with:
```
ENOENT: no such file or directory, lstat 'C:\Users\dev\AppData\Roaming\npm'
```

## Solution

Changed detection strategy from **npm-only** to **dual check**:

### File: `src-tauri/src/prerequisites.rs`

**Before** (npm-only check):
```rust
fn check_claude_cli() -> Result<PrerequisiteStatus> {
    let output = Command::new("npm")
        .args(["list", "-g", "@anthropic-ai/claude-code", "--depth=0"])
        .output();

    match output {
        Ok(output) if output.status.success() => { /* ... */ }
        _ => { /* not installed */ }
    }
}
```

**After** (dual check: PATH command first, npm fallback):
```rust
fn check_claude_cli() -> Result<PrerequisiteStatus> {
    // 1. PRIMARY CHECK: Try claude command in PATH
    let output = Command::new("claude")
        .arg("--version")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            // Parse version from "claude --version" output
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = version_str.trim().split_whitespace().last();

            return Ok(PrerequisiteStatus {
                name: "Claude Code CLI".to_string(),
                installed: true,
                version: Some(version),
                download_url: None,
            });
        }
        _ => {
            // 2. FALLBACK CHECK: Try npm list -g
            let npm_output = Command::new("npm")
                .args(["list", "-g", "@anthropic-ai/claude-code", "--depth=0"])
                .output();

            match npm_output {
                Ok(npm_output) if npm_output.status.success() => {
                    let stdout = String::from_utf8_lossy(&npm_output.stdout);

                    // Verify package is actually in output
                    if stdout.contains("@anthropic-ai/claude-code") {
                        // Parse version from npm list output
                        return Ok(PrerequisiteStatus { installed: true, ... });
                    }
                }
                _ => {}
            }

            // Not found via command or npm
            Ok(PrerequisiteStatus {
                name: "Claude Code CLI".to_string(),
                installed: false,
                version: None,
                download_url: None,
            })
        }
    }
}
```

## Why This Works

1. **Primary check (`claude --version`)**: Works for ALL installation methods that add `claude` to PATH:
   - Local installations (`~/.local/bin/claude`)
   - npm global installations (when npm prefix is in PATH)
   - System-wide installations
   - Windows installers

2. **Fallback check (`npm list -g`)**: Only used if command check fails:
   - Catches npm global installs not yet in PATH
   - Handles edge cases where npm is configured differently

3. **Version parsing**:
   - Primary: Parse `claude --version` output (last token)
   - Fallback: Parse npm list output (after last `@` symbol)

## Edge Cases Covered

1. Claude installed via npm global (PATH configured)
2. Claude installed locally (`~/.local/bin/`)
3. Claude installed but npm directory doesn't exist yet
4. npm global directory exists but Claude not installed
5. Neither command nor npm installation found

## Related Files

- `src-tauri/src/prerequisites.rs` - Rust check logic (FIXED)
- `src/stores/prerequisitesStore.ts` - Frontend state management
- `src/components/settings/PrerequisitesCheck.tsx` - UI component

## Cross-Platform

- **Windows**: `where claude` → `.local/bin/claude` detected
- **macOS**: `which claude` → works for all install methods
- **Linux**: Same as macOS

## Lessons Learned

1. **Don't assume npm for global CLIs**: Many tools support multiple installation methods
2. **Check the actual command first**: If the tool is meant to be a CLI, check if the command works
3. **npm list -g can fail**: The global npm directory may not exist on fresh Node.js installs
4. **Fallback strategy is key**: Support multiple detection methods for robustness
