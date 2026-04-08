---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-06
last_verified: 2026-04-07
last_updated: 2026-04-07
tags: [split-view, tabs, drag-drop, layout, editor, sidebar-drag, preview, markdown, mermaid]
---

## Split View Tabs
**Purpose:** Side-by-side tab viewing with drag-to-split from tab bar or sidebar, resizable panes.
**Stack:** React 18, TypeScript strict, CSS

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/SplitView/SplitDropZone.tsx` | `SplitDropZone`, `SidebarDropData` -- drag overlay with left/right zones, accepts tab and sidebar MIME types |
| Component | `src/components/SplitView/SplitCodeEditor.tsx` | `SplitCodeEditor` -- standalone code editor for split pane with full header (Save, IDE dropdown), dirty tracking, independent of editorStore |
| Component | `src/components/SplitView/SplitPaneDivider.tsx` | `SplitPaneDivider` -- resizable divider with mouse drag |
| Config | `src/components/SplitView/index.ts` | Barrel export for `SplitPaneDivider`, `SplitDropZone`, `SplitCodeEditor` |
| Config | `src/components/SplitView/SplitView.css` | Split pane layout, divider, drop zone, pane header styles |
| Route/Page | `src/App.tsx` | Split state management, tab + sidebar drop handlers, sidebar drag detection, pane rendering |
| Component | `src/components/TabBar.tsx` | `splitTabId` prop, `split-active` CSS class on tab |
| Config | `src/components/TabBar.css` | `.tab-item.split-active` indicator styles |
| Component | `src/components/RuleItem.tsx` | Draggable rule item, sets `application/quack-rule` MIME data on drag start |
| Component | `src/components/CommandItem.tsx` | Draggable command item, sets `application/quack-command` MIME data on drag start |
| Component | `src/components/FileExplorer.tsx` | Draggable file rows, sets `application/quack-file` MIME data on drag start |
| Component | `src/components/SkillsPanel.tsx` | Draggable skill items, sets `application/quack-skill` MIME data on drag start |

### Data Flow
```
[TabBar drag] → [SplitDropZone left/right] → [handleSplitDropLeft/Right] → [setSplitTabId] → [split pane renders]
[Sidebar drag (file/skill/rule/command)] → [handleContentDragOver] → [isDraggingSidebar=true] → [SplitDropZone visible]
[SplitDropZone sidebar drop] → [extractSidebarData] → [onSidebarDropLeft/Right] → [resolveTabFromSidebarDrop] → [creates/finds tab] → [setSplitTabId or setActiveTabId]
[SplitPaneDivider mouse drag] → [onRatioChange] → [setSplitRatio] → [flex ratio updates]
[split pane close button] → [handleCloseSplit] → [setSplitTabId(null)]
```

### Key Functions
- `SplitDropZone({ visible, onDropLeft, onDropRight, onSidebarDropLeft?, onSidebarDropRight? }) → JSX` -- overlay with left/right drop targets, handles both tab and sidebar MIME types
- `extractSidebarData(dt: DataTransfer) → SidebarDropData | null` -- checks DataTransfer for sidebar MIME types, returns first match
- `isSidebarDrag(dt: DataTransfer) → boolean` -- returns true if any sidebar MIME type is present
- `resolveTabFromSidebarDrop(data: SidebarDropData) → string | null` -- creates or finds a tab from sidebar drop payload (file/skill/rule open as code-editor, command opens as command tab)
- `handleSidebarDropRight(data: SidebarDropData) → void` -- resolves sidebar item to tab, places in split pane
- `handleSidebarDropLeft(data: SidebarDropData) → void` -- resolves sidebar item to tab, sets as active (left) tab
- `handleContentDragOver(e: React.DragEvent) → void` -- detects sidebar MIME types, sets isDraggingSidebar
- `handleContentDragLeave(e: React.DragEvent) → void` -- resets isDraggingSidebar when cursor exits content area bounds
- `SplitPaneDivider({ onRatioChange, containerRef, minPaneWidth? }) → JSX` -- draggable divider, emits ratio (0-1)
- `handleSplitDropLeft(tabId: string) → void` -- moves dragged tab to left pane, current to right
- `handleSplitDropRight(tabId: string) → void` -- places dragged tab in right pane
- `handleCloseSplit() → void` -- resets splitTabId to null
- `SplitCodeEditor({ filePath: string }) → JSX` -- standalone editor with full header (breadcrumb, dirty dot, mode badge, Preview/Editor toggle for .md/.mdx/.mmd files, Save button, IDE dropdown), reads file via Tauri invoke, bypasses editorStore singleton. Uses same CSS classes as EditorHeader (.editor-header, .editor-btn-save, .editor-btn-preview, etc.). Markdown preview uses MarkdownText component, Mermaid preview uses MermaidDiagram component (with zoom/pan). Keydown listener: `Cmd+Shift+P` toggles preview, `Cmd+S` saves in preview mode. Buttons have KeyboardShortcutTooltip. Preview state preserved across file changes.
- `getLanguageFromPath(path: string) → string` -- maps file extension to CodeMirror language name

### State
- `splitTabId`: `string | null` -- ID of tab shown in right pane (component, App.tsx)
- `splitRatio`: `number` -- left pane width ratio, default 0.5 (component, App.tsx)
- `isDraggingTab`: `boolean` -- true when a tab is being dragged (component, App.tsx)
- `isDraggingSidebar`: `boolean` -- true when a sidebar item is dragged over content area (component, App.tsx)
- `splitContainerRef`: `RefObject<HTMLDivElement>` -- ref for calculating resize bounds (component, App.tsx)

### Sidebar MIME Types
| MIME Type | Source Component | Tab Type Created |
|-----------|-----------------|-----------------|
| `application/quack-file` | `FileExplorer` | `code-editor` (via `openCodeEditorTab`) |
| `application/quack-skill` | `SkillsPanel` | `code-editor` (via `openCodeEditorTab`) |
| `application/quack-rule` | `RuleItem` | `code-editor` (via `openCodeEditorTab`) |
| `application/quack-command` | `CommandItem` | `command` (custom tab with name + scope) |

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
| `command` | Command viewer (from sidebar drag) |
| `kanban` | `KanbanTabView` |

### Config
- `minPaneWidth`: 300px minimum per pane (hardcoded in SplitPaneDivider and inline styles)
- Split divider width: 4px (SplitView.css)
- Drop zone active color: `rgba(0, 110, 255, 0.1)` border + bg
- Split tab indicator: blue border-bottom `rgba(0, 110, 255, 0.6)` (TabBar.css)
- Sidebar drag dropEffect: `copy` (vs `move` for tab drags)

### Behaviors
- Drag a tab onto the drop overlay to activate split (left or right zone)
- Drag a sidebar item (file, skill, rule, command) over the content area to show the drop overlay
- Drop overlay appears when `(isDraggingTab && !splitTabId) || isDraggingSidebar` -- sidebar drags show overlay even when split is already active (to replace pane content)
- Sidebar drops create or reuse existing tabs via `resolveTabFromSidebarDrop`
- Sidebar left drop sets active tab; sidebar right drop sets split tab
- `handleContentDragLeave` checks cursor position against container bounds to avoid false resets from child elements
- Closing the split tab promotes it or falls back gracefully
- Closing active tab while split is active promotes split tab to primary
- Unsupported tab types show a fallback message in the split pane
