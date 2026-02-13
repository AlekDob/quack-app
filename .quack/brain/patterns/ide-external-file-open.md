---
title: External IDE File Open Pattern
type: pattern
tags: [ide, file-open, ux, architecture]
created: 2026-02-12
---

# External IDE File Open Pattern

## Problem

Internal file viewers/editors (RuleViewer, SkillViewer, AgentViewer, CommandViewer, CodeMirror) render poorly in production builds. The inline editor approach creates maintenance burden and poor UX, requiring duplicate implementations of viewers across multiple components.

## Solution

All file-open actions across the app check for a preferred IDE (via `useIDEStore`) and open files directly in the external IDE instead of internal tabs. A centralized helper `tryOpenInIDE` in `App.tsx` handles the logic with toast notification "Opening in your IDE...".

This pattern eliminates the need to maintain multiple internal viewers while providing users with their preferred development environment.

## Architecture

### Centralized Helper (`App.tsx`)

```typescript
tryOpenInIDE(filePath: string, line?: number): Promise<boolean>
```

**Behavior:**
- Checks `useIDEStore.preferredIDE` for user's selected IDE
- If IDE is configured, calls `openFileInIDE(filePath, line)` via the IDE store
- Shows toast notification: "Opening in your IDE..."
- Returns `true` if opened in IDE, `false` if fallback to internal UI needed

**Usage:**
```typescript
const opened = await tryOpenInIDE(rulePath, lineNumber);
if (!opened) {
  // Fallback: open internal viewer
  setSelectedRule(rule);
}
```

### Covered Entry Points (All in `App.tsx`)

1. **`handleSelectRule`** — Rules accordion + Claude Assets
   - Calls `tryOpenInIDE(filePath)` before opening internal RuleViewer

2. **`handleSelectSkill`** — Skills accordion
   - Calls `tryOpenInIDE(filePath)` before opening internal SkillViewer

3. **`handleSelectDroid`** — Droids accordion + Claude Assets
   - Calls `tryOpenInIDE(filePath)` before opening internal DroidViewer

4. **`handleSelectCommand`** — Commands accordion + Claude Assets
   - Calls `tryOpenInIDE(filePath)` before opening internal CommandViewer

5. **`handleOpenMcpConfig`** — MCP accordion (`.mcp.json`)
   - Calls `tryOpenInIDE(mcpConfigPath)` to open configuration file in IDE

6. **`handleOpenFilePreview`** — File Explorer + Brain file explorer
   - Calls `tryOpenInIDE(filePath)` for any file selection

7. **`handleFilePathClick`** — Chat stream file path clicks
   - Parses `:line` suffix from chat message (e.g., `src/App.tsx:42`)
   - Calls `tryOpenInIDE(filePath, lineNumber)`

8. **`handleOpenFileInTab`** — Second Brain document nodes
   - Calls `tryOpenInIDE(documentPath)` when clicking brain file links

### Callback Signature Updates

Components pass `filePath` parameter through callbacks:

```typescript
onSelectRule(name: string, scope: string, isNew?: boolean, filePath?: string)
onSelectDroid(name: string, scope: string, isNew?: boolean, filePath?: string)
onSelectCommand(name: string, scope: string, isNew?: boolean, filePath?: string)
onSelectSkill(name: string, scope: string, isNew?: boolean, filePath?: string)
```

**Updated Components:**
- `RulesPanel`
- `AgentsPanel`
- `CommandsPanel`
- `SkillsPanel`
- `ClaudeAssetsPanel`
- `SidePanelAccordion`
- `SidePanel`
- `ClaudeAssetsTabView`

### Fallback Behavior

**No preferred IDE set** → Falls back to internal tab/viewer (original behavior)
- User sees internal viewers if IDE not configured
- Allows gradual adoption without breaking existing workflows

**New items** (+ New Rule, + New Command, etc.) → Always uses internal tab
- No file exists yet, so IDE open not applicable
- Internal editor used for initial creation

**Files with line annotations** (AI diff changes) → Uses internal tab for diff view
- Visual diff display requires custom rendering
- Internal tab provides better UX for reviewing AI-generated changes

**Hooks** → Unchanged (modal-based, stored in settings.json)
- Hooks are stored in settings file, not individual files
- Continue using internal modal for editing

## IDE Store

`useIDEStore` (Zustand, persisted as `quack-ide-settings`):

```typescript
interface IDEStore {
  preferredIDE: string | null;
  openFileInIDE(path: string, line?: number, column?: number): Promise<void>;
}
```

**Supported IDEs:**
- vscode
- cursor
- windsurf
- zed
- intellij
- webstorm
- pycharm
- goland
- rubymine
- sublime

**Implementation:**
- Uses Tauri command `open_file_in_ide` to launch IDE with file
- Handles line/column positioning when supported by IDE
- Persists preference in localStorage

## Toast Notification

Every IDE open action shows:
```typescript
toast('Opening in your IDE...', { duration: 2000 })
```

Uses **sonner** toast library for consistent notifications across app.

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | All file-open handlers + `tryOpenInIDE` helper |
| `src/stores/ideStore.ts` | IDE preference store + `openFileInIDE` implementation |
| `src/components/settings/categories/IDESettings.tsx` | User preference UI selector |
| `src-tauri/src/commands/file.rs` | Tauri backend for `open_file_in_ide` command |

## Benefits

1. **Reduced maintenance** — No need to maintain internal viewers for Rules, Skills, Droids, Commands
2. **Better UX** — Users work in their preferred IDE with full syntax highlighting and features
3. **Consistency** — Single pattern applied across entire app
4. **Flexibility** — Fallback to internal UI when IDE not configured
5. **Extensibility** — Easy to add new file types or entry points

## Related Patterns

- `ide-context-injection.md` — WebSocket context injection for external IDEs
- `settings-ide-preferences.md` — IDE preference configuration
