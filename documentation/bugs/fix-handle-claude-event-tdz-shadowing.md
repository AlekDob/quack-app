---
type: bug_fix
project: quack-app
created: 2026-05-04
last_verified: 2026-05-04
tags: [react, javascript, tdz, scope-shadowing, ask-user-question, result-event, app-tsx]
---

# Fix: TDZ crash on `result` event — `Cannot access 'agentId' before initialization`

## Symptom

CrashGuard caught `ReferenceError: Cannot access 'agentId2' before initialization` after every Claude turn that produced a `result` event with at least one terminal in `terminalsRef.current`. Most user-visible after answering an AskUserQuestion (because that exchange always ends with a `result`), so it looked like an AskUserQuestion bug — but the same crash fires on any normal turn.

Stack trace pointed to `App.tsx:1728` inside an `Array.prototype.find` callback, reached via a Tauri IPC callback (`runCallback`/`value` frames). The minified variable was `agentId2`, the esbuild-renamed inner binding.

## Root Cause

`handleClaudeEvent` at `App.tsx:1444` is defined with a parameter `agentId`. Inside the `if (claudeEvent.type === 'result')` branch (line 1719), two sibling pieces of code shared the same outer block scope:

```ts
if (claudeEvent.type === 'result') {
  // ...
  {
    const session = useSessionStore.getState().sessions.find((s) => s.id === messageKey);
    const terminal = terminalsRef.current.find((t) => t.id === agentId); // ← line 1728
    // ... (intends the parameter)
  }
  // ... ~80 lines later ...
  const agentId = activeMessageKeyRef.current.get(messageKey) || messageKey; // ← line 1807
  outputBuffersRef.current.delete(agentId);
  // ...
}
```

`let`/`const` bindings are hoisted to the top of their block but uninitialized until the declaration line is reached. JS's name-resolution at line 1728 binds `agentId` to the **later** `const agentId` (line 1807) instead of the function parameter, and accessing it throws TDZ. esbuild's transform renames the inner binding to `agentId2` to disambiguate from the parameter, which is why the error message names `agentId2`.

The bug was introduced when the project-stats refresh block (Brain breadcrumb `decision-project-token-stats-sqlite`) was added at lines 1726–1738; the cleanup block at 1807 (Brain: `fix-memory-leak-14gb-ram`) predated it. The new block referenced `agentId` expecting it to be the parameter, not realizing the later `const agentId` would shadow it.

## Fix

Rename the inner declaration so it doesn't shadow the parameter. The variable is really a buffer/cleanup key — `bufferKey` reads better and makes the intent obvious:

```ts
// 1807 — before
const agentId = activeMessageKeyRef.current.get(messageKey) || messageKey;
outputBuffersRef.current.delete(agentId);
outputBuffersRef.current.delete(messageKey);
activeMessageKeyRef.current.delete(agentId);

// after
const bufferKey = activeMessageKeyRef.current.get(messageKey) || messageKey;
outputBuffersRef.current.delete(bufferKey);
outputBuffersRef.current.delete(messageKey);
activeMessageKeyRef.current.delete(bufferKey);
```

After the rename, the `.find` at line 1728 resolves `agentId` to the function parameter as intended.

## Why both dev and prod showed it

This is a real ES spec behavior, not a minification artifact — the TDZ would fire even without esbuild. Production logs showed `agentId2` because esbuild renamed the inner binding for codegen; dev mode showed the same `agentId2` for the same reason (Vite still runs esbuild in dev for TS/JSX). Source maps mapped both back to the original lines.

## Generic anti-pattern

In a single block scope, do not reference a name **before** its `const`/`let` declaration when an outer scope (function param, closure capture) has the same name. The inner `const`/`let` shadows the outer for the entire block, including code physically above the declaration line. Either:

- rename the inner binding (this fix), or
- move the declaration to the top of the block, or
- use `var` for the inner binding (terrible idea — works, but read on).

Checking the file for similar patterns is cheap and worth doing whenever a parameter name is reused inside the function body.

## Files changed

- `src/App.tsx` — renamed `const agentId` → `const bufferKey` at line 1807 with a comment marking the shadowing trap.

## Brain breadcrumbs

- `App.tsx:1810` — comment near the rename references `fix-handle-claude-event-tdz-shadowing` (this entry).
