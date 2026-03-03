---
type: gotcha
project: quack-app
created: 2026-03-03
last_verified: 2026-03-03
tags: [react, strict-mode, console-log, state-updater, performance]
---

# Gotcha: console.log Inside React State Updater Fires Twice in StrictMode

## Symptom

Hundreds of duplicate log messages at app startup from `loadKanbanChatSessions`. Each Kanban task session produced 2x "Updated messages" logs, flooding the console.

## Root Cause

`console.log` calls were placed **inside** `setState(prev => ...)` updater functions. React StrictMode intentionally invokes state updater functions twice in development to detect impure reducers. This doubles every log line.

Combined with per-task verbose logging (3 lines per task), a board with 30+ tasks generated 180+ log lines on every boot.

## Rule

**NEVER put `console.log` (or any side effect) inside a `setState` updater function.** Updater functions must be pure — they receive previous state and return new state, nothing else.

```typescript
// BAD: log inside updater — fires twice in StrictMode
setState(prev => {
  const next = new Map(prev);
  next.set(id, data);
  console.log(`Updated ${id}`); // SIDE EFFECT — fires 2x
  return next;
});

// GOOD: log outside updater, or use a summary counter
let count = 0;
setState(prev => {
  const next = new Map(prev);
  next.set(id, data);
  return next;
});
count++;
console.log(`Updated ${count} items`); // after the loop
```

## Fix Applied

Replaced all per-task `console.log` inside `setChatSessions` and `setChatTokensMap` updaters with external counters (`loadedFromStore`, `loadedFromRust`, `skipped`), and a single summary log at the end:

```
[loadKanbanChatSessions] Done: 25 from store, 3 from Rust, 2 skipped (total: 30)
```

## Files

- `src/App.tsx` — `loadKanbanChatSessions` function (~line 2856)

## See Also

- `gotcha-tauri-listener-strict-mode-double-fire.md` — same StrictMode issue with Tauri listeners
- `gotcha-automation-scheduler-log-spam.md` — similar log spam pattern
