---
type: feature-doc
project: quack-app
stack: React 18 + Tauri v2 + Rust + Node.js (Claude Agent SDK)
created: 2026-04-03
last_verified: 2026-04-03
tags: [permission-modes, build, plan, ask, debug, chat, agent-mode, sdk]
---

## Permission Modes (Build / Plan / Ask / Debug / Chat)
**Purpose:** Five agent permission modes that control SDK behavior, system prompt injection, and default model/effort presets.
**Stack:** React 18, Zustand, Tauri v2 (Rust), Node.js daemon (Claude Agent SDK)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Model/Type | `src/hooks/useClaudeChat.ts` | `PermissionMode` type union (`'plan' \| 'bypass' \| 'ask' \| 'debug' \| 'chat'`) |
| Model/Type | `src/types.ts` | `AgentModePresets`, `ModePreset`, `ThinkingMode`, `EffortLevel` interfaces |
| Component | `src/components/CustomPermissionSelect.tsx` | Footer dropdown mode selector |
| Component | `src/components/ChatSettingsMenu.tsx` | Settings popover mode select |
| Component | `src/components/settings/categories/AgentModesSettings.tsx` | Mode preset cards (model, thinking, effort per mode) |
| Component | `src/components/ChatView.tsx` | Debug mode accordion banner, Shift+Tab cycle keyboard shortcut |
| Store/State | `src/stores/settingsStore.ts` | `agentModePresets` defaults, persistence (v7), `updateModePreset()`, `resetModePresets()` |
| Service | `src/services/claudeSDK.ts` | SDK permission mode mapping (frontend value to SDK value) |
| Route/Page | `src/App.tsx` | Preset auto-apply on mode change via `updateAgentSettings()` |
| Middleware | `src-tauri/src/claude_cli.rs` | Rust SDK mapping + `debugMode`/`chatMode` flags |
| Service | `src-tauri/node-sdk/stream-daemon.js` | System prompt injection, `loadBundledSkill()`, `loadBrainHints()`, `loadGitContext()` |
| Config | `src-tauri/node-sdk/skills/systematic-debugging.md` | Debug mode skill (4-phase methodology) |
| Config | `src-tauri/node-sdk/skills/chat-interaction.md` | Chat mode skill (conversational rules) |

### Data Flow
```
User selects mode (footer dropdown / Shift+Tab)
  → updateAgentSettings({ permissionMode })
  → auto-loads preset (model, thinking, effort) from settingsStore
  → on send: permissionMode passed to Rust backend (claude_cli.rs)
  → Rust maps to SDK value + sets flags (chatMode/debugMode)
  → Node.js daemon reads flags
  → Appends mode-specific skill to systemPrompt.append
  → SDK session receives enriched system prompt
```

### Permission Mode Mapping
| Frontend | Rust → SDK | Flags | System Prompt Injection |
|----------|-----------|-------|------------------------|
| `bypass` | `bypassPermissions` | none | none |
| `plan` | `plan` | none | none |
| `ask` | `default` | none | none |
| `debug` | `bypassPermissions` | `debugMode: true` | systematic-debugging skill + brain hints + git context |
| `chat` | `default` | `chatMode: true` | chat-interaction skill |

### Key Functions
- `updateAgentSettings(updates: Partial<AgentChatSettings>) → void` — applies mode change and auto-loads preset from settingsStore (App.tsx)
- `updateModePreset(mode, preset: Partial<ModePreset>) → void` — persists user customization per mode (settingsStore)
- `resetModePresets() → void` — restores Anthropic recommended defaults (settingsStore)
- `loadBundledSkill(skillName: string) → string` — reads .md skill file from disk (stream-daemon.js)
- `loadBrainHints(projectCwd: string) → string[]` — lists documentation/bugs/ and gotchas/ file paths (stream-daemon.js)
- `loadGitContext(projectCwd: string) → string` — returns git log + diff stat markdown block, 3s timeout (stream-daemon.js)

### State
- `agentModePresets`: `AgentModePresets` — persisted preset config for all 5 modes (global)
- `permissionMode`: `PermissionMode` — current active mode per chat session (component)
- `claude.permissionMode`: `'plan' | 'act' | 'bypass'` — legacy SDK-level permission in settingsStore (global)

### Default Presets
| Mode | Model | Thinking | Effort |
|------|-------|----------|--------|
| Build (`bypass`) | Opus 4.6 | auto | medium |
| Plan | Opus 4.6 | auto | medium |
| Ask | Opus 4.6 | auto | medium |
| Debug | Opus 4.6 | hard | high |
| Chat | Sonnet 4.5 | auto | low |

### Config
- `settingsStore` persist version: `7` (v5: added chat, v6: added ask, v7: typography)
- Migration: new modes require version bump + `?? fallback` in `ModePresetCard`

### Adding a New Mode (Checklist)
1. Add value to `PermissionMode` type in `useClaudeChat.ts`
2. Add to `AgentModePresets` interface in `types.ts`
3. Add option in `CustomPermissionSelect.tsx` + `ChatSettingsMenu.tsx`
4. Add card in `AgentModesSettings.tsx`
5. Add default preset in `settingsStore.ts` + bump persist version
6. Add to Shift+Tab cycle in `ChatView.tsx`
7. Add cast in `App.tsx` preset lookup
8. Add SDK mapping in `claude_cli.rs`
9. Add system prompt in `stream-daemon.js`
10. Add mapping in `useClaudeChat.ts` (hook maps frontend value to SDK value)
