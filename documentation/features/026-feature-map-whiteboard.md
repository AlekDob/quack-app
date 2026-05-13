---
type: feature-doc
project: quack-app
stack: TypeScript strict (React 18 frontend), Tauri v2 invoke API (list_directory, read_file_content, read_binary_file, write_binary_file, create_directory)
created: 2026-04-03
last_verified: 2026-05-12
shortcut: Cmd+Shift+W (Meta+Shift+W)
tags: [feature-map, whiteboard, visualization, graph, svg, architecture-layers, mention, autocomplete, image, agent-bridge, skill, nested-components, matryoshka, drag-assign, drag-eject, md-card, markdown, mermaid, notebook-grid, brain-node, knowledge-graph, force-graph, wikilink]
image: images/026-whiteboard-overview.png
---

## Whiteboard (Feature Map)
**Purpose:** Interactive SVG canvas that visualizes all feature docs in `documentation/features/` as architecture layers. Nodes auto-classified into UI Components, Business Logic, and Infrastructure layers with cross-layer connections based on shared source files. Includes portal-based popover detail (with click-to-open-in-editor and image preview), sidebar accordion panel with drag-to-mention and click-to-open, mention autocomplete with feature chip, popout window support, and canvas image annotations (drag & drop + file picker).
**Stack:** React 18 + TypeScript strict + Tauri v2
**Shortcut:** Cmd+Shift+W (macOS) / Ctrl+Shift+W (Windows/Linux)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Model/Type | `src/components/featureMap/featureMapTypes.ts` | FeatureNode (incl. image?), FeatureFile, FeatureLink, FeatureGraph, NodePosition |
| Service | `src/services/featureMapService.ts` | Parses feature markdown docs into FeatureGraph (parseFrontmatter, parseFilesTable, parseFeatureDoc, calculateLinks, buildFeatureGraph) — includes `image` field from frontmatter |
| Service | `src/components/featureMap/featureMapLayout.ts` | Architecture Layers layout engine — left-aligned column layout with collapsible layers (LAYERS, classifyNode, groupByLayer, calculateLayeredLayout) |
| Component | `src/components/featureMap/FeatureMapCanvas.tsx` | SVG canvas with minimal layer headers, collapsible layers, nodes, links, annotations (incl. images), pan/zoom with auto-fit, node drag, annotation mode handling, image drop zone, minimap |
| Component | `src/components/featureMap/FeatureMapView.tsx` | Main container composing data + annotations + canvas + popover + toolbar + image file saving/picking |
| Component | `src/components/featureMap/FeatureMapPopover.tsx` | Portal-based popover near clicked node with feature image preview, collapsible file list, connected features, and click-title-to-open-in-editor |
| Component | `src/components/featureMap/CanvasPostIt.tsx` | SVG post-it note — draggable, editable text, color cycling, delete on hover |
| Component | `src/components/featureMap/CanvasGroupRect.tsx` | SVG group rectangle — draggable, resizable (4 corner handles), editable label, color cycling |
| Component | `src/components/featureMap/CanvasImage.tsx` | SVG canvas image annotation — draggable, aspect-ratio resize (corner handle), delete on hover, blob URL loading from filesystem |
| Component | `src/components/featureMap/CanvasMdCard.tsx` | HTML-overlay MD Preview Card (NOT SVG foreignObject — avoids WebKit clipping bug) — renders inline markdown or referenced `.md`/`.mmd` file (with Mermaid diagrams), edit-first UX (textarea auto-focus on new cards), preview/edit toggle, draggable header, resize handle, collapse toggle, file hot-reload (2s polling), double-click to open source file in editor. Positioned via CSS transform mirroring canvas pan/zoom. |
| Component | `src/components/featureMap/CanvasText.tsx` | HTML-overlay "titoletto" — draggable, edit-on-double-click (auto-focus on spawn), A−/A+ to resize font (10-72px), × to delete. Same pan/zoom transform pattern as MdCard. |
| Component | `src/components/featureMap/CanvasBrainNode.tsx` | HTML-overlay Knowledge Graph card — compact preview (static mini-graph SVG of first 12 nodes) + doc/link counts + double-click to enter `BrainNodeExplorer`. Same drag/resize pattern as `CanvasMdCard`. |
| Component | `src/components/featureMap/BrainNodeExplorer.tsx` | Fullscreen-within-whiteboard knowledge explorer rendered when the user enters a BrainNode. ForceGraph2D + filters (All/Features/Bugs/Patterns/Gotchas/Decisions/Diary/Diagrams) + side preview (MarkdownText + MermaidDiagram lazy) + "Drop on canvas" (spawns live `mdCard` with filePath) + "Open in editor". |
| Service | `src/services/wikiLinkService.ts` | `parseWikiLinks(content)` — extracts `[[target]]` / `[[target\|display]]` references. Regex mirrored from `src/tests/wikilinks.test.ts`. |
| Service | `src/services/brainGraphService.ts` | `loadProjectDocs`, `buildBrainGraph`, `loadBrainGraph` (60s session cache), `invalidateBrainGraphCache`. Combines tag-overlap (weight 1, skip tag fanout >20) + wikilink (weight 2) into a deduplicated graph; merges to `via: 'mixed'` when both apply. |
| Component | `src/components/featureMap/AnnotationToolbar.tsx` | Floating HTML toolbar for Select/Lasso/Post-it/Group/Image/MD Card/Title/Brain mode toggle + selection count badge + Create Component button |
| Component | `src/components/featureMap/FeatureMapMinimap.tsx` | Minimap overview panel — node dots + viewport rect + click-to-navigate |
| Component | `src/components/featureMap/WhiteboardBreadcrumb.tsx` | Navigation breadcrumb for nested components — Root > Parent > Current |
| Model/Type | `src/components/featureMap/annotationTypes.ts` | PostIt, GroupRect, CanvasImage, MdCard, CanvasText, **BrainNode**, CanvasAnnotations, WhiteboardFile, AnnotationMode (incl. 'lasso', 'mdcard', 'text', 'brain'), ComponentNavigation, LassoRect types + color/dimension constants |
| Store/State | `src/hooks/useCanvasSelection.ts` | Multi-selection hook — lasso rect state, selectedIds Set, startLasso/updateLasso/resetLasso/setSelection/toggleSelect/clearSelection |
| Service | `src/services/whiteboardFileService.ts` | File-based I/O for `.whiteboard.json` — readWhiteboardFile, writeWhiteboardFile, migrateFromLocalStorage (Tauri read_file_content + write_file_content) |
| Store/State | `src/hooks/useWhiteboardFile.ts` | Unified annotation + position CRUD hook with file-based persistence + 2s polling for external changes (agent bridge) |
| Component | `src/components/featureMap/FeatureMapDetailPanel.tsx` | Legacy slide-in sidebar (unused, kept as reference) |
| Component | `src/components/featureMap/FeatureMapView.css` | Dark-theme styles for canvas, popover, toolbar, file list, loading/error/empty states |
| Component | `src/components/FeaturesPanel.tsx` | Sidebar accordion panel listing features grouped by layer with drag-to-mention and click-to-open-in-editor |
| Component | `src/components/FeaturesPanel.css` | Styles for features sidebar panel |
| Store/State | `src/hooks/useFeatureMapData.ts` | Fetches feature docs via Tauri list_directory + read_file_content, builds FeatureGraph (graceful fallback for missing directory) |
| Store/State | `src/hooks/useFeatureMapTab.ts` | Singleton tab hook with initialProjectPath support (follows useKanbanTab pattern) |
| Route/Page | `src/views/FeatureMapTabView.tsx` | Tab view wrapper — simple mount/unmount (no WebGL preservation needed) |
| Component | `src/components/ActionIcons.tsx` | Whiteboard icon button in action bar (onFeatureMapClick, isFeatureMapActive) |
| Component | `src/components/TabBar.tsx` | Tab type 'feature-map' registered in Tab.type union |
| Route/Page | `src/App.tsx` | Whiteboard tab integration (open/close, singleton, initialProjectPath enrichment for popout) |
| Component | `src/components/TabPopoutWindowApp.tsx` | Popout window support — feature-map case in switch + project name in titlebar |
| Component | `src/components/ChatInput.tsx` | Feature mention autocomplete section + feature chip rendering for @file:...documentation/features/... |
| Component | `src/components/ChatInput.css` | Feature chip styles (.chat-input-feature-chip) |
| Util | `src/utils/agentMentions.ts` | Excludes structured mentions (@file:, @skill:) from agent matching |
| Skill | `.claude/commands/whiteboard.md` | Agent skill for whiteboard interaction — list, add-postit, add-group, move, clear, organize |

### Data Flow
`documentation/features/*.md` → Tauri `list_directory` + `read_file_content` → `useFeatureMapData` → `featureMapService.buildFeatureGraph()` → `FeatureGraph` → `calculateLayeredLayout()` → layer rects + node positions → SVG rendering (layers → links → nodes) → click → portal popover

### Key Functions
- `buildFeatureGraph(docs) → FeatureGraph` — orchestrates parsing all docs into nodes + shared-file links
- `parseFeatureDoc(raw, filePath) → FeatureNode | null` — extracts title, purpose, tags, stack, files from markdown
- `parseFilesTable(content) → FeatureFile[]` — regex-parses markdown table rows for file entries
- `calculateLinks(nodes) → FeatureLink[]` — O(n^2) comparison of file paths to find shared files
- `classifyNode(node) → layerId` — scores node tags against layer keywords to auto-classify
- `groupByLayer(nodes) → Map<layerId, FeatureNode[]>` — groups nodes by classified layer
- `calculateLayeredLayout(nodes, canvasWidth, collapsedLayers?) → LayoutResult` — positions nodes in left-aligned columns; skips collapsed layers; returns totalWidth/totalHeight for fit-to-content zoom

### Architecture Layers
| Layer | Color | Keywords |
|-------|-------|----------|
| UI Components | Cyan (#5ce0ff) | editor, codemirror, tab, popout, diff, highlighting, visualization, whiteboard, graph, feature-map, search, multi-tab |
| Business Logic | Purple (#c084fc) | permission, delegation, team, remote-api, agent-mode, sdk, build, plan, ask, debug, chat, mention |
| Infrastructure | Slate (#94a3b8) | terminal, ide, context-injection, saved-commands, git, tauri |

### Layout System
- **Left-aligned column layout**: nodes anchored to left margin (`LEFT_MARGIN=30`), right area free for annotations/workspace
- **Dynamic columns**: 1 column if <= 3 features total, otherwise 2 columns (`DEFAULT_COLS=2`)
- **Node dimensions**: 240x72px (`NODE_W`/`NODE_H`), 12px border radius, 20px horizontal gap, 14px vertical gap
- **Minimal layer headers**: collapse arrow (triangle) + layer label + node count — no background rectangles, only a subtle 0.5px underline at `opacity=0.2`
- **Collapsible layers**: click layer header to collapse/expand; collapsed layers set rows=0 and hide their nodes; state in `collapsedLayers: Set<string>` (component state)
- **Section gap**: 24px between layer sections (`SECTION_GAP`), 32px reserved for header (`SECTION_HEADER_H`)
- **Left-aligned node text**: title and subtitle use `textAnchor="start"` at `x=-NW/2+14` (14px inset from left edge)

### Notebook-Paper Grid Background (2026-05-12)
Sfondo del canvas con pattern di quadretti tipo pagina di quaderno, allineato con Office V2 (feature 063).

- Layer `<div>` con `position: absolute; inset: 0; pointerEvents: 'none'` iniettato come PRIMO figlio del container in `FeatureMapCanvas.tsx`, **prima** dello `<svg>`.
- Pattern: doppio `linear-gradient` (orizzontale + verticale) `rgba(255, 255, 255, 0.03)` da 1px su cella base **40px** (`GRID_BASE_PX = 40`).
- **Screen-space sync**: `backgroundSize = 40px` fisso (no zoom scaling); `backgroundPosition = ((panX % 40) + 40) % 40, idem panY`. La griglia trasla col pan ma NON scala col zoom — linee sempre crispy a qualsiasi livello di zoom (stesso pattern di Figma/Miro). Evita il sub-pixel blur che si otteneva scalando `backgroundSize` con zoom non-interi.
- **Z-stacking**: il div grid è `absolute` (z-stack 0 implicito), quindi sovrascriverebbe lo `<svg>` che è static; per ripristinare l'ordine corretto allo `<svg>` è stato aggiunto `position: relative; zIndex: 1`. L'overlay HTML md-cards (già `absolute`, successivo nel sorgente) resta sopra all'svg naturalmente.
- Costo rendering trascurabile (CSS gradient GPU-compositato).

### Fit-to-Content Zoom
- On first render, auto-calculates zoom to fit all content within the viewport
- `zoomX = containerWidth / (totalWidth + 40px padding)`
- `zoomY = containerHeight / (totalHeight + 40px padding)`
- Zoom clamped between 0.4 and 1.0 (`Math.min(Math.max(0.4, Math.min(zoomX, zoomY, 1)), 1)`)
- Pan offset set to `padding/2` (20px) for centering
- Fires only once via `hasAutoFit` ref guard; does not re-trigger on resize or data change

### Minimap
- Small overview panel (160x100px) in bottom-right corner, `position: absolute`
- Shows all nodes as colored dots (`r=3`) using layer border colors
- Displays current viewport as a transparent rectangle with white 30% opacity stroke
- Click anywhere on minimap to navigate: converts minimap coords to SVG coords, centers viewport
- Scale factor: `Math.min(fitX, fitY)` where fit = `(dimension - 12px padding) / totalLayoutDimension`
- Glass-morphism background: `rgba(10,14,26,0.85)` + `backdrop-filter: blur(8px)` + 1px border at 8% white
- Hidden when graph has 0 nodes
- Component: `FeatureMapMinimap.tsx`

### State
- `graph`: FeatureGraph | null — parsed feature graph (component state)
- `loading/error`: fetch state (component state)
- `clickInfo`: {nodeId, screenX, screenY} | null — popover anchor (component state)
- `customPositions`: Map<nodeId, {x, y}> — user-dragged overrides (from useWhiteboardFile hook, persisted to .whiteboard.json)
- `collapsedLayers`: Set<string> — layer IDs currently collapsed (component state)
- `hovered`: string | null — node under cursor for dimming effect (canvas state)
- `viewport`: {zoom, panX, panY} — canvas pan/zoom with fit-to-content auto-fit on first render (canvas state)
- `hasAutoFit`: ref<boolean> — guards one-time fit-to-content zoom calculation (canvas ref)
- `size`: {w, h} — ResizeObserver-tracked container dimensions (canvas state)
- `draggingId`: string | null — node currently being dragged (canvas state)

### Node Drag-to-Reposition
- Nodes can be dragged to custom positions; auto-layout is the default
- Custom positions persisted in `documentation/features/.whiteboard.json` (positions field)
- Yellow dot indicator on nodes with custom positions
- "Reset" button in header clears all overrides (visible only when custom positions exist)
- Three interaction modes distinguished via separate refs with drag threshold:
  - **Canvas pan**: mousedown on background → drag → pan viewport
  - **Node click**: mousedown on node → no movement → release → open popover
  - **Node drag**: mousedown on node → movement past threshold → reposition node

### Annotations (Post-its + Group Rectangles + Images + MD Preview Cards)
- **Post-it notes**: click canvas in Post-it mode to create; drag to move; click to edit text; hover for delete/color buttons; 6 preset colors cycling
- **Group rectangles**: click-drag canvas in Group mode to draw; resizable via 4 corner handles; editable label (click); dashed border when unselected. Drag/resize uses window-level listeners with stable `propsRef` pattern (see Brain: fix-group-resize-mouse-escape)
- **Images**: drag & drop from OS or Image mode + file picker; draggable; aspect-ratio resize; saved to filesystem (see Canvas Images section). Same stable window-listener pattern as group rects
- **MD Preview Cards**: click canvas in MD Card mode to create; renders markdown inline (headings, tables, code, images, mermaid); supports inline `content` OR `filePath` reference to `.md`/`.mmd` files; 2s file polling for hot reload; double-click opens source file in Code Editor (file-backed) or enters edit mode (inline); collapse toggle; resize corner (see MD Preview Cards section)
- Annotations + node positions stored in `documentation/features/.whiteboard.json` (file-based, replaces localStorage)
- Z-order (bottom→top): group rects → **images** → layer backgrounds → links → feature nodes → link pills → **md-cards** → post-its
- Toolbar (floating, bottom-center): Select / Lasso / Post-it / Group / Image / MD Card / Title (titoletti) mode toggle + selection count badge
- Keyboard shortcuts for toolbar: `1` Select, `2` Lasso, `3` Post-it, `4` Group, `5` Image, `6` MD Card, `7` Title. `Ctrl` cycles modes.
- Escape key resets to Select mode and clears multi-selection
- `useWhiteboardFile` hook: unified CRUD for annotations + positions with file persistence + 2s external change polling

### Canvas Images
- **Insert via toolbar**: select Image mode in toolbar, click canvas → file picker opens, selected image placed at click point
- **Insert via drag & drop**: drag image file from OS (Finder/Explorer) onto the canvas → image placed at drop point
- Images saved to `documentation/features/images/{uuid}.{ext}` via Tauri `write_binary_file`
- `CanvasImage` SVG component: `<image>` element with blob URL loaded via `read_binary_file`
- Draggable (same pattern as post-it), aspect-ratio-locked resize via bottom-right corner handle
- Delete button on hover (red circle), border highlight when selected
- Blob URLs cached per component instance, revoked on unmount
- Z-order: rendered between group rects and layer backgrounds (Z1.5)
- Annotations stored in `.whiteboard.json` (same `CanvasAnnotations` structure, `images: CanvasImage[]` array)
- Migration: existing localStorage data auto-migrated to file on first load; missing `images` field gets empty array fallback

### MD Preview Cards (Heptabase-style rich markdown on canvas)
- **Purpose**: first-class whiteboard element for rich doc embedding — not a fat post-it. Document ADRs, architecture diagrams, and flows inline without spreading across many post-its.
- **Insert**: select MD Card mode in toolbar (shortcut `6`) + click canvas → card spawns with starter markdown at click point. Default size `400x300` (`MD_CARD_DEFAULT_W/H`), min `200x120` (`MD_CARD_MIN_W/H`).
- **Two sources** (mutually exclusive):
  - `content: string` — inline markdown stored in `.whiteboard.json`
  - `filePath: string` — relative path to a `.md` or `.mmd` file in the project (e.g. `documentation/features/004-chat.md`). Loaded via Tauri `read_file_content`, polled every 2s for external changes (`FILE_POLL_MS`). Missing file shows inline error state.
- **Mermaid support**:
  - When `filePath` ends with `.mmd`, the file content is wrapped in a ```mermaid fenced block and rendered as SVG via `MermaidDiagram` (lazy-loaded).
  - Mermaid code blocks inside `.md` files are rendered inline by the existing `MarkdownText` renderer (zero new deps).
- **Rendering**: HTML overlay (absolute-positioned div above the SVG canvas, NOT inside a foreignObject). The overlay wrapper applies the same `translate(panX,panY) scale(zoom)` transform as the SVG `<g>`, so cards stay pixel-aligned with SVG post-its/groups. Uses the existing `MarkdownText` component for rich rendering. Supports headings (H1-H6), ordered/unordered lists, tables, code blocks with syntax hints, blockquotes, horizontal rules, inline code, file-path chips, bold/italic, links.
- **Why HTML overlay instead of `<foreignObject>`?** WebKit has a known bug (bugs.webkit.org/show_bug.cgi?id=23113 and related) where HTML content inside a `<foreignObject>` under a `<g transform="scale(...)">` is not clipped correctly to the foreignObject's bounds — the content bleeds out and renders at unrelated viewport coordinates. Excalidraw and React Flow use the same HTML-overlay-with-transform pattern for this exact reason.
- **Interaction**:
  - **Preview-first UX (2026-05-13)**: tutte le card (inline e file-backed) si aprono in PREVIEW di default. Toggle preview/edit via pulsante matita/occhio nell'header (visibile solo su card inline). Razionale: l'utente nella stragrande maggioranza dei casi vuole leggere, non scrivere — il toggle resta a 1 click. Storia: prima del 2026-05-13 le inline cards aprivano in EDIT.
  - Drag card header to move; body scrolls independently (wheel events `stopPropagation` so canvas pan/zoom doesn't hijack scroll)
  - Resize handle bottom-right (visible when selected/hovered; hidden when collapsed)
  - Collapse toggle in header (chevron icon) — reduces card to title bar only (`MD_CARD_COLLAPSED_H = 36px`)
  - Double-click on preview: if `filePath` present → opens source in Code Editor tab; if inline → enters textarea edit mode
  - Delete button (X icon) always visible in header
  - File cards: "open in editor" button in header (external-link icon)
  - Shift+click on card body participates in multi-selection; participates in lasso, group-drag, drag-assign to components, drag-eject
- **Title display logic**: `title` field override → else first H1 in content/file → else first non-empty line → else filename → else `Untitled`
- **Data shape** (`MdCard`):
  ```ts
  { id, x, y, w, h, content?, filePath?, title?, collapsed?, parentComponentId? }
  ```
- **Z-order**: rendered as HTML overlay *above the entire SVG* — this means MD cards visually sit above post-its too. The overlay has `pointer-events: none` on the wrapper and `pointer-events: auto` on each card so the SVG underneath still receives pan/zoom events in empty areas.
- **Persistence**: stored in `annotations.mdCards[]` array inside `.whiteboard.json`. Migration: missing array gets `[]` fallback on file load.
- **Performance note**: rendering is per-card React; for many cards the foreignObject approach is fine up to ~20-30 cards. Beyond that, viewport culling would be needed.

### Feature Image (Frontmatter)
- Add `image: images/screenshot.png` to feature doc YAML frontmatter
- Parsed by `parseFeatureDoc()` in `featureMapService.ts` → `FeatureNode.image?: string`
- Relative path from `documentation/features/` directory
- Displayed as preview at top of popover (max-height: 160px, object-fit: cover)
- Loaded via `read_binary_file` → blob URL (same pattern as canvas images)

### Drag-to-Mention (Sidebar Panel)
- MIME type: `application/quack-feature`
- Data: `{type: 'feature', id, title, docPath}`
- ChatInput drop handler inserts: `@file:{docPath}` mention
- FeaturesPanel groups features by layer with layer-colored badges
- Click on feature item opens its .md file in Code Editor tab

### Mention Autocomplete (@)
- Features section in mention dropdown (between Droids and Files)
- Filters by title, tags, and keyword "feature"
- Section header: gold (#FFD700) graph icon + "Features" label
- Items show: title, truncated purpose, file count
- Selection inserts `@file:{docPath}` mention
- Feature chip rendered above textarea: gold pill with graph icon + human-readable feature name
- `@file:` mentions excluded from agent matching (prevents false-positive `@file-opener` chip)

### Entry Points
1. **Cmd+Shift+W** (toggle) — apertura globale; usa `activeTerminal?.cwd` come `projectPath`.
2. **Bottone Whiteboard nell'ActionIcons** — stesso handler `handleOpenFeatureMapTab` di Cmd+Shift+W.
3. **Click su una stanza in Office View v2** (2026-05-11) — `App.handleOpenWhiteboardForProject(projectPath)` apre/aggiorna il tab `feature-map` con `initialProjectPath: projectPath`. Vedi feature 063.
4. **Mention `@file:.../documentation/features/...`** — non apre la whiteboard, ma inserisce un chip che linka al doc.

**Source-of-truth del `projectPath`:** `FeatureMapTabView` riceve `projectPath = fmTab.initialProjectPath ?? activeTerminal?.cwd` in `App.tsx`. Questo significa che il path del tab è "sticky" dopo un'apertura esplicita (es. dall'Office), e fa fallback all'agente attivo solo se il tab non ha un `initialProjectPath` proprio.

### Click-to-Open-in-Editor
- **Popover title**: clicking feature title in popover opens the `.md` doc in Code Editor (via `onOpenDoc` prop)
- **Sidebar panel**: clicking feature item in FeaturesPanel opens doc in Code Editor (via `onOpenInEditor` prop)
- Both flow through `handleOpenCodeEditorTab(filePath)` in App.tsx

### Popout Window Support
- Tab type `'feature-map'` handled in `TabPopoutWindowApp.tsx` switch
- `initialProjectPath` set on tab creation, enriched on re-focus and popout if missing
- Project name shown in popout titlebar (extracted from path)
- No emoji icon in popout (returns null like kanban)
- Graceful fallback: if `documentation/features/` directory doesn't exist, shows empty state instead of error

### Sidebar Accordion Position
- Features section positioned after File Explorer (order index 2)
- Gold color (#FFD700) for category

### File-Based Storage (Agent Bridge)
- All whiteboard state stored in `documentation/features/.whiteboard.json`
- Schema: `WhiteboardFile { version: 1, annotations: CanvasAnnotations, positions: Record<string, {x,y}> }`
- `whiteboardFileService.ts`: read/write via Tauri `read_file_content`/`write_file_content`
- `useWhiteboardFile` hook polls file every 2s (`POLL_MS`) to detect external changes (agent writes)
- Write-lock: ignores poll results within 500ms (`WRITE_LOCK_MS`) of own writes to prevent flickering
- Change detection: compares JSON string of file content against last known state
- Migration: on first load, if file missing, migrates from legacy localStorage keys (`quack:featureMap:annotations:` + `quack:featureMap:positions:`)

### Agent Skill (`/whiteboard`)
- Skill file: `.claude/commands/whiteboard.md`
- Operates via `Read`/`Write` tools on `.whiteboard.json` — no Tauri or React dependency
- Actions: `list` (show state), `add-postit` (with `--color`/`--near`), `add-group` (with `--around`), `move` (reposition node), `clear` (selective reset), `organize` (auto-layout + groups + summary)
- Changes appear on canvas within 2s (polling interval)
- Embeds layer classification keywords and layout constants for accurate positioning

### Multi-Select (Lasso + Shift+click)
- **Lasso mode**: dedicated toolbar button (dashed rectangle icon); click-drag on canvas draws selection rectangle; on release, hit-tests all feature nodes + annotations whose center is inside. **Shortcut alternativa (2026-05-11)**: in `select` mode tieni premuto **Shift** e trascina su area vuota per disegnare il lasso senza cambiare tool. Drag senza shift in select mode = pan canvas (comportamento storico). Nota: la whiteboard usa `onMouseDown` (MouseEvent), no `setPointerCapture` né stale-closure bug come l'Office — il pattern del lasso qui è guidato da `lassoRectProp` esterno (`useCanvasSelection`) e non da un useState locale, quindi non c'è il rischio dello stesso bug.
- **Shift+click**: on any feature node, post-it, group rect, or image to toggle in/out of multi-selection
- **Visual feedback**: blue border (#3b82f6) on all multi-selected elements (nodes + annotations); badge in toolbar shows count
- **Group drag**: clicking and dragging any multi-selected element moves ALL selected elements together
- **Space+drag**: hold spacebar to force pan mode in any annotation mode (Figma-style)
- **Middle-click drag**: always pans regardless of mode
- **Trackpad**: two-finger scroll = pan, pinch = zoom (ctrlKey detection)
- Selection state is ephemeral (not persisted)
- Hook: `useCanvasSelection.ts` manages selectedIds Set + lasso rect; Canvas does hit-test locally (has access to getPos + graph.nodes + annotations)

### Copy / Paste / Duplicate (2026-05-11)
Cross-platform shortcut a livello window, gestite da `FeatureMapView.tsx`. Operano solo sulle annotation user-created (post-it, group, image, mdCard, text — NON sui feature nodes che sono auto-generated).

| Shortcut | Azione |
|---|---|
| **Cmd+C** / Ctrl+C | Snapshot dei `selectedIds` correnti nel `clipboardIdsRef`. Resetta `pasteOffsetRef = 0`. |
| **Cmd+V** / Ctrl+V | Clona gli id in clipboard via `wb.duplicateAnnotations(ids, off, off)` dove `off` cresce di +24 a ogni paste consecutivo (no overlap su multi-paste). Seleziona i nuovi. Il clipboard avanza ai nuovi id, così Cmd+V ripetuti stackano outward. |
| **Cmd+D** / Ctrl+D | Duplica direttamente i `selectedIds` con offset +24/+24 senza toccare il clipboard. Seleziona i nuovi. |

**Implementazione**:
- `useWhiteboardFile.duplicateAnnotations(ids, offsetX=24, offsetY=24): string[]` — clona i 5 tipi di annotation in un singolo `updateAnnotations` (un solo undo step). Ritorna lista nuovi id nella stessa ordine di input.
- `clipboardIdsRef` + `pasteOffsetRef` in `FeatureMapView.tsx`.
- Filtro `isEditableTarget` esclude `INPUT/TEXTAREA/contentEditable` — non ruba la copia di testo quando l'utente sta editando un post-it/md-card.
- Feature nodes esclusi: `duplicateAnnotations` ignora ids che non matchano nessuno dei 5 tipi annotation.

**Alt-drag (Option+drag su Mac) per duplicare** stile Figma — implementato per `CanvasText` (2026-05-11). Premere Alt durante il `pointerdown` su un titolo → l'elemento viene clonato in-place, il drag che segue muove il clone. `FeatureMapCanvas` riceve `onDuplicateAnnotations` (cablato da `FeatureMapView` con `wb.duplicateAnnotations`); il `CanvasText.onDragStart` controlla `e.altKey` e clona prima del drag.

**Follow-up**: estendere alt-drag a postit/group/image/mdcard. Drag-handlers vivono nei sub-component e non sono ancora centralizzati — richiede pattern simile (prop `onDuplicateAnnotations` propagata a ogni sub-component + check `e.altKey` nei rispettivi onDragStart/onPointerDown).

### Undo / Redo
- **Cmd+Z** (macOS) / **Ctrl+Z** (Windows): undo last whiteboard action
- **Cmd+Shift+Z** / **Ctrl+Shift+Z**: redo
- Undo stack: max 50 snapshots, stored as JSON strings in memory (not persisted)
- Drag optimization: `beginDrag()` saves one snapshot at drag start; per-move updates are suppressed; `endDrag()` re-enables snapshots — single undo step per entire drag
- Covers: post-it/group/image CRUD, node repositioning, clearAll
- Redo stack is cleared on any new action (standard undo behavior)
- Keyboard listener in `FeatureMapView.tsx`, stack logic in `useWhiteboardFile.ts`

### Nested Components (Matryoshka Whiteboards)
Components are nestable group rects that act as sub-whiteboards. Select 2+ annotations, click "Create Component" in toolbar, and a component is created wrapping them. Double-click a component to enter it; breadcrumb shows navigation path.

**Data Model (flat with filtering, not tree)**:
- `parentComponentId?: string` on PostIt, GroupRect, CanvasImage — links annotation to parent component
- `isComponent?: boolean` on GroupRect — marks a group as an enterable component
- `ComponentNavigation` type — ephemeral navigation state (currentComponentId + breadcrumb), NOT persisted
- Filtering via `filterByParent()` — shows only annotations matching current level
- Orphan detection: `fixOrphans()` clears invalid parentComponentId on file load
- Max nesting depth: 5 levels

**Navigation**:
- Double-click a component to enter (see children only, feature nodes hidden)
- Breadcrumb bar (`WhiteboardBreadcrumb.tsx`) shows `Root > Parent > Current` with clickable segments
- Escape/Backspace inside component: go up one level
- Breadcrumb hidden at root level

**Component Appearance**:
- Solid border (not dashed), layers icon (stacked rects), child count badge (top-right)
- Mini-preview: scaled SVG showing children as colored rectangles (max 12 items, "+N more" overflow), 45% opacity, non-interactive
- Components render at Z1 (same as group rects)

**Drag-Assign (drop annotation onto component)**:
- During single annotation drag, hit-test against visible component rects
- Drop target highlighted with amber glow (#f59e0b, 3px border)
- Circular nesting prevention: `canDropOnTarget()` walks component descendants to prevent cycles
- On drop, `assignToComponent(annotationId, componentId)` sets parentComponentId
- Annotation disappears from current view (filtered to component's children)
- Stale drag ref cleanup on next mousedown or mouse-leave

**Drag-Eject (eject annotation from component)**:
- Inside a component, dragging annotation to top 40px of canvas shows orange eject zone
- On drop in eject zone, `ejectFromComponent(annotationId)` promotes to parent level
- Also triggered when mouse leaves canvas toward top (onMouseLeave handler)

**Component CRUD** (in `useWhiteboardFile.ts`):
- `createComponent(childIds, label, currentParent)` — computes bounding box, creates isComponent group, assigns children
- `dissolveComponent(componentId)` — removes group, promotes children to parent level
- `assignToComponent(annotationId, componentId)` — sets parentComponentId
- `ejectFromComponent(annotationId)` — clears parentComponentId (promotes to grandparent)
- `getVisibleAnnotations(componentId)` — filters by parentComponentId
- `getChildAnnotations(componentId)` — returns children for mini-preview
- `getChildCount(componentId)` — counts children across all annotation types
- `canCreateComponent(parentId)` — checks nesting depth < 5

**Agent Skill** (`/whiteboard`):
- `create-component --around [id1, id2] --label "Name"` — creates component from existing annotations
- `--inside component-id` flag on `add-postit`, `add-group` — creates annotation inside component
- `list --inside component-id` — shows component children
- `dissolve-component --id`, `assign-to-component --id --target`, `eject-from-component --id`

### Shortcut Migration
- Original shortcut: `Cmd+Shift+M` (as "Feature Map") — renamed to `Cmd+Shift+W` (as "Whiteboard") on 2026-04-04
- Migration in `shortcutsStorage.ts` `loadShortcuts()`: `SHORTCUT_MIGRATIONS` map auto-migrates `Meta+Shift+M` → `Meta+Shift+W` (macOS) and `Ctrl+Shift+M` → `Ctrl+Shift+W` (Windows)
- Users who customized a different keybinding are not affected (migration only triggers on exact old-default match)
- Migration is idempotent — runs on every load, no-op after first migration
- `Cmd+W` was rejected due to conflict with file tab close handler in App.tsx

### External Dependencies
- Zero external deps — pure SVG rendering (no PixiJS/WebGL)
- Tauri commands: `list_directory`, `read_file_content`, `write_file_content`, `read_binary_file`, `write_binary_file`, `create_directory` (all existing, zero new Rust)

### Config
- Layer definitions in `LAYERS` array (featureMapLayout.ts)
- Node dimensions: 240x72px (`NODE_W`/`NODE_H`), 12px border radius (`NR`)
- Left margin: 30px (`LEFT_MARGIN`)
- Section header height: 32px, section gap: 24px
- Columns: 1 if <= 3 nodes, else 2 (`DEFAULT_COLS`)
- Minimap: 160x100px (`MM_W`/`MM_H`), dot radius 3px, padding 6px
- Auto-fit zoom range: 0.4-1.0, manual zoom range: 0.3-2.5

### Fix: Title tool non creava titoletti (2026-05-12)
Il tool "Title" (tasto `7`, bottone T nella toolbar) sembrava resettarsi a Select senza creare nulla. Causa: `filterByParent` in `useWhiteboardFile.ts:67-71` ricostruiva `CanvasAnnotations` senza il campo `texts` — `CanvasText[]` veniva strippato silenziosamente da `visibleAnnotations` perché il campo è opzionale (TypeScript non urlava). I titoletti venivano persistiti nel `.whiteboard.json` ma non renderizzati al re-render. Fix: aggiunto `texts: match(a.texts ?? [])` al return. Inoltre `MODES` in `FeatureMapView.tsx:220` non includeva `'text'`, quindi il Ctrl-cycling saltava il Title (Ctrl con mode `text` → `'select'`); aggiunto `'text'` all'array. Brain: `documentation/bugs/fix-whiteboard-texts-stripped-by-filterbyparent.md`. **Regola generale**: ogni nuovo campo collezione in `CanvasAnnotations` va aggiunto a `filterByParent`, `duplicateAnnotations`, `MODES`, `BUTTONS` toolbar, branch `handleMouseDown` canvas, render block canvas.

### Brain Node — Knowledge Graph on canvas (2026-05-12)
First-class whiteboard element che trasforma `documentation/` in un knowledge graph navigabile alla Heptabase/Obsidian senza lasciare la canvas.

- **Insert**: select Brain mode in toolbar (tasto `8`, icona network/brain) + click su canvas. Default `280×180` (`BRAIN_NODE_DEFAULT_W/H`), min `220×140`.
- **Vista compatta** (`CanvasBrainNode`): card con accento arancio che mostra un mini-grafo statico SVG dei primi 12 nodi + count "349 docs · 412 links". HTML overlay, NON SVG `foreignObject` (stesso motivo di WebKit clipping di `CanvasMdCard`).
- **Vista espansa** (`BrainNodeExplorer`): double-click sulla card → riusa il `ComponentNavigation` breadcrumb (`Root > Brain`) e renderizza un `ForceGraph2D` fullscreen sopra il canvas. ESC / Backspace esce.
- **Scope di indicizzazione**: ogni `.md` / `.mmd` in `{projectPath}/documentation/` via `listBrainEntries({ projectRoot })` + `readBrainEntry`. NO cross-project, NO brain globale.
- **Sorgenti di link**:
  - **Tag overlap** (`weight: 1`) — stesso algoritmo di `BrainGraph.buildAiGraph` (skip tag con > 20 entries per evitare clutter).
  - **Wikilink** `[[slug]]` nel body (`weight: 2`) — risolti contro slugMap (`filename` senza `.md`/`.mmd`, lowercased). Quando entrambi i tipi di link valgono fra due doc, `via` diventa `'mixed'` e weight è il max + 1.
  - NON usati: file-path-shared, "See also" testuale — troppo rumoroso / fragile.
- **Side preview**: click su un nodo nell'Explorer mostra il doc in un pannello laterale destro (360px) con `MarkdownText` per `.md` e `MermaidDiagram` lazy per `.mmd`. Errori → "Could not read {path}".
- **Drop on canvas**: pulsante nel side panel che materializza il doc selezionato come `mdCard` con `filePath` (hot-reload 2s) accanto al BrainNode sorgente, allo stesso livello di nesting. Implementato via `useWhiteboardFile.spawnMdCardFromBrain()`. L'Explorer esce automaticamente dopo il drop, così l'utente vede subito la nuova card.
- **Open in editor**: pulsante separato che propaga `onOpenFileInEditor` (Code Editor tab).
- **Filtri**: All / Features / Bugs / Patterns / Gotchas / Decisions / Diary / Diagrams — tipizzati su `BrainEntry.type` (decision, bug_fix, pattern, gotcha, diary, diagram, feature, feature-doc, note).
- **Performance**: cache di sessione in `brainGraphService` (`Map<projectPath, { ts, data }>`, TTL 60s). La mini-preview compatta è SVG deterministica — niente force sim. Force sim parte SOLO dentro l'Explorer (`d3-force` via react-force-graph-2d, `charge.strength=-150`, `link.distance` weight-based, `cooldownTicks=400`).
- **Colore semantico**: edge wikilink/mixed in arancio (`rgba(255,107,53,*)`) per distinguerli dai tag-only (bianco). Nodo selezionato con un alone più spesso.
- **Persistenza**: `CanvasAnnotations.brainNodes?: BrainNode[]` (campo opzionale con fallback `[]` al load del file). Aggiunto a tutti i 6 hot-spot obbligati di `useWhiteboardFile` (vedi "Regola generale" sopra).
- **Data shape** (`BrainNode`): `{ id, x, y, w, h, title?, parentComponentId? }` — nessun body content, la lista doc viene derivata dinamicamente da `documentation/`.

### UI Language
- All user-facing strings in English (international audience)
