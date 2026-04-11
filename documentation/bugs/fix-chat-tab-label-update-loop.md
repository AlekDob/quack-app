# Fix: Chat tab label/color update loop

**Status:** Fixed
**Date:** 2026-04-11
**Author:** (Antonio)

## Symptom

The open tab continuously re-renders, flooding the console with `[Tab Update]` logs.
Visible as a constant flicker of state updates in DevTools while viewing any agent tab.

## Root Cause

The effect at `App.tsx:~11149` syncs the Chat tab label/color from `activeTerminal`:

```
terminals mutates (status busy/idle, personality load, auto-save)
  → activeTerminal useMemo recomputes (new object reference)
    → useEffect([activeTerminal]) fires
      → setTabs() ALWAYS creates new array (no bail-out)
        → re-render
```

`activeTerminal` depends on `[activeId, terminals]`. The `terminals` array changes
reference on every status tick, personality load, or PiP update — even when the
terminal for the current agent hasn't changed. This caused the effect to fire
dozens of times per second.

The `setTabs` updater unconditionally created a new array and new chat tab object
via spread (`[...prevTabs]`, `{ ...chatTab }`), even when `label` and `color`
were already correct. React saw a new reference and scheduled a re-render.

## Fix

Added an early bail-out in the `setTabs` updater: compare `currentTab.label` and
`currentTab.color` with the incoming values, and return `prevTabs` unchanged if
they match. This breaks the re-render cascade.

Also removed verbose `console.log` calls that contributed to console noise.

## How to Avoid

When using `setTabs`/`setState` inside effects that fire on derived-state changes:
- **Always check if the value actually changed** before returning a new reference
- Effects on `useMemo` results fire whenever deps change, even if the computed
  value is semantically identical — the memo returns a new reference if deps differ
