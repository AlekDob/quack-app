---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-06-28
tags: [workspace, activity-bar, drag-and-drop, reorder, pointer-events, wkwebview, monaco, gotcha]
---

## Workspace Reorder (drag-to-reorder project icons)
**Purpose:** Let the user reorder the open-project icons in the left activity bar by dragging. The chosen order persists across reloads. Sibling of per-project color ([002](002-workspace-colors.md)).
**Stack:** React 19, TypeScript strict, pointer events (NOT HTML5 DnD), Zustand, Rust `workspaces.json`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Hook | `src/useWorkspaceReorder.ts` | Pointer-based drag engine: `drag` state + `onPointerDown`/`shouldSuppressClick` |
| Component | `src/components/ActivityBar.tsx` | Workspace icons: `data-ws-index`, `onPointerDown`, `.dragging`/`.drag-over` classes |
| Store | `src/store.ts` | `reorderWorkspaces(from, to)` — splice `openIds` + `persistIdx()` |
| App | `src/App.tsx` | `shellOrder` (stable mount order) decouples `WorkspaceShell` DOM order from `openIds` |
| Config | `src/App.css` | `.ws-icon.dragging` (dim+shrink), `.ws-icon.drag-over::before` (accent insertion bar), `body.ws-dragging` (kills selection) |

### Data Flow
- **Drag:** `pointerdown` on icon → `useWorkspaceReorder` stores source index in a ref → window `pointermove` past 4px THRESHOLD activates drag, resolves the slot under the pointer via `document.elementFromPoint` → `data-ws-index`, sets `drag={from,over}` (visual) + adds `body.ws-dragging`
- **Drop:** `pointerup` → if drag was active, `reorderWorkspaces(from, over)` → splice `openIds` → `persistIdx()` (Rust `workspaces.json` `open_ids`) → removes `body.ws-dragging`
- **Click guard:** a real drag sets `suppressClick`; the icon's `onClick` calls `shouldSuppressClick()` first so a drag doesn't also switch workspace

### State
- `press` (ref, in hook): `{ from, startY, active } | null` — source press, synchronous, no re-render
- `drag` (state, in hook): `{ from, over } | null` — drives `.dragging`/`.drag-over` visuals
- `suppressClick` (ref, in hook): one-shot flag consumed by `shouldSuppressClick()`
- `shellOrderRef` / `shellOrder` (App.tsx): stable mount order for `WorkspaceShell` (append-only, never reorders)

### Notes / gotchas
- **GOTCHA — no HTML5 DnD:** native `draggable`/`onDragStart` is broken in Tauri's **WKWebView** (macOS) — `dragstart` fires then `dragend` immediately, never `dragover`/`drop`, so the reorder never runs. Confirmed live via console logs. `-webkit-user-drag: element` and deferring `setState` via rAF do NOT fix it. Hence the pointer-events engine.
- **GOTCHA — Monaco crash on DOM move:** reordering `openIds` while `WorkspaceShell`s map over it makes React MOVE their DOM nodes; moving a node containing a Monaco editor throws `InstantiationService has been disposed`. Fixed by `shellOrder`: shells are a stacked overlay (only active shown via `display`, see `WorkspaceShell` ~L146) so their DOM order is irrelevant — keep it stable, let only the ActivityBar icons reflect `openIds`.
- `watchKey` in App.tsx is `.sort()`ed before join so reordering doesn't needlessly re-run the fs-watch effect (only the SET of ids+roots matters).
- **Selection:** `.ws-icon` needs `-webkit-user-select: none` (WebKit ignores the unprefixed form) or the 2-letter label highlights on a press-drag; `body.ws-dragging` kills selection app-wide during an active drag.
- Persistence is Rust `workspaces.json` `open_ids` (unlike colors, which live in localStorage) — order survives reload.
