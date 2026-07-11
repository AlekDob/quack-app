---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-11
last_verified: 2026-07-11
tags: [composer, file-tree, drag-drop, mention, cite, ai-chat, pointer-dnd]
---

## File-tree → composer cite (pointer drag)

**Purpose:** Drag a **file** row from the left explorer onto the chat composer
to cite it — inserts `@workspace/relative/path` at the cursor and queues the
file in per-project context (same outcome as picking a file from the `@`
autocomplete).

**Stack:** React 19, pointer-based DnD (no HTML5 `draggable` — Tauri 2
swallows in-app HTML5 drags; same pattern as whiteboard skill chips).

### Files

| Type | Path | Role |
|---|---|---|
| Service | `src/fileComposerDrag.ts` | Shared drag bus: `startFileTreeDrag`, `registerComposerFileDrop`, hover pub/sub |
| Tree UI | `src/components/FileTree.tsx` | `onFileMouseDown` on file rows; suppresses click after a real drag |
| Host | `src/components/AIChatPanel.tsx` | `citeFileFromDrop`, `data-composer-file-drop`, `.file-drop-over` class |
| Context | `src/workspaceChatContext.ts` | `addAttachedFile` — cited file joins send queue (037) |
| Utils | `src/pathUtils.ts` | `relPath(abs, root)` for `@` token |
| Styles | `src/App.css` | `.tree-row--dragging`, `.file-composer-drag-ghost*`, `.ai-composer-shell.file-drop-over` |

### Data flow

```
FileTree file row mousedown
  → move ≥ FILE_TREE_DRAG_THRESHOLD_PX (4px)
  → startFileTreeDrag(absPath, name, …)
      → ghost pill follows cursor (document mousemove)
      → subscribeComposerFileDropHover → composer .file-drop-over
  → mouseup over [data-composer-file-drop]
  → registerComposerFileDrop.onFile(absPath)
  → citeFileFromDrop:
      splice @relPath at textarea cursor
      addAttachedFile(absPath, root)
      refocus + setSelectionRange after token
```

### Key functions

- `startFileTreeDrag(absPath, label, startX, startY, sourceEl) → cleanup(endX, endY)` — ghost + hit-test; calls drop zone on release over composer
- `registerComposerFileDrop({ onFile }) → unregister` — active chat panel registers one handler (last mount wins)
- `subscribeComposerFileDropHover(cb) → unsubscribe` — composer shell highlights while drag hovers
- `citeFileFromDrop(absPath)` — `AIChatPanel`; mirrors `acceptMention` file branch without `mentionState`
- `isOverDropTarget(x, y)` — `elementFromPoint` + `closest([data-composer-file-drop])`

### Interaction rules

| Rule | Detail |
|---|---|
| Source | **Files only** — directory rows keep click-to-expand; no drag |
| Threshold | 4px movement before drag starts; shorter movement = normal click (open file) |
| Drop target | Entire `.ai-composer-shell` (`COMPOSER_FILE_DROP_ATTR`) |
| Token | `@` + workspace-relative path + trailing space |
| Context | `addAttachedFile` — file appears in Context files dock (037) on next send |
| Images from tree | Cited as `@path` (not composer image attachment — OS/Finder drop onto chat still uses `imageAttach` for raster attach) |

### Visual feedback

| Class | When |
|---|---|
| `.tree-row--dragging` | Source row dimmed (`opacity: 0.45`) while ghost is active |
| `.file-composer-drag-ghost` | Fixed pill on `document.body`, `pointer-events: none`, filename label |
| `.file-composer-drag-ghost--fading` | 120ms fade on drop/release |
| `.ai-composer-shell.file-drop-over` | Border/shadow lift + `--bg-hi` while cursor over composer during drag |

### Gotchas

- **No HTML5 DnD** — `draggable` + `onDrop` do not work for in-app drags under Tauri 2 default `dragDropEnabled`; use document-level `mousemove`/`mouseup` + `elementFromPoint` (see `018-whiteboard-organigramma.md`, `WhiteboardOrganigramma.tsx`).
- **Click vs drag** — `suppressClickRef` on tree `Node` blocks the trailing `click` after a drag so the file does not also open in the editor.
- **Multi-panel chats** — only the mounted `AIChatPanel` that called `registerComposerFileDrop` receives drops; hidden multitask panels unregister on unmount.
- **Path guard** — `addAttachedFile` → `resolveUnderRoot`; paths outside workspace root are ignored.

### Related

- `@` autocomplete + path preview: **`041-mention-file-preview.md`**
- Composer shell layout: **`022-chat-composer.md`**
- Explorer tree rows: **`034-explorer-tree.md`**
- Per-project file queue on send: **`037-project-context-dock.md`**
- OS-level image drop onto chat: **`016-image-attachments.md`** (`registerChatDropZone` in `imageAttach.ts`)
