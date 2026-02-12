---
type: bug_fix
project: quack-app
created: 2026-02-12
tags: [marketplace, agent-bundles, sidebar, terminals, installation]
---

# Agent-Bundle Installation With Project Picker

## Problem

When clicking **Get** on agent-bundles in Quack Store, the project picker modal appeared but after selecting a project, the agent never appeared in the sidebar.

**Root cause**: `installAgentBundle()` created `UnifiedAgent` in Tauri store (`quack-agents.json`), but sidebar displays only terminals (`TerminalInfo[]`). The two systems weren't connected - agents were saved to database but never loaded into UI.

## Solution (3 files)

### 1. `useMarketplace.ts`

`installBundleSkills()` now returns `installedSkills[]` and `installedRules[]` arrays (not just counts). This provides detailed info about what was installed globally.

### 2. `QuackStoreDrawer.tsx`

- Added `onAgentBundleInstalled` callback prop
- `handleProjectSelected` uses `installBundleSkills` (global skills/rules) + calls callback with `AgentBundleInstallData` (template + project info + installed resources)

### 3. `App.tsx`

New `handleAgentBundleInstalled` handler creates terminal in sidebar using same pattern as `handleConfirmNewTerminal`:

```typescript
invoke(create_terminal)
  → setTerminals
  → save_agent_personality + inject_personality_to_claude_md
```

## Correct Flow Now

1. Click **Get** → project picker opens (preserved)
2. User selects project
3. Skills/rules installed globally to `~/.claude/`
4. Agent created in sidebar as working terminal
5. Personality saved and injected to project `CLAUDE.md`
6. Store drawer closes → agent selected and ready

## Key Changes

### Before
```typescript
// Agent was saved to database but never appeared in UI
installAgentBundle() → creates UnifiedAgent in quack-agents.json
// Sidebar only shows TerminalInfo[] - disconnected systems
```

### After
```typescript
// Complete flow: global install + UI creation + personality injection
installBundleSkills() → returns detailed installed resources
onAgentBundleInstalled callback → creates terminal in sidebar
handleAgentBundleInstalled → invoke(create_terminal) + personality injection
```

## Bonus Fix

`StoreProjectPickerModal` now has:
- `max-height: 80vh` on panel
- `max-height: 50vh + overflow-y: auto` on project list

This prevents modal from growing beyond screen when many projects exist.

## Files Changed

- `src/hooks/useMarketplace.ts` - `installBundleSkills()` returns arrays, not counts
- `src/components/QuackStoreDrawer.tsx` - Added `onAgentBundleInstalled` callback prop
- `src/App.tsx` - New `handleAgentBundleInstalled` handler for terminal creation
- `src/components/store/StoreProjectPickerModal.tsx` - Max-height constraints for scrolling

## Context

The disconnect happened because the marketplace system was built with the old agent architecture in mind (database-backed agents). The current UI architecture uses **terminals as the primary entity**, with agents being **personalities attached to terminals**. The fix bridges these two systems by ensuring agent-bundles create actual terminals in the UI layer, not just database entries.

This preserves the project picker UX (users select where to install the agent) while correctly creating a working terminal in the sidebar with full personality injection into the project's `CLAUDE.md`.
