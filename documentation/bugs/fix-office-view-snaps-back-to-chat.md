---
type: bug
project: quack-app
created: 2026-03-05
last_verified: 2026-03-05
tags: [office, pixijs, event-propagation, tabs, navigation]
---
# Office view snaps back to Chat after opening

## Symptom
Opening the Office tab works momentarily, but within 1-2 seconds the view resets to the Chat tab automatically. Debug logging revealed the exact caller: `onRoomClick` in the PixiJS scene.

## Root Cause (confirmed via `[DEBUG-TAB]` wrapper)

PixiJS v8 `EventBoundary.mapPointerUp` has a critical behavior: it does NOT clean up `pressTargetsByButton` after a **normal click** (only cleans it for `pointerupoutside`). Combined with PixiJS listening for `pointerup` on `globalThis` (window level), this creates stale click events.

The full sequence:
1. User was in Office before, clicked on a room → PixiJS tracks `pressTarget = roomContainer` in `trackingData.pressTargetsByButton[0]`
2. User exited Office → `pointerup` fires → PixiJS dispatches `click` → `onRoomClick` navigates to chat
3. **BUG**: `pressTargetsByButton[0]` is NOT deleted after the normal click (only deleted for `pointerupoutside` path)
4. User opens Office again by clicking a DOM button → `pointerdown` fires on the button (NOT on the canvas — PixiJS only listens for `pointerdown` on `domElement`)
5. `pointerup` from releasing the button → PixiJS captures it from `globalThis` → `mapPointerUp` finds the **stale** `pressTarget = roomContainer` → hit test at pointer position → if mouse overlaps a room → `click` dispatched → `onRoomClick` → snap back to chat!

Key PixiJS v8 event listener setup (`EventSystem.mjs`):
```
this.domElement.addEventListener("pointerdown", ...) // canvas only
globalThis.addEventListener("pointerup", ...)         // window level!
```

Previous failed attempts:
- DOM `pointer-events: none` delay on parent div → doesn't work because PixiJS captures `pointerup` from `globalThis`, bypassing DOM pointer-events
- Temporal guard ref in `handleOpenOfficeTab` → stale closure issue in `useCallback`
- `interactionsReady` state with 400ms delay → same underlying problem

## Fix

Added a `pointerdown` guard in `OfficeRoom.tsx` on the room base container. The `onRoomClick` callback only fires if a genuine `pointerdown` was received on THIS canvas container first:

```tsx
const pointerDownOnRoom = useRef(false);

<pixiContainer
  eventMode="static"
  cursor="pointer"
  onPointerDown={() => { pointerDownOnRoom.current = true; }}
  onClick={() => {
    if (pointerDownOnRoom.current) {
      onRoomClick?.(room.projectPath);
    }
    pointerDownOnRoom.current = false;
  }}
>
```

This works because:
- `onPointerDown` only fires when `pointerdown` reaches the CANVAS (PixiJS listens on `domElement`)
- If `pointerdown` was on a DOM button (not canvas), `pointerDownOnRoom` stays false
- Stale `pressTarget` from previous interactions can't trigger `onRoomClick` without a fresh `pointerdown`

Also kept defense-in-depth from prior iterations:
- `specialTabTypes` arrays include `'office'` and `'automation'` (prevents tab removal on agent switch)
- Tab deduplication by `tab.id` in both `setTabs` effects

## Files Changed
- `src/components/office/OfficeRoom.tsx`: `pointerDownOnRoom` ref guard on base layer
- `src/views/OfficeTabView.tsx`: removed unnecessary `interactionsReady` pointer-events delay
- `src/App.tsx`: `specialTabTypes` arrays, tab dedup (kept from prior iteration)

## Related
- `gotcha-pixi-csp-unsafe-eval.md` — another PixiJS production gotcha
- `fix-office-webgl-shader-remount.md` — OfficeView must stay mounted (officeEverOpened ref)

## Prevention
**Any PixiJS component with `onClick` must guard against stale `pressTargetsByButton` data.** Use a `pointerdown` flag ref to verify the click sequence started on the canvas. This is especially critical for PixiJS containers that toggle visibility, because stale tracking data persists across visibility changes.
