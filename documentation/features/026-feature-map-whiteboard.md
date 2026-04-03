---
type: feature-doc
project: quack-app
stack: TypeScript strict (React 18 frontend), Tauri v2 invoke API (list_directory, read_file_content)
created: 2026-04-03
last_verified: 2026-04-03
tags: [feature-map, whiteboard, visualization, graph, svg, architecture-layers]
---

## Feature Map Whiteboard
**Purpose:** Interactive SVG canvas that visualizes all feature docs in `documentation/features/` as architecture layers. Nodes auto-classified into UI Components, Business Logic, and Infrastructure layers with cross-layer connections based on shared source files. Includes portal-based popover detail, sidebar accordion panel with drag-to-mention support.
**Stack:** React 18 + TypeScript strict + Tauri v2

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Model/Type | `src/components/featureMap/featureMapTypes.ts` | FeatureNode, FeatureFile, FeatureLink, FeatureGraph, NodePosition |
| Service | `src/services/featureMapService.ts` | Parses feature markdown docs into FeatureGraph (parseFrontmatter, parseFilesTable, parseFeatureDoc, calculateLinks, buildFeatureGraph) |
| Service | `src/components/featureMap/featureMapLayout.ts` | Architecture Layers layout engine — classifies nodes into layers, positions in horizontal rows (LAYERS, classifyNode, groupByLayer, calculateLayeredLayout) |
| Component | `src/components/featureMap/FeatureMapCanvas.tsx` | Pure SVG canvas with layer backgrounds, layer-tinted nodes, curved cross-layer links, pan/zoom, hover dimming, click emits screen coordinates |
| Component | `src/components/featureMap/FeatureMapView.tsx` | Main container composing data hook + canvas + popover; handles loading/error/empty states |
| Component | `src/components/featureMap/FeatureMapPopover.tsx` | Portal-based popover near clicked node with collapsible file list and connected features |
| Component | `src/components/featureMap/FeatureMapDetailPanel.tsx` | Legacy slide-in sidebar (unused, kept as reference) |
| Component | `src/components/featureMap/FeatureMapView.css` | Dark-theme styles for canvas, popover, file list, loading/error/empty states |
| Component | `src/components/FeaturesPanel.tsx` | Sidebar accordion panel listing features grouped by layer with drag-to-mention |
| Component | `src/components/FeaturesPanel.css` | Styles for features sidebar panel |
| Store/State | `src/hooks/useFeatureMapData.ts` | Fetches feature docs via Tauri list_directory + read_file_content, builds FeatureGraph |
| Store/State | `src/hooks/useFeatureMapTab.ts` | Singleton tab hook (follows useKanbanTab pattern) |
| Route/Page | `src/views/FeatureMapTabView.tsx` | Tab view wrapper — simple mount/unmount (no WebGL preservation needed) |
| Component | `src/components/ActionIcons.tsx` | Feature Map icon button in action bar (onFeatureMapClick, isFeatureMapActive) |
| Component | `src/components/TabBar.tsx` | Tab type 'feature-map' registered in Tab.type union |
| Config | `src/services/shortcutsStorage.ts` | toggleFeatureMap keyboard shortcut (Cmd+Shift+M) |
| Model/Type | `src/types.ts` | 'toggleFeatureMap' added to ShortcutAction union |
| Route/Page | `src/App.tsx` | Feature Map tab integration (open/close, singleton, layout CSS classes) |

### Data Flow
`documentation/features/*.md` → Tauri `list_directory` + `read_file_content` → `useFeatureMapData` → `featureMapService.buildFeatureGraph()` → `FeatureGraph` → `calculateLayeredLayout()` → layer rects + node positions → SVG rendering (layers → links → nodes) → click → portal popover

### Key Functions
- `buildFeatureGraph(docs) → FeatureGraph` — orchestrates parsing all docs into nodes + shared-file links
- `parseFeatureDoc(raw, filePath) → FeatureNode | null` — extracts title, purpose, tags, stack, files from markdown
- `parseFilesTable(content) → FeatureFile[]` — regex-parses markdown table rows for file entries
- `calculateLinks(nodes) → FeatureLink[]` — O(n^2) comparison of file paths to find shared files
- `classifyNode(node) → layerId` — scores node tags against layer keywords to auto-classify
- `groupByLayer(nodes) → Map<layerId, FeatureNode[]>` — groups nodes by classified layer
- `calculateLayeredLayout(nodes, canvasWidth) → LayoutResult` — positions nodes in horizontal rows within layer rectangles

### Architecture Layers
| Layer | Color | Keywords |
|-------|-------|----------|
| UI Components | Cyan (#5ce0ff) | editor, codemirror, tab, popout, diff, highlighting, visualization, whiteboard, graph, feature-map, search, multi-tab |
| Business Logic | Purple (#c084fc) | permission, delegation, team, remote-api, agent-mode, sdk, build, plan, ask, debug, chat, mention |
| Infrastructure | Slate (#94a3b8) | terminal, ide, context-injection, saved-commands, git, tauri |

### State
- `graph`: FeatureGraph | null — parsed feature graph (component state)
- `loading/error`: fetch state (component state)
- `clickInfo`: {nodeId, screenX, screenY} | null — popover anchor (component state)
- `customPositions`: Map<nodeId, {x, y}> — user-dragged overrides (component state + localStorage)
- `hovered`: string | null — node under cursor for dimming effect (canvas state)
- `viewport`: {zoom, panX, panY} — canvas pan/zoom (canvas state)
- `size`: {w, h} — ResizeObserver-tracked container dimensions (canvas state)
- `draggingId`: string | null — node currently being dragged (canvas state)

### Node Drag-to-Reposition
- Nodes can be dragged to custom positions; auto-layout is the default
- Custom positions persisted in `localStorage` key: `quack:featureMap:positions:{projectPath}`
- Yellow dot indicator on nodes with custom positions
- "Reset" button in header clears all overrides (visible only when custom positions exist)
- Three interaction modes distinguished via separate refs with drag threshold:
  - **Canvas pan**: mousedown on background → drag → pan viewport
  - **Node click**: mousedown on node → no movement → release → open popover
  - **Node drag**: mousedown on node → movement past threshold → reposition node

### Drag-to-Mention (Sidebar Panel)
- MIME type: `application/quack-feature`
- Data: `{type: 'feature', id, title, docPath}`
- ChatInput drop handler inserts: `@file:{docPath}` mention
- FeaturesPanel groups features by layer with layer-colored badges

### External Dependencies
- Zero external deps — pure SVG rendering (no PixiJS/WebGL)
- Tauri commands: `list_directory`, `read_file_content` (existing, zero new Rust)

### Config
- `toggleFeatureMap`: Cmd+Shift+M keyboard shortcut
- Layer definitions in `LAYERS` array (featureMapLayout.ts)
- Node dimensions: 240x72px, 12px border radius
- Max columns: dynamic based on canvas width (2-4)
