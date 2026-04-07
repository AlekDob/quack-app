---
type: bug
project: quack-app
created: 2026-04-06
last_verified: 2026-04-06
tags: [whiteboard, group-rect, canvas-image, resize, drag, svg]
---

# fix: Group/Image resize drops when mouse exits element

## Problem
`CanvasGroupRect` and `CanvasImage` used `onMouseMove`/`onMouseUp` on their `<g>` SVG element. When the user starts resizing via corner handles (small circles, r=4px), the mouse quickly exits the element's bounding box. The `onMouseLeave` handler then resets `resizeRef.current = null`, stopping the resize immediately. Same issue affected body drag.

## Root Cause (two layers)
1. **Mouse escape**: SVG mouse events only fire while cursor is over the target `<g>`. Small resize handles (r=4px) + fast movement = cursor exits element, `onMouseLeave` resets refs, resize stops.
2. **Stale closure kills listeners**: naive fix with `useCallback` + deps (zoom, group.x/y, onUpdate) causes `useEffect` cleanup to **remove window listeners on every re-render** during drag. First mousemove triggers onUpdate → re-render → `handleWindowMove` recreated → effect cleanup fires `removeEventListener(old ref)` → listener gone. Result: resize works for max 1 frame then dies.

## Fix
- `propsRef = useRef({zoom, onUpdate, ...})` updated on every render — window handlers read from ref, not closure
- `handleWindowMove` / `handleWindowUp` created with `useCallback(fn, [])` — stable identity, never recreated
- `useEffect` cleanup has `[]` deps — only fires on unmount, never removes listeners mid-drag
- `onMouseLeave` skipped when `dragRef` or `resizeRef` is active
- Applied to both `CanvasGroupRect.tsx` and `CanvasImage.tsx`

## Gotcha
**Never use `useCallback` with changing deps for window event listeners.** The `useEffect` cleanup will remove the old listener reference on every re-render, killing the interaction after 1 frame. Use a `useRef` for mutable values + stable `useCallback(fn, [])` instead.

## Files Changed
- `src/components/featureMap/CanvasGroupRect.tsx`
- `src/components/featureMap/CanvasImage.tsx`
