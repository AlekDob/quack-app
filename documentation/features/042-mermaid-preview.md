---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), mermaid (lazy), plain CSS
created: 2026-07-06
last_verified: 2026-07-07
tags: [editor, mermaid, diagram, preview, split, mmd, sequence-diagram]
---

## Mermaid diagram preview (`.mmd` tabs)
**Purpose:** `.mmd` files open as normal text buffers but render a live Mermaid SVG in the editor tab via **Edit | Split | Preview** (same toolbar as markdown). Default view is **Preview** so Monaco does not mount on open — avoids a blank/frozen tab when the user only wants the diagram.
**Stack:** React 19, `mermaid` npm package (dynamic `import()`), `EditorMdView` mode reuse.

**Scope:** Standalone `.mmd` files only. Markdown ` ```mermaid ` fences in `.md` are unchanged (no inline diagram render in `MarkdownPreview` yet).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/MermaidPreview.tsx` | Lazy-loads `mermaid`, debounced `render()` → SVG in `.mermaid-preview-canvas`; theme-aware; syntax errors inline |
| Service | `src/editorMermaidView.ts` | `isMermaidPath`, `readEditorMermaidView`, `writeEditorMermaidView` — view pref + default `preview` |
| Component | `src/components/EditorPane.tsx` | Wires `.mmd` → `MermaidPreview` in `preview-half`; skips Monaco in preview-only |
| Component | `src/components/FileEditorPane.tsx` | Same split/preview for modal editors (skills popup, etc.) |
| Component | `src/components/EditorTabToolbar.tsx` | `showDiagramView` — segmented control for markdown **or** mermaid |
| Service | `src/editorMdView.ts` | Shared `EditorMdView` type (`edit` \| `split` \| `preview`) |
| Config | `src/langDetect.ts` | `.mmd` → Monaco `plaintext` (no mermaid grammar) |
| Config | `src/fileIcons.ts` | `.mmd` → `doc` tint (same as `.md`) |
| Config | `src/App.css` | `.mermaid-preview`, viewport/stage/canvas, `.mermaid-preview-zoom` controls |
| Dependency | `package.json` | `mermaid` — code-split chunk, not in main bundle |
| Service | `src/mermaidZoom.ts` | `clampMermaidZoom`, `wheelMermaidZoomFactor`, `scrollForZoom`, zoom constants |

### Data flow
`openFile(.mmd)` → `readFile` → store buffer → `EditorPane` portal → `readEditorMermaidView()` (default `preview`) → `MermaidPreview` → `import("mermaid")` → `mermaid.render(id, source)` → SVG `innerHTML` on canvas.

Split mode: Monaco left (`file.contents` live) + `MermaidPreview` right (re-renders on `onChange` after 250ms debounce).

### View modes (`.mmd`)
| Mode | Editor | Preview | Scroll-sync |
|------|--------|---------|-------------|
| `edit` | Monaco | hidden | — |
| `split` | Monaco left | `MermaidPreview` right | — (not wired; markdown-only today) |
| `preview` | hidden | full width | — |

### Key functions
- `isMermaidPath(path) → boolean` — `/\.mmd$/i`
- `readEditorMermaidView() → EditorMdView` — default `"preview"`
- `MermaidPreview({ content })` — debounced async render, cancels on unmount/theme change

### State / persistence
| Key | Type | Default |
|-----|------|---------|
| `lcp.editorMermaidView` | `"edit" \| "split" \| "preview"` | `"preview"` |

Separate from `lcp.editorMdView` (markdown defaults to `"edit"`).

### Mermaid runtime
| Setting | Value |
|---------|-------|
| `startOnLoad` | `false` — explicit `render()` only |
| `securityLevel` | `strict` |
| `theme` | `dark` when `data-theme=dark`, else `default` |
| Load | `import("mermaid")` on first preview mount |
| Debounce | 250ms on `content` / theme change |
| Empty buffer | Placeholder copy, no `render()` call |

### Zoom / pan
| Input | Behaviour |
|-------|-----------|
| Trackpad pinch | `wheel` + `ctrlKey` (macOS maps pinch) → zoom toward pointer; `passive: false` |
| Two-finger scroll | Native pan on `.mermaid-preview-viewport` |
| Toolbar `−` / `+` | Step ×1.2 toward viewport center |
| `%` label / reset | Jump to 100% + scroll top-left |
| Range | 20%–500% (`MERMAID_ZOOM_MIN` / `MAX`) |

Zoom uses `transform: scale()` on `.mermaid-preview-stage` with explicit stage box so scroll extents track the scaled SVG. Resets to 100% when diagram source changes.

### Error / loading UI
| State | Surface |
|-------|---------|
| Rendering | `"Rendering diagram…"` (`.mermaid-preview-status`) |
| Parse/render error | `<pre class="mermaid-preview-error">` with `errMsg(e)` |
| Empty file | `"Empty diagram — add Mermaid source…"` |

### vs media preview (`017`)
| | `.mmd` (this) | images/PDF (`017`) |
|---|---------------|---------------------|
| Classifier | `isMermaidPath` in editor | `mediaKindOf` |
| Pane | `EditorPane` + toolbar | `MediaPreviewPane` (no toolbar) |
| Buffer | Full text in store | Empty sentinel |
| Editable | Yes (Monaco in edit/split) | Read-only |

### Gotchas
- **Preview default:** first open skips Monaco — fixes reported freeze/blank webview on large sequence diagrams before reload.
- **No scroll-sync:** unlike markdown split, editor scroll does not drive the diagram pane.
- **Bundle size:** mermaid + diagram parsers are a large lazy chunk (~100KB–700KB per diagram type); acceptable for desktop, loaded only when a `.mmd` tab renders.
- **`<br/>` in participants:** Mermaid HTML labels (e.g. `participant UI as Client<br/>(Module)`) are supported by the library; syntax errors surface in the error panel.
- **Not in `mediaKindOf`:** `.mmd` is text; do not route through `MediaPreviewPane`.

### Related docs
- `027-editor-tab-toolbar.md` — shared Edit/Split/Preview toolbar
- `017-media-preview.md` — binary media tabs (orthogonal)
- `013-file-type-icons.md` — `.mmd` tree icon tint
