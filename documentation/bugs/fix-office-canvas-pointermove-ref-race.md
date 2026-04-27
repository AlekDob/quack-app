---
type: bug_fix
project: quack-app
created: 2026-04-27
last_verified: 2026-04-27
tags: [office-view, react-18, race-condition, useref, batching, crash, error-boundary]
---

# Fix: OfficeCanvas v2 crash — `null is not an object (evaluating 'M.current.panX')`

## Symptom

ErrorBoundary crash with stack trace `TypeError: null is not an object (evaluating 'M.current.panX')` in vendor chunk while user was panning/dragging the Office View v2 canvas (middle-click or space+drag). UI dies, requires reload.

`M.current` = minified `panStartRef.current`, nulled by `onPointerUp` while a pending `setViewport` updater still references it.

## Root Cause

`src/components/office/v2/OfficeCanvas.tsx` had this in `onPointerMove`:

```tsx
if (panning && panStartRef.current) {
  setViewport(v => ({
    ...v,
    panX: panStartRef.current!.panX + (e.clientX - panStartRef.current!.x),
    panY: panStartRef.current!.panY + (e.clientY - panStartRef.current!.y),
  }));
}
```

The guard `panStartRef.current` is valid at check time, but the **updater function** `v => ({...})` is invoked by React **later**, during the batched commit phase (React 18 automatic batching). If `onPointerUp` fires between the check and the updater execution and runs `panStartRef.current = null`, the updater dereferences a null ref and crashes.

This is a generic anti-pattern: **never read a ref inside a setState updater** if the ref can be mutated by another handler in the same event loop tick.

## Fix

Capture the ref values into local variables (closure-safe) **before** scheduling the state update:

```tsx
if (panning && panStartRef.current) {
  // Brain: fix-office-canvas-pointermove-ref-race
  const start = panStartRef.current;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  setViewport(v => ({
    ...v,
    panX: start.panX + dx,
    panY: start.panY + dy,
  }));
}
```

The updater now closes over `start`, `dx`, `dy` — immutable stack values. The ref can be nulled by `onPointerUp` before the batch executes; doesn't matter.

## Trigger Conditions

1. Middle-click pan, or hold Space + left-click pan, on Office View v2
2. Release the pointer button quickly while moving — race window is tiny but real
3. React 18 batching delays the updater execution past the pointer-up handler

## Prevention Pattern

When a `useRef` is mutated by multiple event handlers and read inside a `setState` updater, **always capture into a local variable first**. The updater function MUST be pure with respect to time — no reading mutable refs.

Anti-pattern hint: any `ref.current!.field` (non-null assertion) inside a `setState(v => ...)` callback is a code smell. Refs that may be reset elsewhere should be snapshotted at the synchronous call site.

## Other panX/refs reviewed

- `MermaidDiagram.tsx:156` — `setPan({ x: panStartRef.current.panX + dx, ... })`. Direct value (not updater), evaluated synchronously. Safe.
- `OfficeView.tsx:189` — `dragStart.current.panX + ...`. Direct value, synchronous. Safe.
- `FeatureMapCanvas.tsx`, `OfficeView.tsx` — checked, no ref-in-updater pattern.

## Verification

Manual: enter Office View v2, hold space, click-drag, release while moving rapidly. Repeat ~20 times. Previously: occasional ErrorBoundary crash. After fix: clean.
