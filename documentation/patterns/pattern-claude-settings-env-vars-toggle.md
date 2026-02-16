---
type: pattern
created: 2026-02-06
tags: [settings, claude-code, experimental-features, env-vars]
---

# Pattern: Claude Settings Env Vars Toggle

## Contesto

Claude Code Agent SDK supports Agent Teams (swarm mode) as experimental feature, enabled via env var in `~/.claude/settings.json`. Quack allows users to toggle this via UI instead of manual file editing.

## Implementazione

### Backend Rust (hooks.rs)

Two Tauri commands: `get_claude_env_vars()` and `set_claude_env_var(key, value)`.

- Reads `settings.other.get("env")` and deserializes strings
- `value: None` removes the key; if `env` becomes empty, removes entire `env` object

### Frontend (ClaudeCodeSettings.tsx)

"Experimental Features" section with IOSSwitch toggle for Agent Teams. Optimistic update with rollback on error.

## Pattern Estendibile

This pattern is generic for any experimental env var. To add a new toggle:
1. Frontend: add a new SettingsRow
2. Logic: use `get_claude_env_vars` and `set_claude_env_var` with appropriate key
3. No Rust changes needed

## Trigger

When Claude Code introduces a new experimental feature controlled by env var, add a toggle in this settings section.
