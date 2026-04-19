---
type: feature-doc
project: quack-app
stack: React 18 + TypeScript strict + Tauri v2 + CodeMirror 6
created: 2026-04-02
last_verified: 2026-04-09
tags: [editor, codemirror, tab, diff, multi-tab, search, popout, autocomplete, minimap, lint, code-intel, outline, preview, markdown, mermaid, html, symbol-navigation, keyboard-shortcuts]
---

## 024 - Integrated Code Editor
**Purpose:** Multi-tab code editor with edit/diff modes, search/replace, autocomplete, minimap, lint/diagnostics, code-intel outline panel, popout window support, agent editFile integration, markdown/mermaid/HTML preview toggle, symbol chip navigation from chat, and keyboard shortcuts.
**Stack:** React 18, TypeScript strict, Tauri v2, CodeMirror 6, @codemirror/merge, @codemirror/autocomplete, @codemirror/lint, @replit/codemirror-minimap, Zustand, mermaid (lazy), HtmlVisualizer (sandboxed iframe)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Store/State | `src/stores/editorStore.ts` | `useEditorStore` -- file state, diff mode, save, editFile resolution |
| Store/State | `src/stores/ideStore.ts` | `useIDEStore` -- IDE detection, file open target (internal/external), IDE operations |
| Service | `src/hooks/useCodeEditorTab.ts` | `useCodeEditorTab()`, `codeEditorTabId(path)` -- per-file tab ID generation |
| Component | `src/views/CodeEditorTabView.tsx` | Tab wrapper with lazy-loaded CodeEditorView, syncs editorStore on tab switch |
| Component | `src/components/editor/CodeEditorView.tsx` | Main orchestrator: EditorHeader + EditorContent + EditorOutlinePanel + EditorStatusBar |
| Component | `src/components/editor/CodeEditorEngine.tsx` | Core CM6 component with forwardRef; search/replace, autocomplete, minimap, lint extensions |
| Component | `src/components/editor/CodeMirrorMergeView.tsx` | Side-by-side diff via @codemirror/merge MergeView |
| Component | `src/components/editor/EditorHeader.tsx` | Breadcrumb, mode badge, outline toggle, Preview toggle, Save/Accept/Reject/Edit buttons with KeyboardShortcutTooltip |
| Component | `src/components/editor/EditorContent.tsx` | Mode switch: edit (CodeEditorEngine) vs diff (CodeMirrorMergeView) vs preview (MarkdownText/MermaidDiagram) |
| Component | `src/components/editor/EditorOutlinePanel.tsx` | Collapsible sidebar showing AST outline symbols via code-intel Tauri commands |
| Component | `src/components/editor/EditorStatusBar.tsx` | Cursor position, language, encoding, save status |
| Component | `src/components/editor/EditorIDEDropdown.tsx` | Split button + dropdown: open in IDE, reveal in Finder/Explorer |
| Component | `src/components/editor/EditorEmptyState.tsx` | Empty state with code bracket icon and instructions |
| Component | `src/components/skeletons/CodeEditorSkeleton.tsx` | Skeleton loader for lazy-loaded editor |
| Config | `src/components/editor/editorTheme.ts` | `customTheme`, `customHighlightStyle`, `highlightExtension` -- dark theme + autocomplete/lint/minimap styles |
| Config | `src/components/editor/editorLanguages.ts` | `getLanguageExtension(lang)`, `supportedLanguages` -- shared CM6 language factory (23 languages) |
| Config | `src/components/editor/editorAutocomplete.ts` | `buildAutocompleteExtension()` -- CM6 autocompletion + closeBrackets |
| Config | `src/components/editor/editorMinimap.ts` | `buildMinimapExtension()` -- @replit/codemirror-minimap blocks display |
| Config | `src/components/editor/editorLint.ts` | `buildLintExtension()`, `pushDiagnostics()`, `ExternalDiagnostic` -- external diagnostics via StateEffect |
| Config | `src/components/editor/editorSearch.ts` | `setSearchMatches`, `searchMatchesField`, `findAllMatches()`, `buildSearchDecorations()` |
| Config | `src/components/editor/editorDiff.ts` | `diffDecorationsField`, `applyDiffDecorations()` -- line-level added/modified/removed |
| Model/Type | `src/components/editor/editorTypes.ts` | All TS interfaces: `EditorMode`, `PendingEdit`, `DiffRequest`, `CodeEditorRef`, etc. |
| Config | `src/components/editor/index.ts` | Barrel export for editor submodules |
| Service | `src/services/codeIntelService.ts` | `getOutline()`, `findDefinition()`, `findReferences()` -- typed Tauri invoke wrappers |
| Rust | `src-tauri/src/code_intel.rs` | 3 Tauri commands: `code_intel_outline`, `code_intel_find_definition`, `code_intel_find_references` |
| Bridge | `src-tauri/node-sdk/code-intel-bridge.js` | Stdin/stdout JSON bridge to tree-sitter code-intel scripts |
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

**Preview toggle (Cmd+Shift+P):**
```
User clicks Preview button or presses Cmd+Shift+P on .md/.mdx/.mmd/.html file
  -> CodeEditorView toggles previewOpen state
  -> EditorContent receives previewOpen + isMermaid + isHtml props
  -> .md/.mdx: renders MarkdownText (with clickable file/symbol chips)
  -> .mmd: renders MermaidDiagram (with zoom/pan)
  -> .html/.htm: renders HtmlVisualizer (sandboxed iframe, auto-resize, no collapsible)
  -> Button text flips: "Preview" <-> "Editor"
  -> Outline button hidden in preview mode
  -> Preview state preserved across file switches
```

**Symbol chip click (chat -> editor):**
```
User clicks symbol chip (e.g. `handleClaudeEvent`) in chat message
  -> MarkdownText dispatches 'quack:open-symbol' { symbol }
  -> App.tsx listener calls findDefinition(symbol, explorerRoot)
  -> On success: handleOpenCodeEditorTab(def.file) opens/focuses tab
  -> Dispatches 'quack:navigate-to-line' { line: def.line }
  -> CodeEditorView listener calls navigateToLine(line) via rAF
  -> On failure: toast "Definition not found"
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

**Outline panel (code-intel):**
```
User clicks outline toggle button in EditorHeader
  -> CodeEditorView shows EditorOutlinePanel
  -> EditorOutlinePanel calls getOutline(filePath) via codeIntelService
  -> codeIntelService invokes Tauri 'code_intel_outline'
  -> Rust spawns node code-intel-bridge.js (stdin JSON, stdout JSON)
  -> Bridge calls tree-sitter getOutline() from outline.js
  -> Symbols displayed in collapsible tree (kind icon + name + line number)
  -> Click symbol -> CodeEditorRef.navigateToLine(line) scrolls + centers + focuses
  -> Outline button only rendered when file language is in outlineSupportedLanguages (14 langs)
```

**Diagnostics push (tsc/eslint):**
```
Backend runs linter (tsc --noEmit / eslint)
  -> Parses output into ExternalDiagnostic[] (line, column, severity, message)
  -> pushDiagnostics(editorView, diagnostics) dispatches StateEffect
  -> CM6 linter extension reads StateField and renders gutter markers + tooltips
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
- `buildAutocompleteExtension() -> Extension` -- CM6 autocomplete + closeBrackets + keymaps
- `buildMinimapExtension() -> Extension` -- minimap sidebar via @replit/codemirror-minimap
- `buildLintExtension() -> Extension` -- lint gutter + external diagnostics StateField
- `pushDiagnostics(view, diagnostics) -> void` -- push ExternalDiagnostic[] into editor
- `CodeEditorRef.navigateToLine(line) -> void` -- scrolls editor to given line number, centers it, and focuses the view (CM6 `EditorView.dispatch` with `selection` + `scrollIntoView`)
- `codeIntelService.getOutline(filePath) -> Promise<OutlineSymbol[]>` -- AST outline via Tauri
- `codeIntelService.findDefinition(symbol, projectPath) -> Promise<FindDefinitionResult>` -- symbol definitions
- `codeIntelService.findReferences(symbol, projectPath) -> Promise<FindReferencesResult>` -- symbol references

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
- `@codemirror/autocomplete`: autocompletion UI + closeBrackets
- `@codemirror/lint`: diagnostics gutter markers + tooltips
- `@replit/codemirror-minimap`: code overview sidebar
- **Official CM6 langs:** `lang-javascript`, `lang-html`, `lang-css`, `lang-json`, `lang-markdown`, `lang-python`, `lang-rust`, `lang-go`, `lang-java`, `lang-php`, `lang-cpp`, `lang-sql`, `lang-yaml`, `lang-xml`, `lang-sass`, `lang-less`, `lang-vue`
- **Legacy CM5 modes** (`@codemirror/legacy-modes` via `StreamLanguage`): Swift, Kotlin, Dart, Shell, Ruby, TOML
- `@lezer/highlight`: syntax highlighting tags
- `@tauri-apps/api/core`: `invoke` for file read/write + code-intel commands
- `@tauri-apps/api/event`: `listen`/`emit` for edit-file-request/response
- `tree-sitter` (via Node.js bridge): AST-based code outline, find-definition, find-references

### Config
- Tab ID pattern: `code-editor-${filePath}` (unique per file)
- Tab type: `'code-editor'`
- Keyboard shortcut: `Cmd+E` (toggle editor tab), `Cmd+S` (save), `Cmd+Shift+P` (toggle preview)
- Preview-eligible extensions: `.md`, `.mdx`, `.mmd`
- ShortcutActionId entries: `toggleEditorPreview`, `editorSave`
- `outlineSupportedLanguages`: Set of 14 languages with reliable tree-sitter parsers (js, ts, python, rust, go, java, php, cpp, c, ruby, swift, kotlin, dart, vue) -- Outline button only shown for these
- Theme: pure black (#000000) background, Atom One Dark / VS Code Dark+ syntax colors
- Font: JetBrains Mono, SF Mono, Monaco fallback chain, 14px
- `quack-ide-settings` localStorage key: persists preferredIDE, fileOpenTarget, autoLaunch, syncFocus

### UI Strings (EN)
- `Save` -- save button
- `Saved` / `Unsaved` -- save status
- `Accept` -- accept diff
- `Reject` -- reject diff
- `Edit` -- edit/switch to edit mode
- `Review changes` -- diff mode badge
- `Preview` -- preview mode badge / toggle
- `No file open. Open one from chat or press Cmd+P.` -- empty state text
- `Outline` -- outline panel header
- `Loading...` -- outline loading state
- `No symbols` -- outline empty state
- `Toggle Outline` -- outline toggle button title
- `Show in {Finder|Explorer|Files}` -- reveal file in system file manager (platform-aware)
