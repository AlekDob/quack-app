---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-06-28
tags: [workspace, colors, palette, popover, activity-bar, agent-rail, theming, localStorage, drag-and-drop, reorder]
---

## Workspace Colors (per-project)
**Purpose:** Give each open project its own color on the workspace badge — the ONE chromatic touch in an otherwise neutral (zero-accent, Cursor-style) chrome. Right-click a workspace icon → popover to pick from a premium palette or clear it. Color is an accent (faint tint + side trace), never a full fill.
**Stack:** React 19, TypeScript strict, localStorage, CSS `color-mix()`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/workspaceColors.ts` | `WORKSPACE_COLORS` palette, `get/setWorkspaceColor`, `subscribeWorkspaceColors`; localStorage map + pub/sub |
| Component | `src/components/WorkspaceColorPopover.tsx` | Right-click popover: swatch grid + "No color"; portals to body |
| Component | `src/components/ActivityBar.tsx` | Editor-mode workspace icons: context menu → popover, applies `--ws-color` |
| Component | `src/components/AgentModeShell.tsx` | Agent-mode workspace rail: same context menu + color application |
| Config | `src/App.css` | `.ws-icon.has-color` / `.agent-wsrail-icon.has-color` (color-mix tint) + `.ws-color-*` popover styles |

### Data Flow
- **Set color:** right-click icon → `setColorMenu({wsId,x,y})` → `WorkspaceColorPopover` → `setWorkspaceColor(wsId, colorId)` → localStorage `lcp.ws.colors` → `notify()` → both bars re-render
- **Apply color:** `getWorkspaceColor(wsId)` → inline `style={{ '--ws-color': hex }}` + `.has-color` class → CSS `color-mix(in srgb, var(--ws-color) N%, surface)` for tint + side trace
- **Reactivity:** `subscribeWorkspaceColors` (pub/sub like `aiTaskStore`) ticks a `useState` in both ActivityBar and AgentModeShell

### Palette (`WORKSPACE_COLORS`) — 18 hues, 4-col grid
| id | hex | id | hex | id | hex |
|----|-----|----|-----|----|-----|
| blue | #3b82f6 | indigo | #6366f1 | sky | #0ea5e9 |
| cyan | #06b6d4 | teal | #14b8a6 | emerald | #10b981 |
| green | #22c55e | lime | #84cc16 | yellow | #eab308 |
| amber | #f59e0b | orange | #f28c52 (signature) | red | #ef4444 |
| rose | #f43f5e | pink | #ec4899 | fuchsia | #d946ef |
| violet | #8b5cf6 | purple | #a855f7 | slate | #64748b |

### State
- `lcp.ws.colors`: `Record<wsId, colorId>` — persisted color map (localStorage, global)
- `colorMenu`: `{ wsId, x, y } | null` — open popover target (component, in both bars)

### Drag-to-reorder (activity bar)
- The open-workspace icons reorder by **native HTML5 drag-and-drop** (no library). `ActivityBar` tracks `dragIndex`/`dragOverIndex`; `onDrop` calls `store.reorderWorkspaces(from, to)`.
- `reorderWorkspaces` splices `openIds` and `persistIdx()`s — the new order survives reload (persisted in Rust `workspaces.json` `open_ids`, unlike colors which are localStorage).
- CSS: `.ws-icon.dragging` (fade) + `.ws-icon.drag-over` (top insertion line). `e.dataTransfer.setData("text/plain", id)` is set so Firefox starts the drag.

### Notes / gotchas
- Persistence is **frontend localStorage**, not Rust `workspace.json` — keeps it light, no IPC. Survives reloads; not synced across machines (acceptable).
- Right-click on a workspace **icon** opens colors; right-click on the activity-bar **background** still flips the sidebar side (unchanged).
- `color-mix()` requires a modern engine — fine on Tauri's WebKit; would need a fallback only for very old browsers.
