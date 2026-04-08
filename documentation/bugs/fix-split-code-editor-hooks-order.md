---
type: gotcha
project: quack-app
created: 2026-04-08
last_verified: 2026-04-08
tags: [react, hooks, split-view, editor]
---

# SplitCodeEditor: hook called after early return

## Symptom

Opening any file in split pane crashes with:
`Error: Rendered more hooks than during the previous render`
ErrorBoundary catches it and shows "Provider Error: Git".

## Root Cause

`useShortcutsStore(s => s.formatShortcut)` was called **after** the
`if (isLoading) return <CodeEditorSkeleton />` early return.

- Render 1: `isLoading=true` -> early return -> hook never called (N hooks)
- Render 2: `isLoading=false` -> hook called (N+1 hooks) -> React crash

## Fix

Moved `useShortcutsStore(s => s.formatShortcut)` to the top of the
component, alongside the other hook calls, before any conditional returns.

## File

`src/components/SplitView/SplitCodeEditor.tsx`

## Lesson

Never place hooks after early returns. All hooks must be called
unconditionally at the top of a React component.
