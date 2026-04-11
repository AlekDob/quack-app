---
type: bug-fix
created: 2026-04-11
tags: [linux, code-editor, tabs, useEffect, race-condition, activeTerminal]
---

# Fix: Code Editor Tab Disappears Immediately After Opening (Linux)

## Symptom

On Linux, opening a file in the integrated code editor (from File Explorer, Brain, Feature Map, or any entry point) causes the editor tab to appear for an instant and then switch back to the Chat tab. The code-editor tab is removed from the tab bar entirely.

No JavaScript errors in the console.

## Root Cause

Two issues combined:

### 1. Spurious effect fires from `activeTerminal` dependency

The tab-switching effect (`App.tsx`, ~line 11175) had dependencies `[activeId, activeTerminal]`. Since `activeTerminal` is a `useMemo(() => terminals.find(...), [activeId, terminals])`, it recomputes a **new object reference** on ANY `terminals` array mutation — status updates (idle→busy), personality loads, auto-save writes, etc.

Every recomputation triggered the effect, which:
- Replaced all tabs via `setTabs(...)` with `chat + terminalTabs + specialTabs`
- Called `setActiveTabId('chat')` because the code-editor tab wasn't in any preserved category

### 2. `'code-editor'` missing from `specialTabTypes`

The `specialTabTypes` arrays in both tab-switching effects (Effect 1 at ~line 2244 and Effect 2 at ~line 11234) did not include `'code-editor'`. This meant code-editor tabs were:
- Not preserved during `setTabs(...)` — removed from the merged tab list
- Not detected by `isSpecialTabActive` — `setActiveTabId('chat')` called

### Why Linux-specific?

The `test/linux` branch adds immediate agent persistence effects that fire on `terminals` changes (`fix-linux-projects-disappear-on-restart`). These cause more frequent `terminals` mutations → more frequent `activeTerminal` recomputations → more opportunities for the spurious effect to fire between tab creation and the next stable render.

On macOS, the same bug exists in theory but triggers less frequently due to different timing of terminal status updates.

## Fix

Three changes in `App.tsx`:

1. **Guard Effect 2 with `prevSwitchIdRef`**: Only run tab-replacement logic when `activeId` actually changes, not on every `activeTerminal` recomputation. Removed `activeTerminal` from the dependency array (with ESLint suppression comment explaining why).

2. **Add `'code-editor'` to `specialTabTypes`** in all three locations:
   - Effect 1 save path (~line 2226): prevents code-editor tabs from being stored as agent-specific tabs
   - Effect 1 restore path (~line 2246): preserves code-editor tabs across agent switches
   - Effect 2 (~line 11237): preserves code-editor tabs during tab restoration

3. **Safer `isSpecialTabActive` check**: Changed from substring match (`activeTabId.includes(type)`) to type-based lookup (`tabs.find(t => t.id === activeTabId)?.type`) to prevent false positives from file names containing special type strings.

### 3. `git_diff` blocking editor load (infinite loading spinner)

After fixing issues 1+2, the editor tab stayed open but showed "Loading editor..." forever. The `openFile` function awaited `git_diff` before setting `isLoading: false`. On Linux, `git_diff` can hang (git lock file, SSH passphrase prompt, slow repo) causing the spinner to persist indefinitely.

**Fix:** Split `openFile` into two phases:
1. **Immediate:** `read_file_content` → set content + `isLoading: false` → editor renders
2. **Background:** `git_diff` → apply `lineChanges` asynchronously (with stale-file guard)

## Key Files

- `src/App.tsx` — Effect 1 (~line 2208), Effect 2 (~line 11185), `specialTabTypes` arrays
- `src/stores/editorStore.ts` — `openFile()` two-phase loading

## Related

- `documentation/patterns/pattern-code-editor-tab.md` — code editor tab system
- `documentation/bugs/fix-linux-projects-disappear-on-restart.md` — the Linux persistence fix that increased terminal mutations
- `documentation/gotchas/gotcha-tauri-listener-strict-mode-double-fire.md` — another effect timing issue
