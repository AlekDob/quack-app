---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-11
last_verified: 2026-07-13
tags: [composer, file-tree, drag-drop, mention, cite, ai-chat, pointer-dnd, editor-split, pane]
---

## File-tree pointer drag (composer cite + editor split)

**Purpose:** Drag a **file** row from the left explorer to either:

1. **Chat composer** — cite `@workspace/relative/path` + queue in per-project context (037).
2. **Editor surface** — open/split/move the file tab like dragging an existing tab (pane edges, tab-bar insert, right-edge drawer).

**Stack:** React 19, pointer-based DnD (no HTML5 `draggable` — Tauri 2 swallows in-app HTML5 drags).

### Files

| Type | Path | Role |
|---|---|---|
| Service | `src/fileComposerDrag.ts` | `startFileTreeDrag`, composer drop registry, editor drop apply |
| Hit-test | `src/tabDropTarget.ts` | `resolveTabDropTarget`, `computeEdgeForPoint` — shared with tab drag |
| Drag bus | `src/dragState.ts` | `startDrag` / `updateDrag` / `endDrag` — drives overlays + `DragGhost` |
| Ghost | `src/components/DragGhost.tsx` | Portal label pill (same as tab drag) |
| Tree UI | `src/components/FileTree.tsx` | `onFileMouseDown` on file rows; passes `wsId` |
| Pane UI | `src/components/PaneNode.tsx` | Tab drag + drop overlays; uses `resolveTabDropTarget` |
| Store | `src/store.ts` | `openFileAt`, `openFileInDrawer`, `moveTab`, `moveTabToDrawer`, `openFile` |
| Composer | `src/components/AIChatPanel.tsx` | `citeFileFromDrop`, `data-composer-file-drop` |
| Context | `src/workspaceChatContext.ts` | `addAttachedFile` (037) |
| Drawer zone | `src/editorDrawer.ts` | `isEditorDrawerDropZone` |
| Styles | `src/App.css` | `.tree-row--dragging`, `.ai-composer-shell.file-drop-over`, `.drop-overlay` |

### Data flow

```
FileTree file row mousedown
  → move ≥ FILE_TREE_DRAG_THRESHOLD_PX (4px)
  → startFileTreeDrag(wsId, absPath, name, …)
      → startDrag({ wsId, key: file:path, label })  // dragState
      → mousemove:
          over composer? → updateDrag(clear pane) + composer hover
          else → resolveTabDropTarget(x, y, wsId) → updateDrag(overPaneId, edge, …)
      → DragGhost + PaneNode drop overlays (same as tab drag)
  → mouseup:
      composer hit? → registerComposerFileDrop.onFile → citeFileFromDrop
      drawer hit?   → openFileInDrawer(wsId, path)
      pane hit?     → openFileAt(wsId, path, { paneId, edge | insertIndex })
      → endDrag()
```

### Key functions

| Function | Role |
|----------|------|
| `startFileTreeDrag(wsId, absPath, label, …) → cleanup` | Pointer drag lifecycle |
| `resolveTabDropTarget(x, y, wsId) → TabDropTarget` | Tab bar insert / pane edge / drawer zone |
| `openFileInDrawer(wsId, path)` | Buffer + `moveTabToDrawer` without main-pane tab switch |
| `openFileAt(wsId, path, target)` | Load buffer if needed, `dropTabAt` / `dropTabAtIndex` |
| `registerComposerFileDrop({ onFile })` | Active chat panel drop handler |
| `subscribeComposerFileDropHover(cb)` | Composer `.file-drop-over` highlight |

### Drop targets (priority on mouseup)

| Priority | Target | Action |
|----------|--------|--------|
| 1 | `[data-composer-file-drop]` | `addAttachedFile` + inline `@rel` cite (072) |
| 2 | Right-edge drawer strip | `openFileInDrawer` |
| 3 | Tab bar between tabs | `openFileAt` with `insertIndex` |
| 4 | Pane content edge zones | `openFileAt` with `edge` → split pane |
| 5 | Pane center | `openFileAt` with `edge: "center"` |

`openFileAt` delegates to `moveTab` when the file tab already exists.

### Interaction rules

| Rule | Detail |
|---|---|
| Source | **Files only** — directories keep click-to-expand |
| Threshold | 4px before drag; shorter movement = normal click (`suppressClickRef`) |
| Ghost | `DragGhost` via `dragState` (not a separate tree ghost pill) |
| Multi-panel chats | Last mounted `AIChatPanel` with `registerComposerFileDrop` wins |
| Path guard | `addAttachedFile` → `resolveUnderRoot` |
| Agent mode | Editor drops still work when editor pane is visible; click override opens popup |

### Visual feedback

| Class / surface | When |
|---|---|
| `.tree-row--dragging` | Source row dimmed during drag |
| `.drag-ghost` | Filename label following cursor |
| `.drop-overlay` | Pane edge highlight during drag |
| `.tab-insert-line` | Tab-bar insertion index |
| `.ai-composer-shell.file-drop-over` | Cursor over composer during drag |

### Gotchas

- **No HTML5 DnD** — use `mousemove`/`mouseup` + `elementFromPoint` (Tauri 2).
- **Shared hit-test** — `tabDropTarget.ts` extracted from `PaneNode` so tab + tree drags stay in sync.
- **Click vs drag** — `suppressClickRef` blocks open-after-drag on tree rows.
- **Images from tree** — cited as `@path`, not composer image attach (016).

### Related

- Explorer filter + tree layout: [034-explorer-tree.md](034-explorer-tree.md)
- `@` autocomplete: [041-mention-file-preview.md](041-mention-file-preview.md)
- Composer shell: [022-chat-composer.md](022-chat-composer.md)
- Context files dock: [037-project-context-dock.md](037-project-context-dock.md)
- Editor drawer API + peek flow: [063-surface-view-prefs.md](063-surface-view-prefs.md)
- Editor drawer chrome: `editorDrawer.ts`, `EditorTabDrawer.tsx`
