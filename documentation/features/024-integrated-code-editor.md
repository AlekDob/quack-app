---
type: feature-doc
project: quack-app
stack: React 18 + TypeScript strict + Tauri v2 + CodeMirror 6
created: 2026-04-02
last_verified: 2026-04-02
tags: [editor, codemirror, tab, diff, multi-tab, search, popout]
---

## 024 - Integrated Code Editor
**Purpose:** Multi-tab code editor with edit/diff modes, search/replace, popout window support, and agent editFile integration.
**Stack:** React 18, TypeScript strict, Tauri v2, CodeMirror 6, @codemirror/merge, Zustand

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Store/State | `src/stores/editorStore.ts` | `useEditorStore` -- file state, diff mode, save, editFile resolution |
| Store/State | `src/stores/ideStore.ts` | `useIDEStore` -- IDE detection, file open target (internal/external), IDE operations |
| Service | `src/hooks/useCodeEditorTab.ts` | `useCodeEditorTab()`, `codeEditorTabId(path)` -- per-file tab ID generation |
| Component | `src/views/CodeEditorTabView.tsx` | Tab wrapper with lazy-loaded CodeEditorView, syncs editorStore on tab switch |
| Component | `src/components/editor/CodeEditorView.tsx` | Main orchestrator: EditorHeader + EditorContent + EditorStatusBar |
| Component | `src/components/editor/CodeEditorEngine.tsx` | Core CM6 component with forwardRef; search/replace imperative API |
| Component | `src/components/editor/CodeMirrorMergeView.tsx` | Side-by-side diff via @codemirror/merge MergeView |
| Component | `src/components/editor/EditorHeader.tsx` | Breadcrumb, mode badge, Save/Accept/Reject/Edit buttons |
| Component | `src/components/editor/EditorContent.tsx` | Mode switch: edit (CodeEditorEngine) vs diff (CodeMirrorMergeView) |
| Component | `src/components/editor/EditorStatusBar.tsx` | Cursor position, language, encoding, save status |
| Component | `src/components/editor/EditorEmptyState.tsx` | Empty state with code bracket icon and instructions |
| Component | `src/components/skeletons/CodeEditorSkeleton.tsx` | Skeleton loader for lazy-loaded editor |
| Config | `src/components/editor/editorTheme.ts` | `customTheme`, `customHighlightStyle`, `highlightExtension` -- dark theme |
| Config | `src/components/editor/editorSearch.ts` | `setSearchMatches`, `searchMatchesField`, `findAllMatches()`, `buildSearchDecorations()` |
| Config | `src/components/editor/editorDiff.ts` | `diffDecorationsField`, `applyDiffDecorations()` -- line-level added/modified/removed |
| Model/Type | `src/components/editor/editorTypes.ts` | All TS interfaces: `EditorMode`, `PendingEdit`, `DiffRequest`, `CodeEditorRef`, etc. |
| Config | `src/components/editor/index.ts` | Barrel export for editor submodules |
| Component | `src/components/settings/categories/IDESettings.tsx` | Settings UI: preferred IDE, file open target toggle (internal/external) |
| Route/Page | `src/tab-popout-entry.tsx` | Entry point for popout window (renders TabPopoutWindowApp) |
| Component | `src/components/TabPopoutWindowApp.tsx` | Popout window: `case 'code-editor'` loads file via Tauri and renders CodeEditor |
| Test | `src/tests/editorStore.test.ts` | Unit tests: openFile, updateContent, save, openDiff, resolveEdit, reset |
| Test | `src/tests/useCodeEditorTab.test.ts` | Unit tests: tab ID generation, per-file uniqueness, isCodeEditorTab |
| Test | `src/tests/codeEditor.decorationSorting.test.ts` | Tests: decoration sorting for diff/search |
| Test | `src/tests/codeEditor.migration.test.tsx` | Tests: migration from CodeEditorCodeMirror to CodeEditorEngine |

### Data Flow

**Open file (user click):**
```
FileExplorer / FilePreviewDrawer click
  -> ideStore.fileOpenTarget check (internal vs external)
  -> editorStore.openFile(path) invokes Tauri read_file_content
  -> handleOpenCodeEditorTab(path) creates/focuses per-file tab
  -> CodeEditorTabView syncs store -> CodeEditorView renders in edit mode
```

**editFile tool (agent-proposed edit):**
```
Agent emits editFile tool call
  -> Tauri event 'edit-file-request'
  -> App.tsx listener reads original via invoke('read_file_content')
  -> editorStore.openDiff({ original, proposed, source: 'agent' })
  -> handleOpenCodeEditorTab(path) opens/focuses tab
  -> EditorContent renders CodeMirrorMergeView (diff mode)
  -> User clicks Accept/Reject/Edit
  -> editorStore.resolveEdit(action)
  -> emit('edit-file-response') back to agent
```

**Save (Cmd+S):**
```
User presses Cmd+S in editor
  -> CodeEditorEngine keymap fires onSave
  -> editorStore.save() invokes Tauri write_file_content
  -> isDirty resets to false
```

**Search/Replace (Cmd+F):**
```
User presses Cmd+F
  -> CM6 built-in search panel opens (dark-themed via editorTheme)
  -> Custom search via CodeEditorRef.search() for programmatic access
  -> findAllMatches() -> buildSearchDecorations() -> setSearchMatches effect
```

**Popout window:**
```
User pops out code-editor tab
  -> TabPopoutWindowApp receives tab with type 'code-editor'
  -> Loads file content via Tauri invoke
  -> Renders CodeEditorCodeMirror in standalone window
```

### Key Functions
- `useEditorStore.openFile(path) -> Promise<void>` -- reads file via Tauri, sets edit mode
- `useEditorStore.updateContent(content) -> void` -- updates content, tracks dirty state
- `useEditorStore.save() -> Promise<boolean>` -- writes to disk via Tauri
- `useEditorStore.openDiff(request: DiffRequest) -> void` -- enters diff mode with pending edit
- `useEditorStore.resolveEdit(action) -> Promise<void>` -- accept/reject/edit, emits response to agent
- `codeEditorTabId(filePath) -> string` -- generates `code-editor-${filePath}` tab ID
- `useCodeEditorTab().openCodeEditorTab(path?) -> Tab` -- creates Tab object for per-file editor
- `handleOpenCodeEditorTab(path?) -> void` -- (in App.tsx) creates/focuses tab, toggle with no path
- `handleOpenFileInEditorTab(path) -> void` -- (in App.tsx) opens file in store + focuses tab
- `tryOpenInIDE(path, line?) -> Promise<boolean>` -- (in App.tsx) respects fileOpenTarget preference
- `getLanguageExtension(language) -> Extension` -- maps language string to CM6 extension
- `findAllMatches(text, query, options) -> SearchMatch[]` -- regex search with options
- `buildSearchDecorations(matches, currentIndex) -> Range<Decoration>[]` -- highlight decorations
- `applyDiffDecorations(view, lineChanges?, diffInfo?) -> void` -- line-level diff highlighting
- `buildBreadcrumb(filePath) -> string[]` -- last 3 path segments for header

### State
- `filePath`: `string | null` -- currently open file path (global)
- `content`: `string` -- current editor content (global)
- `originalContent`: `string` -- content at last save/open, used for dirty detection (global)
- `mode`: `'edit' | 'diff'` -- current editor display mode (global)
- `isDirty`: `boolean` -- true when content differs from originalContent (global)
- `isLoading`: `boolean` -- true during file read (global)
- `pendingEdit`: `PendingEdit | null` -- pending agent/changes-panel diff awaiting resolution (global)
- `cursorPosition`: `{ line, column }` -- current cursor position for status bar (global)
- `fileOpenTarget`: `'internal' | 'external'` -- user preference for file open behavior (global, persisted)

### External Dependencies
- `@codemirror/merge`: side-by-side diff view (~15 KB gzipped)
- `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`: core CM6
- `@codemirror/language`: bracket matching, fold gutter, syntax highlighting
- `@codemirror/search`: built-in search panel
- `@codemirror/lang-javascript`, `lang-html`, `lang-css`, `lang-json`, `lang-markdown`, `lang-python`, `lang-rust`: language support
- `@lezer/highlight`: syntax highlighting tags
- `@tauri-apps/api/core`: `invoke` for file read/write
- `@tauri-apps/api/event`: `listen`/`emit` for edit-file-request/response

### Config
- Tab ID pattern: `code-editor-${filePath}` (unique per file)
- Tab type: `'code-editor'`
- Keyboard shortcut: `Cmd+E` (toggle editor tab), `Cmd+S` (save)
- Theme: pure black (#000000) background, Atom One Dark / VS Code Dark+ syntax colors
- Font: JetBrains Mono, SF Mono, Monaco fallback chain, 14px
- `quack-ide-settings` localStorage key: persists preferredIDE, fileOpenTarget, autoLaunch, syncFocus

### i18n Keys
- `Salva` -- save button
- `Salvato` / `Non salvato` -- save status
- `Accetta` -- accept diff
- `Rifiuta` -- reject diff
- `Modifica` -- edit/switch to edit mode
- `Revisione modifiche` -- diff mode badge
- `Nessun file aperto. Apri un file dal chat o usa Cmd+P.` -- empty state text
