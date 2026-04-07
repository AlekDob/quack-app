---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-06
last_verified: 2026-04-06
tags: [split-view, tabs, drag-drop, layout, editor]
---

## Split View Tabs
**Purpose:** Side-by-side tab viewing with drag-to-split and resizable panes.
**Stack:** React 18, TypeScript strict, CSS

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/SplitView/SplitDropZone.tsx` | `SplitDropZone` -- drag overlay with left/right drop zones |
| Component | `src/components/SplitView/SplitCodeEditor.tsx` | `SplitCodeEditor` -- standalone code editor for split pane (independent of editorStore) |
| Component | `src/components/SplitView/SplitPaneDivider.tsx` | `SplitPaneDivider` -- resizable divider with mouse drag |
| Config | `src/components/SplitView/index.ts` | Barrel export for `SplitPaneDivider`, `SplitDropZone`, `SplitCodeEditor` |
| Config | `src/components/SplitView/SplitView.css` | Split pane layout, divider, drop zone, pane header styles |
| Route/Page | `src/App.tsx` | Split state management, drop handlers, pane rendering |
| Component | `src/components/TabBar.tsx` | `splitTabId` prop, `split-active` CSS class on tab |
| Config | `src/components/TabBar.css` | `.tab-item.split-active` indicator styles |

### Data Flow
```
[TabBar drag] → [SplitDropZone left/right] → [handleSplitDropLeft/Right] → [setSplitTabId] → [split pane renders]
[SplitPaneDivider mouse drag] → [onRatioChange] → [setSplitRatio] → [flex ratio updates]
[split pane close button] → [handleCloseSplit] → [setSplitTabId(null)]
```

### Key Functions
- `SplitDropZone({ visible, onDropLeft, onDropRight }) → JSX` -- overlay with left/right drop targets during tab drag
- `SplitPaneDivider({ onRatioChange, containerRef, minPaneWidth? }) → JSX` -- draggable divider, emits ratio (0-1)
- `handleSplitDropLeft(tabId: string) → void` -- moves dragged tab to left pane, current to right
- `handleSplitDropRight(tabId: string) → void` -- places dragged tab in right pane
- `handleCloseSplit() → void` -- resets splitTabId to null
- `SplitCodeEditor({ filePath: string }) → JSX` -- standalone editor that reads file via Tauri invoke, bypasses editorStore singleton
- `getLanguageFromPath(path: string) → string` -- maps file extension to CodeMirror language name

### State
- `splitTabId`: `string | null` -- ID of tab shown in right pane (component, App.tsx)
- `splitRatio`: `number` -- left pane width ratio, default 0.5 (component, App.tsx)
- `isDraggingTab`: `boolean` -- true when a tab is being dragged (component, App.tsx)
- `splitContainerRef`: `RefObject<HTMLDivElement>` -- ref for calculating resize bounds (component, App.tsx)

### Supported Tab Types in Split Pane
| Type | Component |
|------|-----------|
| `code-editor` | `CodeEditorTabView` |
| `feature-map` | `FeatureMapTabView` |
| `file` | `FilePreviewDrawer` (embedded mode) |
| `docs` | `DocsTabView` |
| `image` | `ImageTabView` |
| `agent` | `AgentViewer` |
| `skill` | `SkillViewer` |
| `browser` | `BrowserManager` |

### Config
- `minPaneWidth`: 300px minimum per pane (hardcoded in SplitPaneDivider and inline styles)
- Split divider width: 4px (SplitView.css)
- Drop zone active color: `rgba(0, 110, 255, 0.1)` border + bg
- Split tab indicator: blue border-bottom `rgba(0, 110, 255, 0.6)` (TabBar.css)

### Behaviors
- Drag a tab onto the drop overlay to activate split (left or right zone)
- Drop overlay only appears when `isDraggingTab && !splitTabId` (no split yet)
- Closing the split tab promotes it or falls back gracefully
- Closing active tab while split is active promotes split tab to primary
- Unsupported tab types show a fallback message in the split pane
