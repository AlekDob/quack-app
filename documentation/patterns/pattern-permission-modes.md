---
type: pattern
project: quack-app
created: 2026-02-28
last_verified: 2026-03-05
tags: [permission-mode, build, plan, debug, agent-mode, sdk]
---
# Permission Modes System (Build / Plan / Debug)

## Overview

Quack has three agent permission modes that control SDK behavior and system prompt:

| Mode | Internal Value | SDK permissionMode | Default Effort | Color |
|------|---------------|-------------------|----------------|-------|
| **Build** | `bypass` | `bypassPermissions` | medium | `#f87171` (red) |
| **Plan** | `plan` | `plan` | medium | `#60a5fa` (blue) |
| **Debug** | `debug` | `bypassPermissions` | high | `#22c55e` (green) |

## Architecture

### Data Flow

```
User selects mode in UI (footer dropdown or Shift+Tab)
  → updateAgentSettings({ permissionMode: 'debug' })
  → auto-loads preset (model, thinking, effort) from settingsStore
  → on send: permissionMode passed to Rust backend
  → Rust maps to SDK value + adds flags (debugMode: true)
  → Node.js (stream-claude.js OR stream-daemon.js) reads flags
  → Appends mode-specific instructions to systemPrompt.append
  → SDK session receives enriched system prompt
```

### Files Involved

| Layer | File | What it does |
|-------|------|-------------|
| Type | `src/hooks/useClaudeChat.ts` | `PermissionMode` type union |
| Type | `src/types.ts` | `AgentModePresets` interface |
| UI (dropdown) | `src/components/CustomPermissionSelect.tsx` | Footer mode selector |
| UI (popover) | `src/components/ChatSettingsMenu.tsx` | Settings popover mode select |
| UI (settings) | `src/components/settings/categories/AgentModesSettings.tsx` | Mode preset cards |
| UI (banner) | `src/components/ChatView.tsx` | Debug mode accordion banner |
| Store | `src/stores/settingsStore.ts` | Preset defaults + persistence |
| Keyboard | `src/components/ChatView.tsx` | Shift+Tab cycle |
| Auto-switch | `src/App.tsx` | Preset auto-apply on mode change |
| Rust | `src-tauri/src/claude_cli.rs` | SDK mapping + debugMode flag |
| Node (spawn) | `src-tauri/node-sdk/stream-claude.js` | System prompt injection |
| Node (daemon) | `src-tauri/node-sdk/stream-daemon.js` | System prompt injection |
| Skill (bundled) | `src-tauri/node-sdk/skills/systematic-debugging.md` | Full debugging methodology |

### Debug Mode System Prompt (v2)

When `debugMode === true`, the Node.js layer injects 3 blocks into `systemPrompt.append`:

**Order matters** — structured for maximum recency bias (most important = last):

1. **Systematic Debugging Skill** — loaded from `src-tauri/node-sdk/skills/systematic-debugging.md` via `loadBundledSkill()`. Contains Iron Law, 4-phase process, defense-in-depth, red flags. Step 1.5 "Check Quack Brain" is embedded in Phase 1.

2. **Git Context** — loaded via `loadGitContext(cwd)`. Auto-injects `git log --oneline -5` + `git diff --stat`. Timeout: 3s. Only present in git repos with history.

3. **Brain-First Protocol (LAST = highest priority)** — mandatory Step 0 with:
   - Brain slug hints from `loadBrainHints(cwd)` (reads `documentation/bugs/` and `gotchas/` directory listings only — no file contents)
   - Concrete wrong/right example showing why Brain check matters
   - Explicit rules: Brain first, never guess, document findings

**Helper functions** (defined in both `stream-claude.js` and `stream-daemon.js`):
- `loadBrainHints(projectCwd)` — returns array of `.md` file paths from `documentation/bugs/` and `gotchas/` (max 50, lightweight)
- `loadGitContext(projectCwd)` — returns markdown block with recent git log + diff stat (3s timeout)

**Default preset** (settingsStore.ts v3):
- Model: Opus 4.6
- Thinking: `hard` (forces extended thinking for root cause analysis)
- Effort: `high`

### Adding a New Mode

1. Add value to `PermissionMode` type in `useClaudeChat.ts`
2. Add to `AgentModePresets` interface in `types.ts`
3. Add option in `CustomPermissionSelect.tsx` + `ChatSettingsMenu.tsx`
4. Add card in `AgentModesSettings.tsx`
5. Add default preset in `settingsStore.ts` + bump persist version
6. Add to Shift+Tab cycle in `ChatView.tsx`
7. Add cast in `App.tsx` preset lookup
8. Add SDK mapping in `claude_cli.rs` (BOTH daemon + SDK paths)
9. Add system prompt in BOTH `stream-claude.js` AND `stream-daemon.js`

### Migration

New modes require `version` bump in `settingsStore.ts` persist config so existing users get the new preset via migration. Also add a `?? fallback` in `ModePresetCard` for defensive rendering.
