---
type: pattern
tags: [ide, file-open, ux, architecture]
created: 2026-02-12
---

# External IDE File Open Pattern

## Problem

Internal file viewers/editors (RuleViewer, SkillViewer, AgentViewer, CommandViewer, CodeMirror) render poorly in production builds. The inline editor approach creates maintenance burden and poor UX.

## Solution

All file-open actions across the app check for a preferred IDE (via `useIDEStore`) and open files directly in the external IDE. A centralized helper `tryOpenInIDE` in `App.tsx` handles the logic with toast notification.

### Centralized Helper (`App.tsx`)

```typescript
tryOpenInIDE(filePath: string, line?: number): Promise<boolean>
```

Returns `true` if opened in IDE, `false` if fallback to internal UI needed.

### Covered Entry Points (All in `App.tsx`)

1. `handleSelectRule` - Rules accordion + Claude Assets
2. `handleSelectSkill` - Skills accordion
3. `handleSelectDroid` - Droids accordion + Claude Assets
4. `handleSelectCommand` - Commands accordion + Claude Assets
5. `handleOpenMcpConfig` - MCP accordion (.mcp.json)
6. `handleOpenFilePreview` - File Explorer + Brain file explorer
7. `handleFilePathClick` - Chat stream file path clicks (supports `:line` suffix)
8. `handleOpenFileInTab` - Second Brain document nodes

### New Item Creation Flow (Droids & Rules)

"+ New Droid" and "+ New Rule" buttons open a `ScopePickerModal` that asks for name + scope (project/global). After confirmation:

1. File is created on disk via Tauri command (`create_agent` / `create_rule`) with template content
2. The handler calls `onSelectDroid(name, scope, false, filePath)` or `onSelectRule(name, scope, false, filePath)` — note `isNew=false` since the file already exists on disk
3. `handleSelectDroid`/`handleSelectRule` in App.tsx then applies the standard IDE-or-fallback logic

This avoids any special "new item" code path — the file is created first, then opened like any existing file.

**Components:**
- `ScopePickerModal` — reusable modal for name + scope selection
- `ConfirmModal` — reusable modal for destructive confirmations (replaces `window.confirm`)

### Delete Confirmation

Both droids and rules use `ConfirmModal` instead of `window.confirm()`. See gotcha: `gotcha-window-confirm-tauri-webview.md`.

### Fallback Behavior

- **No preferred IDE set** -> Falls back to internal tab/viewer
- **New items** -> `ScopePickerModal` → create file → IDE if set, internal tab if not
- **Files with line annotations** (AI diff) -> Uses internal tab for diff view
- **Hooks** -> Unchanged (modal-based, stored in settings.json)

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | All file-open handlers + `tryOpenInIDE` helper |
| `src/stores/ideStore.ts` | IDE preference store + `openFileInIDE` implementation |
| `src/components/settings/categories/IDESettings.tsx` | User preference UI selector |
| `src/components/ScopePickerModal.tsx` | Name + scope picker for new droids/rules |
| `src/components/ConfirmModal.tsx` | Reusable delete confirmation modal |
| `src/components/AgentsPanel.tsx` | Droid list with Edit/Delete on hover + create draft |
| `src/components/RulesPanel.tsx` | Rule list with delete via ConfirmModal + create draft |
