---
type: gotcha
project: quack-app
created: 2026-04-22
last_verified: 2026-04-22
tags: [css, layout, flex, height, canvas, zero-height, getBoundingClientRect, pan-zoom]
---

# CSS `flex: 1` silently fails when the parent isn't `display: flex`

## Symptom
A flex-sized container inside a non-flex parent collapses to its intrinsic height (often 0). Canvas/SVG fills using `height: 100%` or `inset: 0` then also render at 0px. `getBoundingClientRect()` returns `{ width: N, height: 0 }`, so:
- Fit-to-content logic that guards on `rect.height === 0` bails out → content never re-centers.
- Any child with `position: absolute; inset: 0` has no box to stretch into → invisible.
- Parents that look non-zero in DevTools may actually be the wrapper above, not the collapsing canvas.

## Root Cause
`flex: 1` / `flex-grow: 1` only take effect when the **immediate parent is a flex (or grid) container**. If the parent is the default `display: block`, the child's `flex` declaration is ignored entirely — no fallback, no warning. The child ends up with `height: auto` and collapses.

A common shape is:
```
.outer-view        (display: flex; flex-direction: column; height: 100%)
  .header-bar      (fixed height)
  .wrap            (flex: 1; min-height: 0)   ← is flex CHILD, but not itself flex
    .canvas        (flex: 1; min-height: 0)   ← BREAKS HERE — parent isn't flex
```
The first `.wrap` grows correctly because its parent `.outer-view` is flex. But `.wrap` itself is `display: block` unless explicitly set, so the inner `.canvas` cannot use `flex: 1`.

## Why it's sneaky
Toolbars and absolute-positioned decorations (`position: absolute; bottom: 20px`) anchor to the wrap's `position: relative` and still render correctly, so the layout looks fine at a glance. The *collapsed* element is usually a background canvas or SVG that has no visible edges until you inspect `getBoundingClientRect()` or add `outline: 1px solid red`.

## Fix
Either:
1. **Make the intermediate wrap a flex container too** — add `display: flex; flex-direction: column` to every link in the chain.
2. **Switch the child to absolute fill** — if the wrap is already `position: relative`, the child can be `position: absolute; inset: 0` and skip flex entirely. Less coupling, works regardless of the wrap's display type.

Option 2 is simpler when the child is the sole content of the wrap and the wrap's role is just to anchor overlays.

## Real-world occurrence
- `src/components/office/v2/OfficeView.css` (2026-04-22): `.office-canvas` had `flex: 1; min-height: 0` but its parent `.office-view__canvas-wrap` was only `position: relative; flex: 1` (flex child, not flex container). Canvas height collapsed to 0, `fit-to-content` useEffect bailed, no rooms rendered. Fixed by switching canvas to `position: absolute; inset: 0`.

## How to spot it quickly
- Inspect the supposedly-collapsed element in DevTools — check its computed height.
- Temporarily add `background: red` to the suspect child. If it doesn't show up, it's zero-height.
- Walk up the parent chain and verify every `flex: 1` child has a `display: flex` parent.

## Related
- Similar to the `overflow: hidden` + `min-height: 0` flex pitfall (without `min-height: 0` on a flex child, content can overflow rather than shrink) — often tangled with this one in the same debugging session.
