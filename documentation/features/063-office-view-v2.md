---
type: feature-doc
project: quack-app
stack: TypeScript strict (React 18 frontend), Tauri v2 invoke API (read_file_content, write_file_content, get_home_directory, rename_file)
created: 2026-04-22
last_verified: 2026-04-22
tags: [office, office-v2, whiteboard, annotations, post-it, sticker, custom-group, undo-redo, toolbar, svg, layout]
---

## Office View v2
**Purpose:** Top-down 2D office metaphor rendering all active project "rooms" with duck agents inside. Replaces the PixiJS-based v1. SVG + HTML overlay pan/zoom canvas with a floating toolbar for annotations: post-its, custom groups, and decorative stickers (plant, desk, sofa, etc.). Undo/redo, tag filter dimming, single-file JSON persistence.
**Stack:** React 18 + TypeScript strict + Tauri v2 (pure SVG/HTML — no PixiJS, zero WebGL).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Model/Type | `src/components/office/v2/officeTypes.ts` | OfficeLayout (v2), OfficeRoomCard, OfficeTag, OfficeCustomGroup, OfficePostIt, OfficeSticker, Viewport |
| Constants | `src/components/office/v2/officeConstants.ts` | grid origin/gap, post-it colors + defaults, group mins, sticker min, undo stack max, default tags |
| Service | `src/components/office/v2/officeLayout.ts` | `inferTagFromPath`, `packRoomsInGrid`, `projectNameFromPath`, `sessionDotColor` |
| Service | `src/components/office/v2/officeMigration.ts` | `bootstrapLayoutFromTerminals`, `reconcileLayoutWithTerminals`, `normaliseLayout` (v1→v2 auto-migration) |
| Service | `src/components/office/v2/officeStorage.ts` | `readOfficeLayout` / `writeOfficeLayout` backed by `~/.quack/office-layout.json`, corrupt-file quarantine |
| Service | `src/components/office/v2/officeViewModels.ts` | `buildViewModels` — derives ducks/doorPlate/busyRatio/counts per project from store shapes (Map keyed by sessionId) |
| Catalog | `src/components/office/v2/officeStickerCatalog.tsx` | `STICKER_CATALOG` (plant, desk, chair, sofa, bookshelf, coffee-machine, water-cooler, rug, printer, window) + `getStickerDef` |
| Component | `src/components/office/v2/OfficeView.tsx` | Root view — composes tag filter + canvas + toolbar + action menu + reset confirm modal; owns mode/activeSticker state; wires Cmd+Z/Cmd+Shift+Z |
| Component | `src/components/office/v2/OfficeCanvas.tsx` | SVG + HTML overlay pan/zoom canvas; dispatches create-on-click per mode; single `annotRef` handles drag/resize/rotate of post-its, groups and stickers via tagged union |
| Component | `src/components/office/v2/OfficeToolbar.tsx` | Floating bottom-center toolbar — 4 modes (select/postit/group/sticker) + sticker sub-picker grid + undo/redo buttons; shortcuts 1-4 + Esc |
| Component | `src/components/office/v2/OfficeRoomCard.tsx` | HTML-overlay room card: door plate with project name, tag pills, branch, duck grid, activity bar |
| Component | `src/components/office/v2/OfficeDuckAvatar.tsx` | Agent avatar with session-dot arc (awaiting/working/ready/dormant) and busy/waiting/idle bobbing animations |
| Component | `src/components/office/v2/OfficePostIt.tsx` | HTML overlay post-it: draggable header, double-click to edit, Cmd+Enter commit, Esc cancel, 6-color cycle, delete on hover |
| Component | `src/components/office/v2/OfficeCustomGroup.tsx` | SVG rect with dashed border, editable label, drag body, 4-corner resize, delete-on-hover |
| Component | `src/components/office/v2/OfficeSticker.tsx` | SVG sticker with drag/resize(aspect-lock)/rotate handles (hover-visible); renders via catalog lookup |
| Component | `src/components/office/v2/OfficeTagFilter.tsx` | Tag pills (dim filter) + "+" create new tag + "×" delete tag on hover + Reset layout button |
| Component | `src/components/office/v2/OfficeRoomContextMenu.tsx` | Portal-based right-click menu for rooms: toggle tag assignment + inline "new tag" create |
| Component | `src/components/office/v2/OfficeActionMenu.tsx` | Ported from v1 — portal menu near clicked duck listing active sessions; goto chat / session click |
| Component | `src/components/office/v2/OfficeView.css` | All CSS for v2 components |
| Hook | `src/components/office/v2/useOfficeLayout.ts` | Layout state + debounced write + CRUD (rooms/postIts/customGroups/stickers) + undo/redo with drag-coalescing |
| Hook | `src/components/office/v2/useOfficeDrag.ts` | Room-card drag with threshold (canvas-to-screen coords via viewport) |
| Feature flag | `src/components/office/v2/featureFlag.ts` | `isOfficeV2Enabled()` — defaults ON, override with localStorage key `quack:forceOfficeV1` |
| Wrapper | `src/views/OfficeTabView.tsx` | Dispatcher between v1 (PixiJS) and v2 based on flag |

### Data Flow
`terminals` (from `App.tsx`) → `useOfficeLayout` reads `~/.quack/office-layout.json` (normaliseLayout handles v1→v2) → bootstraps a 4-col grid if missing → reconciles new projects as extra rooms → `buildViewModels` (sessions + chatStore maps → `DuckViewModel[]`) → `OfficeCanvas` renders SVG annotations + HTML overlays under a single `translate(pan) scale(zoom)` transform.

### Schema v2
```ts
OfficeLayout {
  version: 2,
  rooms: OfficeRoomCard[],       // one per distinct cwd, grid-packed initially
  tags: OfficeTag[],             // { id, label, color, source }
  activeTagIds: string[],        // dim filter
  customGroups: OfficeCustomGroup[],
  postIts: OfficePostIt[],
  stickers: OfficeSticker[],     // { kind: catalog id, rot: degrees }
}
```

### Migration from v1
- v1 persisted `zones[]` + `breakRoom{x,y}` + `rooms[].zoneId`. All three dropped by `normaliseLayout` on first read; the caller (`readOfficeLayout`) writes the normalised v2 back on the next debounce (after any change). No quarantine — malformed JSON still gets renamed to `.corrupt-YYYY-MM-DD.json`.
- Room positions are preserved verbatim during migration; users keep whatever custom placement they had.

### Toolbar Modes
| Mode | Shortcut | Behaviour |
|------|----------|-----------|
| Select | `1` | Default — drag card plates, click ducks, drag/resize/rotate existing annotations |
| Post-it | `2` | Click canvas → create 160x120 post-it at point → auto-exit to select |
| Group | `3` | Click-drag canvas → preview rect → release creates custom group (min 160x120) → auto-exit to select |
| Sticker | `4` | Open sub-picker (10 kinds in 5-col grid) → click canvas places sticker, stays in mode for multi-placement → Esc to exit |
| Undo | `Cmd+Z` | Revert last action |
| Redo | `Cmd+Shift+Z` | Re-apply |

### Undo / Redo
- Past/future stacks held in refs inside `useOfficeLayout`; `historyVersion` state forces re-render of `canUndo`/`canRedo` booleans.
- `draggingRef` flag (toggled via `beginDrag` / `endDrag` called from `OfficeCanvas` drag starters / pointerUp) prevents per-move writes from bloating the stack — single snapshot taken at drag start.
- Keyboard handler in `OfficeView` (guarded against editable targets) dispatches Cmd+Z / Cmd+Shift+Z.
- Stack capped at `UNDO_STACK_MAX = 50`.

### Canvas Pan / Zoom
- Middle-click drag = pan
- `Space + left-drag` = pan (cursor: grab/grabbing)
- Wheel = zoom (MIN 0.3, MAX 2.0)
- Cmd+0 = reset viewport; Cmd+1 = zoom 0.8 / pan 50,50

### Annotation Interaction
All three annotation kinds go through a single `annotRef` tagged-union state in `OfficeCanvas`:
```
postit-move | group-move | group-resize(corner) | sticker-move | sticker-resize | sticker-rotate
```
`onPointerMove` branches on `kind` and calls the matching `onUpdate*` CRUD from the hook. Aspect-lock on sticker resize via stored `startW/startH` ratio. Sticker rotation uses `atan2(pt - center)` delta against the initial grab angle.

### Z-Order
bottom → top:
1. `customGroups` (SVG rects)
2. `stickers` (SVG, above groups)
3. `rooms` (HTML overlay)
4. `postIts` (HTML overlay, above rooms)
5. `OfficeToolbar` (fixed bottom-center, z-index 10)
6. `OfficeActionMenu` (portal on document.body)

### Tag Filter (Dim, not Hide)
- `activeTagIds: string[]` — when non-empty, rooms that do not include any active tag render with `opacity: 0.3` (class `office-room-card--dimmed`).
- Tags auto-populated on bootstrap from projects' inferred tag (`Personal` / `C&C` / `Consulting` / `Other` from `inferTagFromPath`); never displayed as "zones" (v1 auto-zones removed in v2).
- **User-created tags**: `+` button in the filter bar opens an inline form (name + 10-color palette). New tags get `source: 'manual'`. Hover on any pill to reveal `×` for deletion — removes the tag from all rooms and from `activeTagIds` in one atomic undo step.
- **Right-click on a room** opens `OfficeRoomContextMenu` (portal on `document.body`): lists all tags with checkboxes to toggle assign/unassign, plus an inline "New tag" form that creates the tag and assigns it to the clicked room.

### Group drag carries contained elements
- On `startGroupDrag`, the canvas hit-tests all rooms/postIts/stickers/other-groups by center-point against the group rect, snapshots their starting `x/y` into the `annotRef.children` array.
- `pointermove` applies the same `(dx, dy)` delta to the group AND each snapshotted child.
- Children set is frozen at drag-start — elements moved into the group mid-drag won't follow.
- Room moves inside a group drag go through `onRoomMoved` for history consistency (single undo step covers everything).

### Persistence
- Single file `~/.quack/office-layout.json` (schema v2). Written on debounce 500ms after any change.
- Read at first mount; corrupt or pre-v1 versions return `null` and trigger bootstrap from current terminals.
- v1 payloads silently migrated to v2 on read — no quarantine.

### Reset Layout
- Button in tag filter bar → `ConfirmModal` (not `window.confirm` — see gotcha `window-confirm-tauri-webview`) → `resetLayout()` in hook → re-runs `bootstrapLayoutFromTerminals` and overwrites the file. Clears all annotations.

### Sticker Catalog (10 items)
`plant, desk, chair, sofa, bookshelf, coffee-machine, water-cooler, rug, printer, window`. Each entry is a `StickerDef` with `{id, label, defaultW, defaultH, render()}`. Rendering is inline SVG (no image assets), center-anchored with a transparent hit-rect overlay for dragging.

### Feature Flag
- `isOfficeV2Enabled()` returns `true` unless `localStorage.getItem('quack:forceOfficeV1') === 'true'`.
- Dispatcher in `src/views/OfficeTabView.tsx`. v1 (PixiJS) remains available as fallback; will be removed once v2 is battle-tested.

### Tests (29 total across 3 files)
- `officeLayout.test.ts` — tag inference, grid packing, projectName helper, sessionDotColor priority.
- `officeMigration.test.ts` — bootstrap dedup, reconcile add/preserve/dedup/retroactive-dedup, normaliseLayout v1→v2.
- `officeStorage.test.ts` — round-trip read/write, v1 migration on read, corrupt-file rename.

### Known Limitations / Follow-ups
- No lasso multi-select (out of scope for this iteration).
- No `.whiteboard.json`-style agent bridge / polling — file is user-only (no external writers).
- Sticker rotate during very large pan offsets uses canvas-space angle math that may feel slightly off at extreme zoom levels; acceptable for now.

### Gotchas & Fixes (2026-04-22)
- **Canvas collapsed to 0px**: `.office-canvas` with `flex: 1` didn't expand because its wrap (`.office-view__canvas-wrap`) wasn't `display: flex`. Result: `getBoundingClientRect()` returned height 0, fit-to-content bailed, rooms never rendered. Fix: canvas uses `position: absolute; inset: 0` inside the relative wrap — no flex dependency. See `gotcha-css-flex-chain-broken.md`.
- **Empty canvas after v1→v2 migration**: rooms inherited `x/y` from v1 auto-zones (e.g. x ~ 1000-1900), default viewport `zoom 1 pan 0,0` missed them. Fix: auto fit-to-content on first mount (with `hasAutoFitRef` guard), `Cmd+1` re-fits.
- **Orphan rooms hidden**: `projectTerminals.length === 0` guard dropped any room whose cwd didn't match a live terminal. Now rooms always render (ducks/branch just empty). Prevents "invisible cards" when terminals arrive late or paths shift.
- **Empty-state CTA**: when `layout.rooms.length === 0`, a centered panel offers "Populate office" → re-bootstraps from current terminals. Useful if user reset layout while terminals were still loading.

### Keyboard Shortcuts (complete)
| Shortcut | Action |
|---|---|
| `1` / `2` / `3` / `4` | Toolbar mode: Select / Post-it / Group / Sticker |
| `Esc` | Back to Select mode |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / Redo |
| `Cmd+1` | Fit viewport to content |
| `Cmd+0` | Reset viewport (zoom 1, pan 0,0) |
| `Space + left-drag` | Pan canvas |
| Middle-click drag | Pan canvas |
| Wheel | Zoom (0.3–2.0) |

### UI Language
All user-facing strings in English.
