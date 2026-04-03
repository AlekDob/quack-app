---
type: feature-doc
project: quack-app
stack: React 18, PixiJS (pixi.js + @pixi/react), TypeScript strict, Tauri v2
created: 2026-04-03
last_verified: 2026-04-03
tags: [feature-map, whiteboard, pixi, visualization, graph]
---

## Feature Map Whiteboard
**Purpose:** Interactive radial graph that visualizes all feature docs in `documentation/features/`, showing shared-file connections between features on a PixiJS canvas.
**Stack:** React 18, PixiJS (@pixi/react), TypeScript strict, Tauri v2

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Model/Type | `src/components/featureMap/featureMapTypes.ts` | FeatureNode, FeatureFile, FeatureLink, FeatureGraph, NodePosition |
| Service | `src/services/featureMapService.ts` | Parses feature markdown docs into FeatureGraph (parseFrontmatter, parseFilesTable, parseFeatureDoc, calculateLinks, buildFeatureGraph) |
| Service | `src/components/featureMap/featureMapLayout.ts` | Radial layout calculator — positions nodes in concentric rings (calculateRadialLayout) |
| Component | `src/components/featureMap/FeatureMapCanvas.tsx` | PixiJS canvas with zoom/pan, node hover highlighting, link rendering, node selection |
| Component | `src/components/featureMap/FeatureMapView.tsx` | Main container composing data hook + canvas + detail panel; handles loading/error/empty states |
| Component | `src/components/featureMap/FeatureMapDetailPanel.tsx` | Slide-in sidebar showing selected node details (tags, stack, files, connected features) |
| Component | `src/components/featureMap/FeatureMapView.css` | Dark-theme styles for all feature map UI (glassmorphism, animations) |
| Store/State | `src/hooks/useFeatureMapData.ts` | Fetches feature docs via Tauri `list_directory` + `read_file_content`, builds FeatureGraph |
| Store/State | `src/hooks/useFeatureMapTab.ts` | Singleton tab hook (follows useKanbanTab pattern) |
| Route/Page | `src/views/FeatureMapTabView.tsx` | Tab view wrapper — delays first render, preserves WebGL context when inactive |
| Component | `src/components/ActionIcons.tsx` | Feature Map icon button in action bar (onFeatureMapClick, isFeatureMapActive) |
| Component | `src/components/TabBar.tsx` | Tab type `'feature-map'` registered in Tab.type union |
| Config | `src/services/shortcutsStorage.ts` | `toggleFeatureMap` keyboard shortcut definition |
| Model/Type | `src/types.ts` | `'toggleFeatureMap'` added to ShortcutAction union |
| Route/Page | `src/App.tsx` | Feature Map tab integration (open/close, singleton enforcement, layout CSS classes) |

### Data Flow
`documentation/features/*.md` → Tauri `list_directory` + `read_file_content` → `useFeatureMapData` → `featureMapService.buildFeatureGraph()` → `FeatureGraph` → `FeatureMapCanvas` (PixiJS render) + `FeatureMapDetailPanel` (React sidebar)

### Key Functions
- `buildFeatureGraph(docs: Array<{raw, path}>) → FeatureGraph` — orchestrates parsing all docs into nodes + shared-file links
- `parseFeatureDoc(raw: string, filePath: string) → FeatureNode | null` — extracts title, purpose, tags, stack, files from markdown
- `parseFilesTable(content: string) → FeatureFile[]` — regex-parses markdown table rows for file entries
- `calculateLinks(nodes: FeatureNode[]) → FeatureLink[]` — O(n^2) comparison of file paths to find shared files
- `calculateRadialLayout(nodeIds: string[], cx: number, cy: number) → Map<string, NodePosition>` — concentric rings, max 12 nodes/ring, 280px first ring radius
- `useFeatureMapData() → {graph, loading, error, refresh}` — async fetch + parse with Tauri invoke
- `openFeatureMapTab() → Tab` — creates singleton tab with id `'feature-map'`

### State
- `graph`: FeatureGraph | null — parsed feature graph (component)
- `loading`: boolean — fetch in progress (component)
- `error`: string | null — last error message (component)
- `selectedNodeId`: string | null — currently selected node in canvas (component)
- `hoveredNode`: string | null — node under cursor for highlight effect (component)
- `viewport`: {zoom, panX, panY} — canvas pan/zoom state (component)
- `containerSize`: {w, h} — ResizeObserver-tracked container dimensions (component)
- `hasBeenActive`: ref boolean — delays first render until tab activated (component)
- `featureMapEverOpened`: ref boolean — prevents mounting until first open (global in App.tsx)

### External Dependencies
- PixiJS: `pixi.js` + `@pixi/react` for WebGL 2D rendering
- `pixi.js/unsafe-eval`: CSP workaround for Tauri production builds
- Tauri commands: `list_directory`, `read_file_content` (existing, zero new Rust)

### Config
- `toggleFeatureMap`: keyboard shortcut to open/toggle the Feature Map tab
- `NODES_PER_RING`: 12 — max nodes per concentric ring
- `FIRST_RING_RADIUS`: 280px — distance of first ring from center
- `RING_GAP`: 200px — spacing between rings
- `BG_COLOR`: 0x0f0f1a — canvas background
- `CORE_COLOR`: 0xff6b35 — center "Quack Core" node color (brand orange)
- `NODE_HOVER_BORDER`: 0x00d9ff — hover/selection highlight (brand accent)
