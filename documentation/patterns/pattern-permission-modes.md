---
type: pattern
project: quack-app
created: 2026-02-28
last_verified: 2026-03-01
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

### Debug Mode System Prompt

When `debugMode === true`, the Node.js layer:

1. Reads the bundled skill from `src-tauri/node-sdk/skills/systematic-debugging.md` via `loadBundledSkill()`
2. Prepends the Quack Brain preamble (Brain-first, never guess, document findings)
3. Appends the full skill content to `systemPrompt.append`
4. Falls back to a brief summary if the skill file is not found

The bundled `systematic-debugging` skill includes:
- **The Iron Law** — No fixes without root cause investigation
- **4-phase process** — Root Cause → Pattern Analysis → Hypothesis → Implementation
- **Defense-in-depth** — Validate at every layer
- **Red flags** — Stop signals when debugging goes off track
- **Common rationalizations** — Anti-patterns to avoid

This way users get the full methodology automatically without installing the skill manually.

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
