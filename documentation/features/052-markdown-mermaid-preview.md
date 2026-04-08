---
type: feature-doc
project: quack-app
stack: React 18 + TypeScript strict
created: 2026-04-08
last_verified: 2026-04-08
tags: [preview, markdown, mermaid, zoom, pan, clickable-chips, code-editor]
---

## Markdown & Mermaid Preview
**Purpose:** Preview mode for .md/.mdx/.mmd files in the code editor, with clickable file path chips, Mermaid diagram zoom/pan, and keyboard shortcuts.
**Stack:** React 18, TypeScript strict, Mermaid.js, Zustand (shortcutsStore)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/editor/CodeEditorView.tsx` | Preview toggle state, `hasPreview` guard, `isMermaid` detection, keydown listener |
| Component | `src/components/editor/EditorContent.tsx` | `isMermaid` prop, renders MermaidDiagram or MarkdownText in preview mode |
| Component | `src/components/editor/EditorHeader.tsx` | Preview/Editor button with KeyboardShortcutTooltip, hides Outline in preview |
| Component | `src/components/SplitView/SplitCodeEditor.tsx` | Standalone preview for split pane (same logic, independent of editorStore) |
| Component | `src/components/MarkdownText.tsx` | Clickable file path chips (`md-file-link`), inline Mermaid rendering for ```mermaid blocks |
| Component | `src/components/MermaidDiagram.tsx` | Zoom (pinch/Ctrl+scroll/buttons), pan (space+drag/middle-click), reset |
| Config | `src/components/MarkdownText.css` | `.md-file-link` hover styles (cursor, underline, background) |
| Config | `src/components/MermaidDiagram.css` | Viewport, zoom controls, pan cursors, focus ring |
| Config | `src/components/editor/CodeEditorView.css` | `.editor-btn-preview` compact padding |
| Route/Page | `src/App.tsx` | `quack:open-file` CustomEvent listener, resolves relative paths via `explorerRoot` |
| Model/Type | `src/types.ts` | `toggleEditorPreview`, `editorSave` added to `ShortcutActionId` |
| Service | `src/services/shortcutsStorage.ts` | Default shortcuts: `Meta+Shift+P` (preview), `Meta+S` (save) |

### Data Flow
```
[Preview button / Cmd+Shift+P] -> [setPreviewOpen toggle] -> [EditorContent renders MarkdownText or MermaidDiagram]
[Inline code with file extension] -> [md-file-link class + data-filepath] -> [click] -> [CustomEvent quack:open-file] -> [App.tsx listener] -> [resolve path] -> [handleOpenCodeEditorTab]
[Mermaid pinch/Ctrl+scroll] -> [setZoom] -> [transform scale] | [Space+drag] -> [setPan] -> [transform translate]
[```mermaid block in .md] -> [MarkdownText flushCodeBlock] -> [lazy MermaidDiagram] -> [rendered diagram]
```

### Key Functions
- `buildKeyString(e: KeyboardEvent) -> string` -- parses keydown to shortcutsStore format (e.g. "Meta+Shift+P")
- `FILE_EXTENSIONS` regex -- matches 30+ file extensions for clickable chip detection
- `handleClick(e) -> void` -- event delegation on `.markdown-content`, dispatches `quack:open-file`
- `handleZoomIn/Out/Reset() -> void` -- zoom controls with min 0.2, max 3.0
- `handleMouseDown(e) -> void` -- starts pan on space+click or middle-click
- `handleViewportKeyDown/Up(e) -> void` -- spacebar pan mode (scoped to focused viewport)

### State
- `previewOpen`: `boolean` -- preview mode toggle, preserved across file changes (component)
- `zoom`: `number` -- Mermaid diagram zoom level, default 1 (component)
- `pan`: `{ x: number, y: number }` -- Mermaid diagram pan offset (component)
- `isPanning`: `boolean` -- true during drag pan (component)
- `spaceHeld`: `boolean` -- true while Space key is held on focused viewport (component)

### Keyboard Shortcuts
| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+Shift+P` | Toggle Preview/Editor | Code editor tab with .md/.mdx/.mmd file |
| `Cmd+S` | Save file | Preview mode (CM handles it in edit mode) |

### Supported Preview Types
| Extension | Renderer | Features |
|-----------|----------|----------|
| `.md`, `.mdx` | `MarkdownText` | Clickable file chips, inline Mermaid diagrams |
| `.mmd` | `MermaidDiagram` | Zoom, pan, dark theme |

### Clickable File Chips
- Inline code matching `FILE_EXTENSIONS` regex gets `data-filepath` attribute + `md-file-link` class
- Works in both editor preview AND chat messages (same MarkdownText component)
- Relative paths resolved: tries `explorerRoot/src/{path}` first, then `explorerRoot/{path}`
- Absolute paths opened directly

### Mermaid Zoom/Pan Config
- `MIN_ZOOM`: 0.2, `MAX_ZOOM`: 3.0, `ZOOM_STEP`: 0.1
- `WHEEL_SENSITIVITY`: 0.002 (for pinch/scroll)
- Pan requires viewport focus (tabIndex=0, click to focus)
- `will-change: transform` for GPU-accelerated rendering
- Zoom controls: sticky bottom bar with -/reset/%/+ buttons

### Behaviors
- Preview state preserved when switching files (no reset on filePath change)
- Non-previewable files show editor even if previewOpen=true (`previewOpen && hasPreview` guard)
- Outline button hidden in preview mode
- Button text: "Preview" in code mode, "Editor" in preview mode
- Mode badge: "Modifica" / "Anteprima" with accent color
- KeyboardShortcutTooltip on Preview, Outline, Save buttons
