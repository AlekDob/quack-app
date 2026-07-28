---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-23
tags: [workspace, colors, palette, popover, activity-bar, agent-rail, topbar, theming, disk-persistence]
---

## Workspace Colors (per-project)
**Purpose:** Give each open project its own color — the ONE chromatic touch in neutral (Cursor-style) chrome: workspace badges, agent-rail dots, hub badges, **title-bar ambient wash**, and the project name tint in the top bar.
**Stack:** React 19, TypeScript strict, Rust/Tauri disk persistence (`colors.json`), CSS `color-mix()` + `rgba(var(--ws-color-rgb), α)`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/workspaceColors.ts` | `WORKSPACE_COLORS`, `get/setWorkspaceColor`, `hydrateWorkspaceColors`, `subscribeWorkspaceColors`, `hexRgbChannels`; RAM cache + disk persistence + pub/sub |
| Backend | `src-tauri/src/workspace.rs` | `workspace_colors_load`/`workspace_colors_save` commands → `colors.json` in app data dir (atomic write) |
| IPC | `src/ipc.ts` | `workspaces.loadColors`/`workspaces.saveColors` |
| Component | `src/components/WorkspaceColorPopover.tsx` | Right-click popover: New chat / Reveal in Finder|Explorer / Copy path + swatch grid + "No color"; portals to body |
| Component | `src/components/ActivityBar.tsx` | Editor-mode workspace icons: context menu → popover, applies `--ws-color` |
| Component | `src/components/TopBar.tsx` | Active workspace: `--ws-color` + `--ws-color-rgb` on `.topbar.has-ws-color` |
| Component | `src/components/AIChatsRail.tsx` | Hub row badges: `--ws-color` on project initials |
| Config | `src/App.css` | `.ws-icon.has-color`, `.topbar.has-ws-color::before`, `.topbar-brand-project.has-color`, `--topbar-ws-tint-*` |

### Data Flow
- **Set color:** right-click icon → `setColorMenu({wsId,x,y})` → `WorkspaceColorPopover` → `setWorkspaceColor(wsId, colorId)` → mutates in-RAM `cache` synchronously + `notify()` (instant UI) → async fire-and-forget `workspaces.saveColors(cache)` writes `colors.json` on disk
- **Boot hydrate:** `store.ts` `hydrate()` calls `hydrateWorkspaceColors()` once `recent`/`loaded` are populated (root resolution needs them) → loads `colors.json`, migrates any legacy `lcp.ws.colors` localStorage map into it (one-time, then removes the old key), `notify()`s so bars repaint if colors arrived after first paint
- **Badge tint:** `getWorkspaceColor(wsId)` → inline `style={{ '--ws-color': hex }}` + `.has-color` → CSS `color-mix(in srgb, var(--ws-color) N%, surface)` for faint fill + side trace
- **Title bar wash:** `TopBar` → `hexRgbChannels(hex)` → `--ws-color-rgb` on `.topbar` + class `has-ws-color` → `::before` dual radial-gradient (faint left bloom, stronger right bloom toward project name); same in dev and production
- **Reactivity:** `subscribeWorkspaceColors` (pub/sub like `aiTaskStore`) ticks `useState` in bars + TopBar

### Surfaces (where color appears)
| Surface | Mechanism | When |
|---------|-----------|------|
| Activity bar icon | `.ws-icon.has-color` + `color-mix` tint / active full fill | Per open workspace |
| Top bar project name | `.topbar-brand-project.has-color` → `color: var(--ws-color)` | Active workspace with color |
| **Top bar background** | `.topbar.has-ws-color::before` radial gradients | Active workspace with color |
| Agent Hub row badge | `.agent-hub-ws-badge.has-color` | Session's workspace |

### Title bar gradient
- **Trigger:** active workspace has a color in `lcp.ws.colors`; no color → neutral glass topbar only
- **Layering:** frosted `--glass-bg` on `.topbar`; `::before` pseudo sits under children (`z-index: 0`); controls/brand at `z-index: 1`
- **Shape:** two radial gradients — ~10% from left (weak), ~92% from right (stronger, toward project name)
- **Theme tokens** (tune intensity without touching component code):

| Token | Dark | Light |
|-------|------|-------|
| `--topbar-ws-tint-left` | `0.07` | `0.05` |
| `--topbar-ws-tint-right` | `0.16` | `0.11` |

- **Dev vs prod:** identical wash; dev-only chrome (DEV badge, warn border, `[DEV]` title) lives in `features/047-dev-build-indicator.md` — not mixed into the gradient

### Key Functions
- `getWorkspaceColor(wsId) → WorkspaceColor | null` — resolve palette entry (sync, reads RAM cache)
- `setWorkspaceColor(wsId, colorId | null) → void` — mutate cache + notify (sync); persist to disk (async)
- `hydrateWorkspaceColors() → Promise<void>` — boot-time disk load + legacy localStorage migration
- `hexRgbChannels(hex) → "r, g, b" | null` — CSS custom property for `rgba(var(--ws-color-rgb), α)`

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
- `colors.json` (app data dir): `Record<normalizedRoot, colorId>` — persisted color map, disk, global
- In-module `cache`: same shape, RAM mirror of disk — what `getWorkspaceColor` actually reads
- `lcp.ws.colors` (legacy): old localStorage map, read once at boot for migration then deleted
- `colorMenu`: `{ wsId, x, y } | null` — open popover target (component, in both bars)
- `--ws-color` / `--ws-color-rgb`: inline on elements (component scope, not persisted)

### Related
- Drag-to-reorder icons: [012-workspace-reorder.md](012-workspace-reorder.md)
- Top bar layout / command center: [003-design-system.md](003-design-system.md) § Top bar
- Dev build badge (orthogonal): [047-dev-build-indicator.md](047-dev-build-indicator.md)

### Notes / gotchas
- Persistence is **disk** (`colors.json` via Tauri, atomic write), not localStorage — fixes a real prod bug where a full localStorage quota (shared with legacy chat cache) silently broke color persistence and surfaced "Couldn't save the workspace color — local storage may be full." Read path stays synchronous via a RAM cache hydrated at boot, so no render-path API changed.
- Legacy `lcp.ws.colors` localStorage map is migrated into `colors.json` on first boot after this change, then deleted — existing colors are not lost
- Right-click workspace **icon** → actions (New chat / Reveal in Finder|File Explorer / Copy path) + colors; right-click activity-bar **background** → flip sidebar side (unchanged)
- Reveal uses `@tauri-apps/plugin-opener` `revealItemInDir(root)` (same as file-tree); label is macOS-aware via `IS_MACOS`
- Copy path writes the absolute `meta.root` to the clipboard
- `color-mix()` + `rgba(var(--ws-color-rgb))` need a modern engine — fine on Tauri's WebKit
- macOS: native menu bar hides in-window brand/menus; title-bar wash still spans the drag region + Agents toggle
- No wash when color is cleared ("No color" in popover) — by design

### Verify
1. Right-click project icon → pick Blue → top bar shows faint blue wash; project name turns blue
2. Switch to a project with no color → top bar returns to neutral glass
3. Toggle Light/Dark → wash stays subtle (light uses lower `--topbar-ws-tint-*`)
4. `npm run tauri dev` → same gradient as release; DEV badge/border unchanged
