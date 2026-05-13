---
type: feature-doc
project: quack-app
stack: TypeScript strict (React 18 frontend), Tauri v2 invoke API (read_file_content, write_file_content, get_home_directory, rename_file)
created: 2026-04-22
last_verified: 2026-05-12
tags: [office, office-v2, whiteboard, annotations, post-it, sticker, custom-group, undo-redo, toolbar, svg, layout, room-click, flip-transition, working-pulse, notebook-grid]
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
| Component | `src/components/office/v2/OfficeText.tsx` | HTML overlay "titoletto" — draggable, edit-on-double-click (auto-focus on spawn), A−/A+ to resize font, × to delete |
| Component | `src/components/office/v2/OfficeTagFilter.tsx` | Tag pills (dim filter) + "+" create new tag + "×" delete tag on hover + Reset layout button |
| Component | `src/components/office/v2/OfficeRoomContextMenu.tsx` | Portal-based right-click menu for rooms: toggle tag assignment + inline "new tag" create |
| Component | `src/components/office/v2/OfficeActionMenu.tsx` | **DISMESSO in v2 (2026-05-11)** — file conservato per fallback v1. Duck click ora va dritto a `onGoToChat(agentId)` senza menu intermedio. |
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
  texts: OfficeText[],           // { id, x, y, text, fontSize? } — titoletti
}
```

### Migration from v1
- v1 persisted `zones[]` + `breakRoom{x,y}` + `rooms[].zoneId`. All three dropped by `normaliseLayout` on first read; the caller (`readOfficeLayout`) writes the normalised v2 back on the next debounce (after any change). No quarantine — malformed JSON still gets renamed to `.corrupt-YYYY-MM-DD.json`.
- Room positions are preserved verbatim during migration; users keep whatever custom placement they had.

### Toolbar Modes
| Mode | Shortcut | Behaviour |
|------|----------|-----------|
| Select | `1` | Default — drag card plates, click ducks, drag/resize/rotate existing annotations |
| Lasso | `2` | Click-drag canvas → blue dashed rect → release selects all elements whose center is inside; auto-exits to Select. **Shortcut alternativa (2026-05-11)**: in `select` mode tieni premuto **Shift** e trascina su area vuota per disegnare il lasso senza cambiare tool. |
| Post-it | `3` | Click canvas → create 160x120 post-it at point → auto-exit to select |
| Group | `4` | Click-drag canvas → preview rect → release creates custom group (min 160x120) → auto-exit to select |
| Sticker | `5` | Open sub-picker (10 kinds in 5-col grid) → click canvas places sticker, stays in mode for multi-placement → Esc to exit |
| Text (titoletti) | `6` | Click canvas → spawn "Title" text at point with editor auto-focused → Enter to commit, Esc to cancel → auto-exit to select. Double-click to re-edit. A−/A+ buttons resize font (10-64px). |
| Undo | `Cmd+Z` | Revert last action |
| Redo | `Cmd+Shift+Z` | Re-apply |

### Lasso Multi-Select
- `selectedIds: Set<string>` in `OfficeView` state (ephemeral, not persisted). IDs use `"{kind}:{id}"` format where kind = `room|postit|sticker|group`.
- Blue outline / dashed rect render on every selected element. Toolbar shows a pill badge with the count.
- **Esc** clears selection.
- **Multi-element drag**: when a selected element is dragged in Select mode, the canvas snapshots positions of ALL other selected elements into `annotRef.siblings` (tagged union extended from single-element drag). During pointermove the same `(dx, dy)` is applied to every sibling → a single undo step covers the whole multi-move.
- Group drag (task 063 — move contained elements) and lasso drag (move explicitly selected) layer: the `children` set of a group-move is merged with the `siblings` set if the group itself is part of the selection.

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

### Notebook-Paper Grid Background (2026-05-12)
Lo sfondo del canvas (`.office-canvas`) ospita un layer `.office-canvas__grid` con un pattern di quadretti tipo pagina di quaderno. Il layer è posizionato `absolute; inset: 0; pointer-events: none` e renderizzato come primo figlio del container, **sotto** SVG e cards (z-ordering naturale via source order).

**Pattern**: doppio `linear-gradient` (orizzontale + verticale) con linee `rgba(255, 255, 255, 0.03)` da 1px su cella base **40px** (`GRID_BASE_PX = 40`).

**Pan sync (screen-space)**: la cella è **costante in CSS pixel** (no scaling col zoom). Solo `backgroundPosition` trasla via modulo cella:
- `backgroundSize = 40px 40px` (fisso).
- `backgroundPosition = ((panX % 40) + 40) % 40, idem panY`.

**Perché screen-space e non world-space?** Scalare `backgroundSize = 40 * zoom` produce dimensioni cella non-intere (zoom 0.73 → 29.2px) → le linee da 1px finiscono a sub-pixel → blur/moiré orribile a quasi tutti i livelli di zoom. Screen-space mantiene linee crispy a qualsiasi zoom (stesso approccio di Figma/Miro). Trade-off: la griglia non comunica il livello di zoom — accettabile, l'utente lo legge dal viewport.

**Wiring**: `GRID_BASE_PX = 40` definito in `OfficeCanvas.tsx`. Il layer è renderizzato `<div className="office-canvas__grid" style={gridStyle} />` come primo elemento del container, prima dello `<svg>`.

**Consistency**: stesso pattern (40px / alpha 0.03) usato anche nella Whiteboard (feature 026) per dare un'identità visiva uniforme tra Office View e Feature Map.

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

### Room Click → Whiteboard (2026-05-11)
**UX nuova:** la stanza è un entry-point di primo livello per la Whiteboard del progetto.

- **Single click sul corpo della room-card** (qualsiasi punto NON sull'header `__plate` e NON su un duck) → apre la Whiteboard del progetto della stanza (switch tab secco, nessuna animazione).
- **Click sul plate** (header) → invariato (avvia drag della card, `e.stopPropagation()` sopprime il click bubble).
- **Click su un duck** → naviga alla chat dell'agente (`onGoToChat(agentId)`), saltando il vecchio `OfficeActionMenu`. `e.stopPropagation()` nel duck button impedisce di triggerare anche l'apertura whiteboard.
- **Double-click sulla card** → identico al single click. Mantenuto per compatibilità con la prop `onCardDoubleClick` ereditata.
- **Right-click** → invariato (apre `OfficeRoomContextMenu` per gestione tag).

**Wiring:**
1. `OfficeRoomCard.onClick` → chiama `onCardClick(projectPath)`.
2. `OfficeCanvas` passa `onCardClick` come prop a ogni card.
3. `OfficeView.onOpenWhiteboard(projectPath)` viene chiamato dal canvas.
4. `OfficeTabView` propaga la prop ad App.
5. `App.handleOpenWhiteboardForProject(projectPath)` garantisce che il tab `feature-map` esista con `initialProjectPath = projectPath` (aggiorna se diverso) e attiva il tab.

**Gotcha fix correlato:** `FeatureMapTabView` ora riceve `projectPath = fmTab.initialProjectPath ?? activeTerminal?.cwd` (in `App.tsx`). Prima usava solo `activeTerminal?.cwd`, mostrando il progetto sbagliato quando si entrava nella whiteboard dalla stanza di un progetto inattivo.

### Copy / Paste / Duplicate (2026-05-11)
Shortcuts cross-platform (Mac/Windows: `metaKey || ctrlKey`) gestiti nel `useEffect` keydown di `OfficeView.tsx`. Operano sui 4 tipi annotation (postIts, customGroups, stickers, texts). Le rooms sono escluse — sono auto-managed.

| Shortcut | Azione |
|---|---|
| **Cmd+C** / Ctrl+C | Snapshot dei selection-keys correnti (filtrati per escludere `room:`). Resetta paste-offset. |
| **Cmd+V** / Ctrl+V | Clona via `duplicateItems(keys, off, off)` con offset crescente (no overlap su multi-paste). Seleziona i nuovi. Il clipboard avanza ai nuovi keys. |
| **Cmd+D** / Ctrl+D | Duplica direttamente i selezionati con offset +24/+24 senza toccare il clipboard. |

**Selezione di un titolo (`OfficeText`)**: click sul body del titolo lo seleziona (single replace); shift+click toggla in modalità additiva. Lasso multi-selezione include i texts (hit-test su center-point a `(x+40, y+fontSize/2)`).

**Alt-drag (Option+drag su Mac) per duplicare** stile Figma. Premere Alt durante un `pointerdown` su un post-it / custom group / sticker / titolo → l'elemento viene clonato in-place (offset 0,0), il drag che segue muove il clone (l'originale resta fermo). I 4 drag-starters in `OfficeCanvas` controllano `e.altKey` e chiamano `onDuplicateItems([key], 0, 0)` (cablato da `OfficeView`). Per il `group-move` con alt, i children/siblings non vengono trascinati (il clone è vuoto). Le rooms sono escluse.

**Implementazione**:
- `useOfficeLayout.duplicateItems(keys, offsetX, offsetY): string[]` clona i 4 tipi in un singolo `setWithHistory` (1 solo undo step). Parsa il formato `${kind}:${id}`, salta `room:`, ritorna i nuovi selection-keys.
- `OfficeText`: nuovo prop `onSelect(id, additive)` chiamato in `onPointerDown` (prima dello `onDragStart`).
- Filtro `INPUT/TEXTAREA/contentEditable` per non rubare la copia di testo quando si edita un titolo/post-it.

### Multi-select gestures (2026-05-12, finale)

| Gesto | Cosa fa |
|---|---|
| **Shift + drag su canvas vuoto** (mode `select`) | Disegna lasso → seleziona tutti gli elementi (rooms, postit, sticker, group, text) il cui center è dentro il rect |
| **Drag normale su canvas vuoto** (mode `select`) | Niente (no pan, no lasso). Per pan: middle-click o Space+drag |
| **Click semplice su canvas vuoto** | Deseleziona tutto (se c'è una selezione attiva). Verificato con drag-threshold `<4px` per non confondersi con un drag accidentale |
| **Mode `lasso` esplicita (tasto `2`)** | Lasso permanente — drag su canvas vuoto disegna lasso. Auto-exit a select dopo finalize |
| **Click su un elemento** | Drag = sposta l'elemento. Alt+drag = duplica-while-dragging (clone segue il cursore, originale resta fermo) |
| **Shift+click su un elemento** | Toggle additivo nella multi-selezione |

**Implementazione note**:
- Lasso state usa il **pattern useRef sincronizzato** (`lassoRef.current`) per evitare stale closure in `onPointerUp`. Vedi `documentation/bugs/fix-stale-closure-pointerup-lasso.md`. Brain breadcrumb in codice: `// Brain: fix-stale-closure-pointerup-lasso`.
- `emptyClickRef` salva la posizione del pointerdown su canvas vuoto in select mode. Al pointerup, se distanza `<4px` e selezione non vuota, deseleziona.
- `setPointerCapture` chiamato al pointerdown sul `currentTarget` (container div) per non perdere eventi se il cursore esce dal bounds dell'SVG.
- Hit-test del lasso usa il **center-point** di ogni elemento (più restrittivo del rect-intersect, ma più predictable per l'utente).

### Known Limitations / Follow-ups
- No Shift+click to toggle a single element in/out of selection — only lasso or Esc.
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
| `1` / `2` / `3` / `4` / `5` | Toolbar mode: Select / Lasso / Post-it / Group / Sticker |
| `Esc` | Back to Select mode |
| `Cmd+Z` / `Cmd+Shift+Z` | Undo / Redo |
| `Cmd+1` | Fit viewport to content |
| `Cmd+0` | Reset viewport (zoom 1, pan 0,0) |
| `Space + left-drag` | Pan canvas |
| Middle-click drag | Pan canvas |
| Wheel | Zoom (0.3–2.0) |

### Working pulse on room cards (2026-05-12)
Quando almeno un agente della stanza è in stato "Working" (P2 del Task Hub — `chatLoadingMap.get(sessionId) === true` OR ultimo messaggio `status === 'streaming'`), la `office-room-card` riceve la classe `office-room-card--working` e mostra uno sfondo gradient arancione (`#FF6B35` ~5-22% alpha) animato in loop a 6s (`@keyframes office-card-working-sweep`). Border arancione `rgba(255, 107, 53, 0.45)`.

**Wiring**:
- `OfficeRoomCard.tsx`: classe condizionale su `counts.busy > 0`. Il prop `counts` arriva già dal viewmodel `officeViewModels.ts:90` (`countsByProject`).
- `OfficeView.css`: keyframe + selettore `.office-room-card--working`.

**Comportamenti**:
- "Working batte dim": `.office-room-card--dimmed.office-room-card--working { opacity: 1; }` — l'animazione resta visibile a piena intensità anche se la card è fuori dal tag filter. Le card dimmed non-working restano a `opacity: 0.3` come prima.
- `prefers-reduced-motion: reduce` ferma l'animazione mantenendo il gradient statico (segnale visivo conservato senza oscillazione).
- Si compone con `--selected` (outline blu) senza conflitti.

**Source-of-truth unificata col Task Hub**: la stessa condizione di "Working" è valutata in `TaskHubView.tsx:156-157` per la priority P2 e in `officeViewModels.ts:20-37` per `sessionDots[i].working`. Card animata ⇔ sessione nel gruppo "Working" del Task Hub.

### UI Language
All user-facing strings in English.
