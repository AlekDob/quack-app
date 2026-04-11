---
type: gotcha
created: 2026-04-11
tags: [react, useMemo, useEffect, performance, tabs, activeTerminal, race-condition]
---

# Gotcha: useMemo Object in useEffect Deps Causes Spurious Runs

## Symptom

A `useEffect` that depends on a `useMemo`-derived object fires far more often than expected, executing expensive logic (tab replacement, state resets) on unrelated state changes.

## Root Cause

`useMemo` returns a **new object reference** whenever ANY of its dependencies change, even if the computed value is logically identical:

```ts
// Recomputes on EVERY terminals change (status tick, personality load, etc.)
const activeTerminal = useMemo(
  () => terminals.find(t => t.id === activeId) ?? null,
  [activeId, terminals]
);

// Fires on every activeTerminal recompute — NOT just on activeId change
useEffect(() => {
  // Expensive: replaces all tabs, resets activeTabId
  setTabs(prevTabs => { /* ... */ });
  setActiveTabId('chat');
}, [activeId, activeTerminal]); // <-- activeTerminal is the problem
```

In Quack, `terminals` changes on every status update (idle/busy), personality load, auto-save, etc. Each change creates a new `activeTerminal` reference, which fires the effect even though `activeId` hasn't changed.

## Concrete Impact (2026-04-11)

The tab-switching effect in `App.tsx` used `[activeId, activeTerminal]` as deps. On Linux (where terminal updates are more frequent due to persistence effects), this caused:

1. User opens code-editor tab
2. Terminal status updates → `activeTerminal` recomputes
3. Effect fires → replaces all tabs (code-editor not in `specialTabTypes`) → `setActiveTabId('chat')`
4. Code-editor tab disappears

## Fix Pattern

Use a **ref-based guard** to only run logic when the meaningful value changes:

```ts
const prevIdRef = useRef<string | null>(null);
useEffect(() => {
  if (prevIdRef.current === activeId) return; // Skip spurious runs
  prevIdRef.current = activeId;
  // ... actual tab-switch logic
}, [activeId]); // Remove useMemo object from deps
```

Or better: restructure so the `useMemo` object is read inside the effect body rather than listed as a dependency:

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  // Read activeTerminal from closure — it's fresh because activeId just changed
  const label = activeTerminal?.label || 'Chat';
  // ...
}, [activeId]); // activeTerminal intentionally excluded
```

## Key Details

- This pattern is dangerous with ANY `useMemo` that depends on frequently-changing arrays/objects
- The ESLint `react-hooks/exhaustive-deps` rule will warn about missing deps — suppress with a comment explaining why
- The same issue applies to `useCallback` objects used as effect deps

## Related

- `documentation/bugs/fix-code-editor-tab-disappears-linux.md` — the bug this caused
- `documentation/bugs/fix-office-view-snaps-back-to-chat.md` — similar tab-reset pattern
