---
type: pattern
project: quack-app
created: 2026-04-02
last_verified: 2026-04-02
tags: [editor, codemirror, tab, diff, multi-tab]
---

# Code Editor Tab Pattern

## Overview

The integrated code editor tab lets users view, edit, and diff files without leaving Quack. Built on CodeMirror 6 with `@codemirror/merge` for side-by-side diffs.

## Architecture

```
App.tsx
  TabBar ['code-editor']
  CodeEditorTabView (src/views/CodeEditorTabView.tsx)
    CodeEditorView (src/components/editor/CodeEditorView.tsx)
      EditorHeader - breadcrumb, mode, action buttons
      EditorContent - mode switch (edit/diff)
        edit mode: CodeEditorEngine (refactored CM6)
        diff mode: CodeMirrorMergeView (@codemirror/merge)
      EditorStatusBar - cursor, language, save status
```

## Key Files

| File | Purpose |
|------|---------|
| `src/stores/editorStore.ts` | Zustand store: file state, diff mode, editFile resolution |
| `src/hooks/useCodeEditorTab.ts` | Per-file tab hook: `codeEditorTabId(path)` generates unique IDs |
| `src/views/CodeEditorTabView.tsx` | Tab wrapper with lazy-loaded CodeEditorView |
| `src/components/editor/CodeEditorEngine.tsx` | Core CM6 component (refactored from CodeEditorCodeMirror) |
| `src/components/editor/CodeMirrorMergeView.tsx` | Side-by-side diff via @codemirror/merge |
| `src/components/editor/editorTheme.ts` | Shared dark theme |
| `src/components/editor/editorSearch.ts` | Search state effects and helpers |
| `src/components/editor/editorDiff.ts` | Diff decorations |
| `src/components/editor/editorTypes.ts` | All TypeScript interfaces |

## Data Flow

### Opening a file
```
User clicks "Apri nell'editor" in FilePreviewDrawer
  -> editorStore.openFile(path) reads via Tauri invoke
  -> handleOpenCodeEditorTab(path) creates/focuses tab
  -> CodeEditorView renders with EditorContent in edit mode
```

### editFile tool (AI-proposed edits)
```
Agent emits editFile tool call
  -> Tauri event 'edit-file-request'
  -> App.tsx listener reads original file
  -> editorStore.openDiff({ original, proposed, source: 'agent' })
  -> Editor tab opens in diff mode (MergeView)
  -> User clicks Accept/Reject/Edit
  -> editorStore.resolveEdit(action)
  -> 'edit-file-response' event sent back to agent
```

## Tab Integration

Per-file multi-tab (each file gets its own editor tab):
- Tab ID: `code-editor-${filePath}` (unique per file, via `codeEditorTabId()`)
- Tab type: `'code-editor'`
- Keyboard shortcut: Cmd+E (toggleCodeEditor — toggles active code-editor tab)
- ActionIcons button: code bracket icon `<> `
- `isCodeEditorTabActive` uses `activeTabId.startsWith('code-editor')`
- `CodeEditorTabView` syncs editorStore when switching between tabs
- Popout window: `TabPopoutWindowApp.tsx` has `case 'code-editor'` using Tauri file load

## Italian UI Labels

| Context | Label |
|---------|-------|
| Tab | `Editor` (or filename) |
| Empty state | `Nessun file aperto. Apri un file dal chat o usa Cmd+P.` |
| Accept | `Accetta` |
| Reject | `Rifiuta` |
| Edit | `Modifica` |
| Save | `Salva` / `Salvato` / `Non salvato` |
| Diff header | `Revisione modifiche` |
