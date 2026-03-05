---
name: claude-code-settings
description: Optimize Claude Code project settings to reduce token waste and configure permissions. This skill should be used when an agent needs to exclude unnecessary directories from scanning, configure Read/Edit/Bash/MCP permission rules, or audit `.claude/settings.json` for token efficiency. Triggers on settings optimization, folder exclusion, permission configuration, or context window reduction tasks.
---

# Claude Code Settings Optimizer

## Overview

This skill provides a complete reference and workflow for configuring `.claude/settings.json` to minimize token waste, exclude irrelevant directories from AI agent scanning, and set up permission rules. It covers the full settings hierarchy, permission syntax, and best practices for lean project configuration.

## When to Use

- Setting up a new project for Claude Code
- Auditing an existing project's settings for token waste
- Excluding build artifacts, binary assets, or vendor directories
- Configuring permission deny rules to prevent accidental reads of large/irrelevant files
- Understanding the settings file hierarchy and precedence

## Workflow

### Step 1: Analyze Project Structure

Scan the project to identify directories that should be excluded from AI agent scanning:

```
# Identify large/irrelevant directories
Glob pattern: **/* to understand project structure
Bash: du -sh */ | sort -rh | head -20
Bash: find . -name "*.png" -o -name "*.jpg" -o -name "*.mp4" -o -name "*.woff2" | head -30
```

**Common exclusion candidates:**
- Build output: `dist/`, `build/`, `out/`, `.next/`, `target/`
- Binary assets: `images/`, `video/`, `fonts/`, `public/images/`
- Dependencies: `node_modules/` (already excluded by default)
- IDE/editor: `.idea/`, `.vscode/settings/`
- VCS artifacts: `.worktrees/`, `.git/` (already excluded)
- Package caches: `.cache/`, `.turbo/`, `.parcel-cache/`
- Generated files: `*.lock` (large lock files), `coverage/`, `.nyc_output/`
- Platform-specific: `Pods/` (iOS), `target/` (Rust/Cargo), `__pycache__/`
- Obsidian/notes: `.obsidian/`, `.smart-connections/`

### Step 2: Read Current Settings

Check for existing settings at all 3 levels:

1. **Project**: `.claude/settings.json` (checked into repo, shared with team)
2. **User-project**: `~/.claude/projects/<path-hash>/settings.json` (personal overrides)
3. **User global**: `~/.claude/settings.json` (applies to all projects)

Settings merge with this precedence: project < user-project < user-global.

### Step 3: Configure Permission Deny Rules

Edit `.claude/settings.json` and add `permissions.deny` rules for directories that should never be read by AI agents.

**Permission Rule Syntax:**

```
Tool(glob_pattern)
```

Supported tools:
| Tool | What it controls |
|------|-----------------|
| `Read` | File reading (Read tool, cat, head, tail) |
| `Edit` | File editing (Edit tool, sed, awk) |
| `Write` | File creation (Write tool) |
| `Bash` | Shell command execution |
| `WebFetch` | URL fetching |
| `mcp__<server>__<tool>` | Specific MCP tool |

**Glob Pattern Examples:**

```json
{
  "permissions": {
    "deny": [
      "Read(./dist/**)",
      "Read(./images/**)",
      "Read(./video/**)",
      "Read(./public/images/**)",
      "Read(./.worktrees/**)",
      "Read(./src-tauri/target/**)",
      "Read(./.obsidian/**)",
      "Read(./coverage/**)",
      "Read(./releases/**)"
    ]
  }
}
```

**Key rules:**
- Patterns are relative to project root (use `./` prefix)
- `**` matches any depth of subdirectories
- `*` matches any filename within a single directory level
- Deny rules prevent the tool from being used on matching paths
- `allow` rules can override deny rules for specific exceptions

### Step 4: Verify and Test

After configuring, verify the settings are correct:

```bash
# Check JSON validity
cat .claude/settings.json | python3 -m json.tool

# Verify no critical paths are blocked
# Ensure src/, lib/, tests/ are NOT in deny rules
```

### Step 5: Document the Configuration

Add a note in the project's CLAUDE.md or documentation explaining why certain directories are excluded.

## Settings File Schema

For the complete settings.json schema including all fields (hooks, permissions, env, etc.), load the reference file:

```
Read references/settings-reference.md
```

## Quick Reference: Common Project Types

### JavaScript/TypeScript (Vite/Next.js/Node)
```json
{
  "permissions": {
    "deny": [
      "Read(./dist/**)", "Read(./build/**)", "Read(./.next/**)",
      "Read(./coverage/**)", "Read(./node_modules/**)",
      "Read(./public/images/**)", "Read(./public/fonts/**)"
    ]
  }
}
```

### Rust (Cargo/Tauri)
```json
{
  "permissions": {
    "deny": [
      "Read(./target/**)", "Read(./dist/**)"
    ]
  }
}
```

### Swift/iOS (Xcode)
```json
{
  "permissions": {
    "deny": [
      "Read(./build/**)", "Read(./DerivedData/**)",
      "Read(./Pods/**)", "Read(./*.xcworkspace/**)",
      "Read(./Assets.xcassets/**)"
    ]
  }
}
```

### Python
```json
{
  "permissions": {
    "deny": [
      "Read(./.venv/**)", "Read(./venv/**)",
      "Read(./__pycache__/**)", "Read(./.mypy_cache/**)",
      "Read(./dist/**)", "Read(./*.egg-info/**)"
    ]
  }
}
```

### Monorepo (Turborepo/Nx)
```json
{
  "permissions": {
    "deny": [
      "Read(./.turbo/**)", "Read(./node_modules/**)",
      "Read(./packages/*/dist/**)", "Read(./apps/*/build/**)",
      "Read(./coverage/**)"
    ]
  }
}
```

## Token Savings Estimation

Each excluded directory saves tokens proportional to:
- Number of files an agent might accidentally read
- Average file size in that directory
- Frequency of agent exploration

**High-impact exclusions** (save 5-20K tokens per session):
- Build output (`dist/`, `target/`, `.next/`)
- Binary assets (`images/`, `video/`, `fonts/`)
- Large generated files (`coverage/`, lock files)

**Medium-impact exclusions** (save 1-5K tokens):
- IDE config (`.obsidian/`, `.idea/`)
- Worktrees (`.worktrees/`)
- Release artifacts (`releases/`)
