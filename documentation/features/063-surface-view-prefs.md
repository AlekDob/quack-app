---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-13
tags: [works, brain, team, drawer, activity-bar, settings, files]
---

# 063 — Surface view prefs (tab vs drawer)

**Purpose:** Activity-bar surfaces that open editor tabs (Works, Quack Brain, Team) can open in the **editor tab row** or the **right tab drawer** by default. User picks per surface in Settings → Views. File opens from Team subagent cards and tree → drawer drops use the same drawer host without stealing the main pane's active tab.

## Defaults

| Surface | Activity bar id | Default | Tab key |
|---|---|---|---|
| Works | `works` | **Drawer** | `works:{wsId}` |
| Quack Brain | `brain` | Editor tab | `brain:{wsId}` |
| Team | `whiteboard` | Editor tab | `wb:{wsId}` |

Stored in `localStorage` key `lcp.surfaceView` (global, not per-workspace).

## Open flow

`store.ts` → `openSingletonSurface()`:

1. Read `readSurfaceViewMode(viewId)`
2. **Drawer** — `moveTabToDrawer(wsId, tabKey)` (creates drawer slot if tab not in tree)
3. **Tab** — focus existing pane tab, dock from drawer if needed, or append to active pane

`worksOpen`, `brainOpen`, `wbOpen` all delegate here.

## File open in drawer (peek without tab switch)

`store.ts` → `openFileInDrawer(wsId, path)`:

| Step | Behaviour |
|---|---|
| 1 | `forgetClosedTab`; no-op if same key already in drawer with buffer |
| 2 | `bufferFileIfNeeded` — `readFile` into `ws.files` (or empty sentinel for media kinds) |
| 3 | `moveTabToDrawer(wsId, fileKey(path))` — never appends/activates in the main pane |

**Call sites:** `WhiteboardOrganigramma` (subagent card click → markdown preview), `fileComposerDrag` (explorer drop on right-edge drawer zone). Prefer this over `openFile` + `moveTabToDrawer` — the two-step sequence briefly activates the file in the editor tab row and caused a black main pane (Team hidden, file host not mounted yet).

**Drawer render gate:** `TabContentHost` no longer requires `editorsReady` for markdown files in the drawer (preview uses `MarkdownPreview`, not Monaco). Non-markdown files still defer until Monaco is ready.

## Settings UI

`SettingsModal.tsx` → **Views** section — segmented **Side drawer** / **Editor tab** per surface.

## Activity bar active state

`ActivityBar.tsx` passes `drawerTabKey` (`layout.editorDrawer.tabKey`) to `ActivityBarViewIcons` so icons stay highlighted when the surface lives only in the drawer.

## Manual override

Drag any tab to the editor's right 56px drop zone anytime (`PaneNode` → `moveTabToDrawer`) — independent of the default pref.

**Overlay drawer (2026-07-12):** the tab drawer is `position: fixed` (portal to `document.body`), full height from `--topbar-h` to bottom, `z-index: 900` — resizing does **not** shrink the editor or Agent Hub. Default width **75vw** (`defaultEditorDrawerW()` in `editorDrawer.ts`). Open/close slide animation (280ms) + light scrim; `drawerLinger` in `WorkspaceShell` keeps the drawer mounted until exit completes. Scrim uses `.editor-tab-drawer-scrim` overrides so global `button:hover` does not opaque it.

### Nested child drawers

When a surface opens in the side drawer, **child** drawers (work item, feature doc) must portal into the parent drawer, not only to `document.body`:

| File | Role |
|---|---|
| `editorDrawerStack.ts` | `registerEditorDrawerStack`, `drawerPortalTarget(wsId)`, `subscribeDrawerPortal` |
| `EditorTabDrawer.tsx` | Renders `.editor-drawer-nested-stack`; registers stack when shown |
| `FeatureDocDrawer.tsx`, `WorkItemDrawer.tsx` | Portal to nested stack when parent drawer open |

See `065-works-drawer-ux.md` for full behaviour.

## Key files

| File | Role |
|---|---|
| `src/surfaceViewPrefs.ts` | Read/write prefs, defaults, hook |
| `src/store.ts` | `openSingletonSurface`, `openFileInDrawer`, `bufferFileIfNeeded`, `moveTabToDrawer`, `*Open` actions |
| `src/components/SettingsModal.tsx` | Views section |
| `src/components/ActivityBarViewIcons.tsx` | Drawer-aware active icon |
| `src/components/TabContentHost.tsx` | Renders drawer tab content; relaxed `editorsReady` for markdown preview |
| `src/components/EditorTabDrawer.tsx` | Drawer chrome + nested stack host |
| `src/editorDrawerStack.ts` | Child-drawer portal target when parent drawer open |

## Related

- Works layer: `054-works-layer.md`
- Works drawer UX: `065-works-drawer-ux.md`
- Team organigramma subagent click: `018-whiteboard-organigramma.md`
