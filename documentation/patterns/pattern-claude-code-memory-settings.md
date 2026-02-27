---
type: pattern
project: quack-app
created: 2026-02-27
last_verified: 2026-02-27
tags: [claude-code, memory, settings, auto-memory]
---

# Claude Code Memory Settings Pattern

## What
Quack exposes Claude Code's Auto Memory feature through two UI touchpoints:
1. **Settings toggle** (global) — in Claude Code settings, controls `autoMemoryEnabled` in `~/.claude/settings.json`
2. **Open Memory Folder button** (per-project) — in the project action row, opens the project's memory directory in Finder

## How It Works

### Toggle (Settings → Claude Code → Memory)
- Reads/writes `autoMemoryEnabled` flag in `~/.claude/settings.json`
- ON (default): removes the key from the file (Claude Code default = enabled)
- OFF: writes `"autoMemoryEnabled": false` to the file
- Detects env var override `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` and disables the toggle when present
- Uses generic Tauri commands `get_claude_settings_flag` / `set_claude_settings_flag` (reusable for other boolean flags)

### Open Memory Folder (Project Action Row)
- Button in the `repo-action-row` alongside Copy Path, Terminal, Brain, Reveal in Finder
- Passes the project's `repoPath` to `open_claude_memory_folder` Rust command
- Computes memory path: `~/.claude/projects/-{path-with-dashes}/memory/`
- Shows toast error if directory doesn't exist yet

## Key Files
- `src-tauri/src/hooks.rs` — `get_claude_settings_flag`, `set_claude_settings_flag`, `open_claude_memory_folder` commands
- `src-tauri/src/lib.rs` — command registration
- `src/components/settings/categories/ClaudeCodeSettings.tsx` — Auto Memory toggle with env var override
- `src/components/RepositoryGroup.tsx` — Open Memory Folder button in project action row

## Design Decisions
- Toggle writes to `~/.claude/settings.json` (not localStorage) so it works outside Quack too
- ON state = key absent (not `true`) because Claude Code default is enabled
- Memory Folder button lives per-project (not in global settings) because each project has its own memory directory
- `get_claude_settings_flag` / `set_claude_settings_flag` are generic — can be reused for any boolean flag in settings.json

## Related
- Claude Code Auto Memory docs: https://code.claude.com/docs/en/memory
- Feature spec: `.specify/specs/001-claude-code-memory-settings/`
