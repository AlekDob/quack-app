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

### Fallback Behavior

- **No preferred IDE set** -> Falls back to internal tab/viewer
- **New items** (+ New Rule, etc.) -> Always uses internal tab
- **Files with line annotations** (AI diff) -> Uses internal tab for diff view
- **Hooks** -> Unchanged (modal-based, stored in settings.json)

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | All file-open handlers + `tryOpenInIDE` helper |
| `src/stores/ideStore.ts` | IDE preference store + `openFileInIDE` implementation |
| `src/components/settings/categories/IDESettings.tsx` | User preference UI selector |
