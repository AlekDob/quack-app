---
type: bug_fix
project: quack-app
created: 2026-02-10
tags: [prerequisites, onboarding, macos, path, homebrew, nvm, volta, fnm, asdf, mise, environment]
---

# Bug Fix: macOS .app Bundle PATH Restriction Hides Developer Tools

## Problem

When Quack runs as a `.app` bundle on macOS, it doesn't inherit the user's shell PATH. The default PATH is extremely restricted:

```
/usr/bin:/bin:/usr/sbin:/sbin
```

This means tools installed via **Homebrew** (`/opt/homebrew/bin`), **nvm** (`~/.nvm/versions/node/...`), **volta**, **fnm**, **asdf**, **mise**, etc. are completely invisible to the app.

**Symptoms:**
- Git ✓ was found (Xcode CLI Tools at `/usr/bin/git`)
- Node.js ✗ NOT found (Homebrew, nvm, volta, fnm, asdf, mise, pnpm not in restricted PATH)
- Claude CLI ✗ had TWO failure modes:
  1. Couldn't find `node` executable (Claude CLI is a Node.js wrapper)
  2. Fallback checks also used restricted PATH

**Prerequisites Check showed:**
```
Git: ✓ installed
Node.js: ✗ not found
Claude CLI: ✗ not found
```

Even though all three were actually installed on the system.

## Root Cause

macOS application bundles run with a minimal default PATH set by the system, not inherited from the user's shell profile (`.zshrc`, `.bash_profile`, etc.). The shell environment variables are shell-specific and don't propagate to GUI apps launched via the Finder or dock.

This is a **macOS-specific limitation** - doesn't affect Windows or Linux GUI apps built with Tauri.

## Solution

### 1. Extended PATH Helper (Rust)

Created `get_extended_path()` function that builds a comprehensive PATH with common tool locations:

```rust
fn get_extended_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let paths = vec![
        "/opt/homebrew/bin",           // Homebrew (Apple Silicon)
        "/usr/local/bin",              // Homebrew (Intel, legacy)
        &format!("{}/.nvm/versions/node/*/bin", home),  // nvm
        &format!("{}/.volta/bin", home),                // Volta
        &format!("{}/.fnm/node-versions/*/bin", home),  // fnm
        &format!("{}/.asdf/shims", home),               // asdf
        &format!("{}/.local/bin", home),                // pnpm, local tools
        &format!("{}/bin", home),                       // ~/bin
    ];

    let mut extended_path = paths.join(":");

    // Append original PATH to preserve system paths
    if let Ok(original) = std::env::var("PATH") {
        extended_path.push(':');
        extended_path.push_str(&original);
    }

    extended_path
}
```

### 2. Command Builder with Extended PATH

Created `command_with_path()` helper that wraps Command creation with the extended PATH:

```rust
fn command_with_path(program: &str) -> Command {
    let mut cmd = Command::new(program);
    cmd.env("PATH", get_extended_path());
    cmd
}
```

### 3. Node.js Finder

Added `find_node_executable()` that searches common paths similar to `find_claude_executable()`:

```rust
fn find_node_executable() -> Option<PathBuf> {
    let common_paths = vec![
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        // ... nvm, volta, fnm, asdf, pnpm paths
    ];

    for path in common_paths {
        if Path::new(path).exists() {
            return Some(PathBuf::from(path));
        }
    }

    None
}
```

### 4. Updated All Tool Checks

Modified all prerequisite checks to use extended PATH:

```rust
// Before:
let output = Command::new("git").arg("--version").output();

// After:
let output = command_with_path("git").arg("--version").output();
```

Applied to: `git`, `node`, `claude`, `npm`

### 5. Graceful Degradation

Made prerequisites check **skippable**:
- When any prerequisite is missing, "Skip" button replaces "Continue"
- Users can proceed with app if they understand the limitations
- Prerequisites can still be checked later from Settings

### 6. Installation Guidance

Replaced "Download" buttons with terminal command hints:

```
Git:    xcode-select --install
Node:   brew install node
Claude: npm install -g @anthropic-ai/claude-code
```

Users copy the command and run it in their terminal (which DOES have their full PATH).

## Implementation Details

### Files Modified

1. **`src-tauri/src/prerequisites.rs`**
   - Added `get_extended_path()` function
   - Added `command_with_path()` helper
   - Added `find_node_executable()` for fallback
   - Updated `check_git()`, `check_node()`, `check_claude_cli()` to use extended PATH

2. **`src/stores/prerequisitesStore.ts`**
   - Added `skippable: boolean` to prerequisite state
   - Updated logic to allow skipping when prerequisites missing

3. **`src/components/settings/PrerequisitesCheck.tsx`**
   - Show "Skip" button instead of "Continue" when prerequisites missing
   - Display terminal command hints instead of download links
   - Added test mode UI indicators

4. **`src/components/settings/PrerequisitesCheck.css`**
   - Styling for command hints (monospace, copyable)

5. **`package.json`**
   - Added test mode npm scripts

## Test Modes

Added three test modes for verification:

### 1. `npm run test:dev` - Real Prerequisites Check
Shows the dialog with ACTUAL prerequisite checks on your system.

```bash
npm run test:dev
# Opens Quack with Prerequisites Check dialog
# Shows real status of git, node, claude on your Mac
```

### 2. `npm run test:install:dev` - Simulated Missing Prerequisites
Shows the dialog with all prerequisites MOCKED as missing (for testing install flow).

```bash
npm run testinstall:dev
# Opens Quack with Prerequisites Check dialog
# All prerequisites show as NOT installed (simulation only)
# Tests the "Skip" button and command hints
```

### 3. Environment Variables

- `VITE_TEST_MODE=1` → Forces dialog to show (used by both test commands)
- `VITE_TEST_PREREQUISITES=1` → Simulates all missing (only with testinstall:dev)

## Testing Results

### Before Fix (macOS)

```bash
# User has all tools installed via Homebrew + nvm
$ node --version
v20.11.0

$ claude --version
@anthropic-ai/claude-code/0.71.0

$ git --version
git version 2.45.0

# But app says:
# Git: ✓ installed
# Node.js: ✗ NOT installed
# Claude CLI: ✗ NOT installed
```

### After Fix (macOS)

```bash
# Same user, same tools
# Now app correctly shows:
# Git: ✓ installed
# Node.js: ✓ installed
# Claude CLI: ✓ installed
```

## Edge Cases Covered

- ✅ Homebrew on Apple Silicon (`/opt/homebrew/bin`)
- ✅ Homebrew on Intel (`/usr/local/bin`)
- ✅ nvm with multiple Node versions
- ✅ volta for Node management
- ✅ fnm (Fast Node Manager)
- ✅ asdf (polyglot version manager)
- ✅ mise (modern version manager)
- ✅ Local installations (`~/.local/bin`, `~/bin`)
- ✅ Users who skip prerequisites
- ✅ PATH expansion with glob patterns

## Why This Works

1. **Extended PATH covers all common installations**: We search in order of popularity
2. **Fallback to glob expansion**: Handles versioned tool paths (e.g., `~/.nvm/versions/node/v20.11.0/bin`)
3. **Preserves original PATH**: We append the system PATH so system tools still work
4. **Clear user guidance**: Instead of failing silently, we tell users exactly how to install
5. **Skippable for power users**: Users who understand the limitations can proceed anyway

## Cross-Platform Status

- ✅ **macOS**: FIXED (primary issue)
- ✅ **Windows**: Not affected (GUI apps inherit user PATH correctly)
- ✅ **Linux**: Not affected (same as Windows)

## Related Documentation

- Pattern: `~/.quack/brain/projects/quack-app/patterns/prerequisites-check-onboarding.md`
- Previous bug: `~/.quack/brain/bugs/fix-claude-cli-detection-prerequisites.md` (related but different)

## Lessons Learned

1. **macOS GUI apps don't inherit shell PATH**: This is a fundamental OS limitation
2. **Homebrew paths vary by CPU architecture**: Apple Silicon vs Intel
3. **Tool managers are ubiquitous**: nvm, volta, fnm, asdf, mise all need consideration
4. **User education matters**: Show users HOW to install, not just that tools are missing
5. **Test modes are essential**: Can't test this without mocking missing prerequisites

## Version

- **Quack**: 0.5.22
- **Fixed**: 2026-02-10

## What's Next

- 🔲 Monitor Discord for macOS users hitting this issue
- 🔲 Consider auto-detecting and suggesting user's actual installation method
- 🔲 Possibly add "Open Terminal Here" button that inherits full user PATH
