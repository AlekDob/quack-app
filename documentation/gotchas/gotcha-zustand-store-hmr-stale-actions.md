---
type: gotcha
created: 2026-04-11
tags: [zustand, hmr, vite, hot-reload, store, actions, linux, debugging]
---

# Gotcha: Zustand Store Actions Are NOT Replaced by HMR

## Symptom

You edit a Zustand store action (e.g., `openFile` in `editorStore.ts`), Vite HMR picks up the file change, but the running app still uses the **old** action function. Your fix appears to have no effect.

## Root Cause

Zustand stores are module-level singletons created via `create()`. When Vite HMR replaces the module:

1. The module is re-evaluated
2. `create()` runs again, BUT Zustand's internal state persists from the previous instance
3. The **action functions** defined inside `create((set, get) => ({ ... }))` are closures captured at creation time
4. Since the store instance was already created and cached, the new action closures are discarded
5. The app continues calling the old action functions

This means:
- **State** persists across HMR (expected)
- **Actions** are NEVER replaced by HMR (unexpected, causes confusion)
- **Selectors** in components DO update (they're defined in the component, not the store)

## Fix

**Full page reload required.** In Tauri webview:
- `Ctrl+Shift+R` (hard reload) in the DevTools
- Or restart `cargo tauri dev` entirely

## Key Details

- This affects ALL Zustand stores, not just `editorStore`
- React component code (hooks, effects, render logic) updates via HMR normally
- Only the store **action implementations** are stale after HMR
- This is particularly confusing when debugging — you add `console.log` to an action and it never appears

## When This Bites You

- Debugging store action logic (adding logs, changing behavior)
- Fixing async flows inside store actions (e.g., making `git_diff` non-blocking)
- Any change to the function body inside `create((set, get) => ({ ... }))`

## Related

- `documentation/gotchas/gotcha-linux-hmr-not-working.md` — Linux HMR config issues
- `documentation/gotchas/gotcha-localstorage-cache-stale-config.md` — another stale state issue
