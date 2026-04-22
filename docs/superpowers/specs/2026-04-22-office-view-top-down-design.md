---
type: spec
project: quack-app
feature: office-view-v2
created: 2026-04-22
stack: React 18 + TypeScript strict + SVG + HTML/CSS + Tauri v2
supersedes: documentation/features/045-office-view.md
tags: [office, top-down, whiteboard-style, zones, cards, tags, floor-plan, drag, svg, no-pixijs]
---

# Office View v2 — Top-Down Floor Plan

## Context & Motivation

The existing Office View (see `documentation/features/045-office-view.md`) renders a
fixed-grid isometric workspace using PixiJS v8 / @pixi/react. Rooms are laid out by
`computeRoomPositions()` (compact rectangular grid). The user cannot reposition them.

At scale this breaks down:

- Quack users range from ~5 to 20+ concurrent projects (Alek runs 15+, other users
  5-10). A fixed auto-grid offers no logical or visual ordering.
- The 3D isometric metaphor is pretty but imposes heavy rendering (PixiJS WebGL),
  ongoing workarounds (`pixi.js/unsafe-eval` for CSP, a `destroy()` patch for a
  @pixi/react race, GPU texture cleanup), and non-trivial bundle size.
- The user wants a **top-down floor plan** with **draggable rooms** (matching the
  mental model of the Feature Map Whiteboard — `documentation/features/026-feature-map-whiteboard.md`),
  and a structure that scales to 20+ projects.

**Goal:** reimagine Office View as a draggable top-down workspace, keeping the
"office" identity through zones (wings/floors) and subtle room-plate styling,
while dropping the PixiJS engine entirely in favour of SVG + HTML/CSS.

## Scope

This spec covers the full v1 (= P1 + P2 in migration path). No phased design doc;
phased **shipping** is detailed in §8.

**In scope**

1. Top-down rendering of projects as room cards (option C from brainstorming) with
   subtle "room" styling — door-plate header, thin wall-corner cues (option H1).
2. **Workspace Zones** (labeled containers: "C&C Wing", "Personal", "Consulting")
   that act as visual floors (option H2).
3. **Tag filter** bar at top — orthogonal to zones; dims non-matching rooms (option D).
4. **Drag to reposition**: cards, zones, zones-with-children; drag-into-zone to
   assign `zoneId`.
5. **Floor Plan Overlay (H3)**: double-click a room card to open a zoom-in modal
   showing top-down desks + seated duck avatars for that project.
6. **Break Room** preserved as a special always-present zone with flat top-down
   furniture.
7. **Persistence** in a global user file (`~/.quack/office-layout.json`).
8. **Auto-migration**: first open of v2 derives default tags/zones from existing
   project cwds.
9. Full PixiJS removal, including dependency cleanup and related gotcha docs.

**Out of scope**

- Multi-user / shared layouts. Layout is per-machine.
- Mobile / remote dashboard rendering (future work).
- Real-time collaborative drag (no CRDT, last write wins).
- Tag auto-inference beyond the cwd heuristic (no language/stack detection in v1).
- Animated transitions between overview and floor-plan overlay (fade-in only).
- Editing agents from Office View (still done from sidebar / chat).

## User-visible behaviour

1. User opens Office View tab. The canvas shows all projects as rooms arranged
   in zones. Break Room sits somewhere on the canvas (always present).
2. User drags a room card to a new position. It either drops inside a zone
   (`zoneId` set) or floats outside any zone.
3. User drags a zone: zone + its rooms move together.
4. User resizes a zone using its corner handles.
5. User clicks a tag in the top filter bar. Non-matching rooms dim to 30% opacity;
   matching rooms stay vivid.
6. User double-clicks a room card. A full-viewport Floor Plan Overlay opens,
   showing top-down desks + seated duck avatars for that specific project.
7. Clicking a duck (either in the overview card OR in the floor plan overlay)
   opens the action menu (agent details + session list + "Vai alla Chat").
8. User pans with middle-click-drag or space-drag; zooms with scroll wheel;
   `Cmd+1` fits everything into the viewport.
9. On app reopen, the same layout, zones, and active tag filters are restored.

## Architecture

### File layout (new)

```
src/components/office/
├── OfficeView.tsx              — root container (tab view, toolbar, viewport, minimap)
├── OfficeCanvas.tsx            — SVG root with pan/zoom <g>; renders zones
├── OfficeRoomCard.tsx          — HTML-overlay card per project (H1 + C)
├── OfficeZone.tsx              — SVG zone rect + label + resize handles (H2)
├── OfficeDuckAvatar.tsx        — CSS-animated avatar (bobbing, session dots, particles)
├── OfficeBreakRoom.tsx         — special always-present zone with flat top-down furniture
├── OfficeFloorPlanOverlay.tsx  — full-viewport zoom-in modal (H3)
├── OfficeTagFilter.tsx         — top-bar filter pills (D)
├── OfficeActionMenu.tsx        — HTML portal menu on duck click (ported from v1)
├── OfficeMinimap.tsx           — minimap (mirrors Whiteboard pattern)
├── officeLayout.ts             — pure layout math (packRoomsInZone, defaultZonePositions, autoLayout)
├── officeStorage.ts            — Tauri-backed read/write of ~/.quack/office-layout.json
├── officeMigration.ts          — auto-migration from terminals[] on first v2 load
├── officeTypes.ts              — shared types
└── OfficeView.css              — styles (design tokens, glass, CSS keyframes)
```

Each file target: ≤ 300 lines (per project 4 Laws). Functions ≤ 20 lines.

### Files removed

```
src/components/office/OfficeScene.tsx
src/components/office/OfficeRoom.tsx
src/components/office/OfficeDuck.tsx             (PixiJS version)
src/components/office/OfficeBreakRoom.tsx        (PixiJS version — rewritten as above)
src/components/office/OfficeRoomLabel.tsx
src/components/office/OfficeBreakRoomLabel.tsx
src/components/office/OfficeTooltip.tsx
src/components/office/useAvatarTexture.ts        (GPU texture clipping)
```

Dependency removals from `package.json`: `pixi.js`, `@pixi/react`.

Gotcha docs to archive (see §8): `pixi-csp-unsafe-eval`, PixiJS destroy patch comments in code.

### Data flow

```
~/.quack/office-layout.json  ⇄  officeStorage  ⇄  useOfficeLayout hook
                                                         │
terminals[] (Zustand)  ───────┐                         │
sessionStore.sessions  ───────┼──► OfficeView  ◄────────┘
chatStore.pending…     ───────┘        │
                                       ▼
                              ┌────────┴────────┐
                              │                 │
                        OfficeCanvas   OfficeFloorPlanOverlay
                              │                 │
                              ├── OfficeZone    └── (desks + ducks)
                              ├── OfficeRoomCard
                              │    └── OfficeDuckAvatar ×N
                              └── OfficeBreakRoom
```

Mount: OfficeView reads terminals + sessions (Zustand) and the layout file (Tauri).
On mount it reconciles: for every project in terminals without a corresponding
RoomCard record, it runs `officeMigration.ensureRoom(projectPath)` which creates
a RoomCard with default tags and drops it into the matching zone (or floats it).

## Data model (`officeTypes.ts`)

```ts
export type TagSource = 'auto' | 'manual';

export interface OfficeTag {
  id: string;              // 'personal' | 'cc' | 'consulting' | user-created
  label: string;           // display name
  color: string;           // hex — pill + card accent
  source: TagSource;
}

export interface OfficeZone {
  id: string;              // uuid
  label: string;           // "C&C WING · FLOOR 1"
  color: string;           // border + gradient base
  x: number; y: number;    // canvas coords (top-left)
  w: number; h: number;
  tagId?: string;          // optional sync with a tag for colour + filter propagation
}

export interface OfficeRoomCard {
  projectPath: string;     // cwd — primary key (matches TerminalInfo.cwd)
  x: number; y: number;    // canvas coords (top-left)
  w?: number; h?: number;  // optional override; defaults from CARD_DEFAULT_W/H
  zoneId?: string;         // null/undefined = floating (no zone parent)
  tagIds: string[];        // cross-cutting; independent from zoneId
}

export interface OfficeLayout {
  version: 1;
  zones: OfficeZone[];
  rooms: OfficeRoomCard[];  // one per project currently in terminals (reconciled on every mount)
  tags: OfficeTag[];
  activeTagIds: string[];  // persisted filter state
  breakRoom: { x: number; y: number };
}
```

Constants (in `officeLayout.ts`):

```
CARD_DEFAULT_W = 220   CARD_DEFAULT_H = 140
ZONE_MIN_W = 260       ZONE_MIN_H = 180
ZONE_PADDING = 16
FLOOR_PLAN_OVERLAY_MAX_W = 1100   OVERLAY_MAX_H = 720
DRAG_THRESHOLD_PX = 4
WRITE_DEBOUNCE_MS = 500
```

## Rendering detail

### Canvas

SVG root with `<g transform="translate(panX,panY) scale(zoom)">`. Same pattern as
`FeatureMapCanvas`. Zones and the break-room rect render inside this `<g>` as SVG
primitives. Room cards render as an HTML overlay `<div>` above the SVG, applying
the same translate+scale via CSS `transform` so they stay pixel-aligned with SVG
zones under pan/zoom. This mirrors the Whiteboard MD Preview Cards approach
(chosen to avoid the WebKit foreignObject clipping bug documented in the
Whiteboard feature doc).

### Zone

```
<g className="office-zone">
  <rect x y w h
        fill={linear-gradient(135deg, color@6%, color@3%)}
        stroke={color@60%} stroke-dasharray="6 4"
        rx={8} />
  <text x={x+10} y={y+14}>{label.toUpperCase()}</text>
  {/* 4 corner resize handles (SVG circles, cursor nwse-resize) */}
</g>
```

### Room card (HTML overlay)

Structure:

```
<div class="office-room-card" style={{transform: translate(x,y)}}>
  <div class="door-plate">
    <span class="status-dot" style={{background: doorPlateColor}}/>
    <span class="project-name">{projectLabel}</span>
  </div>
  <div class="card-body">
    <div class="project-meta">{tagPillsInline} · <span class="branch">{branch}</span></div>
    <div class="avatar-stack">
      {ducks.slice(0,5).map(OfficeDuckAvatar)}
      {ducks.length > 5 && <span class="overflow">+{ducks.length-5}</span>}
    </div>
    <div class="status-counts">● 2 busy · ● 1 idle · ● 1 dormant</div>
    <div class="activity-bar"><div class="fill" style={{width: `${busyRatio*100}%`}}/></div>
  </div>
  <div class="wall-corner wall-corner-bl"/>
  <div class="wall-corner wall-corner-br"/>
</div>
```

Tag filter dims the card via `opacity: 0.3` when its `tagIds` doesn't intersect
any active tag, unless `activeTagIds` is empty (nothing filtered).

### Duck avatar

```
<div class="duck" style={{background: agent.color, animationDuration: bobSpeed(status)}}>
  <img src={avatarUrl} class="duck-img" />     // clip-path: circle(50%) via CSS
  {sessionDots.map((dot,i) =>
    <span class="session-dot" style={{transform: `rotate(${arc(i)}deg) translate(0,-R)`}} />
  )}
  {status === 'busy' && (
    <div class="typing-particles">
      <span/><span/><span/>
    </div>
  )}
</div>
```

Bobbing speed: `0.4s` (busy) / `2s` (idle) / `1.2s` (waiting). Session dot colours
(purple > yellow > green > gray) identical to v1 logic — migrated from
`getSessionDotHex()` in `OfficeView.tsx` (kept intact, moved to `officeLayout.ts`).

`doorPlateColor` (card header dot) = highest-priority session-dot colour across
all ducks of that project (same priority ladder: purple awaiting > yellow working
> green ready > gray dormant). `busyRatio` for the activity bar = `busyDucks /
totalDucks`, clamped to `[0,1]`.

Avatar texture clipping moves from PixiJS offscreen canvas to CSS `clip-path:
circle(50%)` plus a 2.5px colored border. `useAvatarTexture.ts` is deleted.

### Break Room

An always-present `OfficeBreakRoom` zone rendered inline with the canvas, styled
differently (warm-toned gradient, teal accent), containing:

- 2 flat sofa rectangles (rounded top)
- TV rect with tiny glow dot
- Vending machine rect with 4 product dots

In the Floor Plan Overlay for Break Room, the same shapes render larger. No
isometric projection.

## Interactions

### Drag (card)

- `pointerdown` on door-plate → start tracking.
- `pointermove` past `DRAG_THRESHOLD_PX` → enter drag state, set `draggingCardId`.
- During drag: card follows cursor (via CSS `transform`); hit-test against zone
  rects on each move. Zone under cursor gets amber glow (same styling pattern as
  Whiteboard drag-assign-to-component).
- `pointerup`:
  - if over a zone → update `zoneId = thatZone.id`, snap position inside zone
    padding bounds.
  - else → `zoneId = undefined`, keep cursor position.
- Threshold below 4px → click, not drag → no action on card body (only on duck
  or explicit buttons).

### Drag (zone)

- `pointerdown` on zone label strip → start dragging the zone.
- All rooms with `zoneId === zone.id` move together (their `x,y` deltas mirror
  the zone's delta).
- `pointerup` → commit.

### Resize (zone)

- 4 corner handles (SVG `<circle>`) with matching cursors (`nwse-resize` / `nesw-resize`).
- Minimum size enforced: `ZONE_MIN_W × ZONE_MIN_H`.
- Rooms inside are NOT rescaled (their positions stay unchanged even if zone
  shrinks). If a room ends up outside the zone's new bounds, it stays in place
  visually but still retains `zoneId` — resolving this is deferred to a toolbar
  "Repack zone" action (v1 includes the button; clicking it re-runs
  `packRoomsInZone` on that zone).

### Tag filter

- Top bar shows pills for every tag in `layout.tags`.
- Clicking a pill toggles it in `activeTagIds`.
- Empty `activeTagIds` = no filter (all vivid).
- Non-empty: rooms with `tagIds.some(id => activeTagIds.includes(id))` stay vivid;
  others drop to `opacity: 0.3`.
- Filter state is persisted (users often want to reopen to their filtered view).

### Canvas shortcuts

| Shortcut | Action |
|----------|--------|
| middle-click drag, space+drag | pan |
| scroll wheel | zoom |
| Cmd/Ctrl+1 | zoom-to-fit |
| Cmd/Ctrl+0 | reset zoom to 1 |
| double-click on card | open Floor Plan Overlay for that project |
| shift+click on cards | multi-select |
| drag on multi-selected | group-move |
| Esc | close overlay / deselect / clear filter |

### Action menu

`OfficeActionMenu.tsx` ported from v1 unchanged except:

- Rendered via React Portal (not a PixiJS overlay).
- `onDuckClick` is a plain DOM click handler on the duck div (not a PixiJS event).
- Everything else identical: agent name + color dot, status, branch, session list
  with status dots, "Vai alla Chat" fallback.

## Persistence (`officeStorage.ts`)

- File path resolved via Tauri command `app_data_dir()` (already used elsewhere)
  + append `office-layout.json`.
- On mount (one-time): read file → parse → seed Zustand layout store. If file
  missing → run `officeMigration.bootstrap(terminals)` → write result → use it.
- Writes: debounced 500ms, atomic (write to temp file, rename). No hot-reload
  polling — Office is single-writer per machine.
- Schema versioning: `version: 1` at root. Any future change bumps and supplies
  a migrator in `officeMigration.ts`.
- Error handling: if read fails (corrupt JSON) → surface a toast, rename the
  file to `office-layout.json.corrupt-YYYY-MM-DD`, start fresh.

## Auto-migration (`officeMigration.ts`)

On first v2 load (no existing layout file):

1. Read `terminals[]` from the existing terminals source used by the sidebar
   and the v1 Office View (same prop wiring reused — `writing-plans` locks
   down the exact hook).
2. Infer tag for each project from its cwd:
   - path matches `Desktop/Dev/Personal/` → tag `personal`
   - path matches `Desktop/Dev/` (excluding Personal sub-tree) → tag `cc`
   - otherwise → tag `other`
3. Create one `OfficeZone` per distinct tag encountered, laid out horizontally
   starting at (0,0) with 40px gutters.
4. Create a `OfficeRoomCard` for each project, assigned to the matching zone,
   auto-laid-out inside via `packRoomsInZone`.
5. Default tags palette:
   - `personal` = `#c084fc` (purple)
   - `cc` = `#00D9FF` (Quack accent)
   - `consulting` = `#F7931E` (warning)
   - `other` = `#94a3b8` (slate)
6. Place Break Room at `(gridBottom + 40, 0)`.
7. Persist and return the new `OfficeLayout`.

On subsequent loads: reconcile `terminals[]` against `layout.rooms`:

- new project not in layout → create RoomCard via the same inference (falls into
  matching zone; no tag → `other`);
- project in layout but no longer in terminals → keep the card (user can delete
  manually via hover × button — deferred to v1.1 if not trivial);
- never destructively mutate the layout.

## Floor Plan Overlay (H3)

`OfficeFloorPlanOverlay.tsx`

Triggered by double-click on `OfficeRoomCard`. Renders as a React Portal modal,
z-index above the canvas. Not a route — controlled by `floorPlanProject: string |
null` state in `OfficeView`.

Content:

- Top bar: project name (bold), branch, close (×) button. Click outside or Esc
  closes.
- SVG body (1100 × 720 max; scroll if content overflows):
  - Desks as rounded rects `64 × 40`, flat top-down. Columns: `ceil(sqrt(agents))`.
  - Duck avatars positioned in front of each desk (same CSS animations as overview).
  - Agent label below each desk.
- Clicking a duck opens the existing Action Menu inside the overlay.
- Break-Room special-case: show the 2 sofas, TV, vending machine rendered larger
  and arranged in a simple floor layout. No seated ducks.

Overlay can coexist with the overview underneath (dimmed via backdrop
`rgba(0,0,0,0.6)`), so closing returns the user to the exact canvas state.

## Testing

Unit tests (Vitest):

- `officeLayout.test.ts` — `packRoomsInZone`, `defaultZonePositions`,
  `inferTagFromPath`, `sessionDotColor` (ported).
- `officeMigration.test.ts` — first-load bootstrap; reconcile with added/removed
  project; idempotency (running twice produces the same layout).
- `officeStorage.test.ts` — read/write round-trip, corrupt-file recovery,
  version-1 parsing.

E2E / manual verification (since UI-heavy):

- Open Office tab → overview renders from existing terminals.
- Drag a card from one zone into another → `zoneId` updates, persisted after
  reload.
- Toggle tag filter → non-matching cards dim; reload keeps the filter.
- Double-click card → floor plan overlay opens; Esc closes.
- Click duck in overlay → action menu opens; click session → navigates to chat
  (via existing `onSessionClick`).
- Resize window during drag → drag state doesn't break.

## Migration & release path

| Phase | Release | Scope |
|-------|---------|-------|
| P0 | same release as P1 | Feature flag `OFFICE_V2_ENABLED` (default `true`). Escape hatch: `localStorage.setItem('quack:forceOfficeV1', 'true')` forces v1 rendering for 1 release cycle |
| P1 | v0.9.4 (tentative) | Overview (zones + cards + ducks + tag filter + drag + persistence). Double-click shows "Floor plan overlay coming in v0.9.5" toast |
| P2 | v0.9.5 | `OfficeFloorPlanOverlay` shipped |
| P3 | v0.9.6 | Delete v1 PixiJS files, remove `pixi.js` + `@pixi/react` from `package.json`, archive gotcha docs (`gotcha-pixi-csp-unsafe-eval.md`, PixiJS destroy-patch references) |

Release-note template lines for each phase live in `documentation/diary/` under
the respective day.

Rollback plan: in P1 and P2, the escape-hatch localStorage flag and feature flag
allow reverting to v1 without a redeploy. In P3, if a post-release regression
appears, revert the deletion commit and re-publish. No data loss risk — v1 has
no persistence.

## Risks & open questions

1. **Drag-into-zone UX edge case**: dropping a card on a zone that is itself being
   dragged. Lock: disable zone hit-testing while a zone is the drag target.
2. **Pan/zoom performance** with 20+ room cards and CSS animations. Mitigation:
   all animations are GPU-accelerated (`transform`, `opacity`). Target: 60fps
   with 30 rooms. Revisit with `OfficePerformance.test` if needed.
3. **Avatar loading**: 20 cards × N agents each could mean 50+ `<img>` loads on
   mount. Leverage the existing Quack avatar cache (same URLs as v1); browser
   cache handles repeats.
4. **Tag palette uniqueness**: if a user manually adds many tags, palette
   collisions are possible. Deferred to v1.1 (tag editor UI).
5. **Break Room position persistence** vs resize: user may resize window and
   find Break Room off-screen. Mitigation: fit-to-content zoom-to-fit includes
   Break Room's bounds.

## Non-goals / deliberate omissions

- No tag editor UI in v1. Tags are bootstrapped from the cwd heuristic; manual
  tag creation/editing is v1.1.
- No multi-user sync. No CRDT. Single-writer local layout.
- No animated transitions between overview and floor-plan overlay (just fade-in).
- No keyboard-driven drag for cards (mouse/trackpad only).
- No undo/redo in v1. (Whiteboard has it; we may port later, tracked in open
  questions above.)

## References

- Current Office View feature doc: `documentation/features/045-office-view.md`
- Whiteboard feature doc (pattern source for pan/zoom, drag, HTML overlay, MD
  cards, multi-select): `documentation/features/026-feature-map-whiteboard.md`
- Existing gotchas referenced / retired:
  - `documentation/gotchas/gotcha-pixi-csp-unsafe-eval.md` (retire in P3)
  - `documentation/bugs/fix-memory-leak-14gb-ram.md` (WebGL texture leak — resolved by removal)

## Approval

Design approved by Alek on 2026-04-22 (brainstorming session).
Ready for transition to `writing-plans`.
