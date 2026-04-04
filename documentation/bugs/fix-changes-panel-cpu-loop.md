---
type: bug
project: quack-app
created: 2026-04-04
last_verified: 2026-04-04
tags: [changes-panel, cpu, performance, infinite-loop, useEffect, useCallback]
---

# Fix: ChangesPanel CPU Loop (108% on Agent Commit)

## Symptom
When an agent executes `git commit`, `tauri://localhost` spikes to 108% CPU and the app freezes completely. Activity Monitor shows constant thread activity in the Tauri webview process.

## Root Cause
Two overlapping infinite re-render loops triggered by agent commits:

### Loop 1: reconcileWithGit (useChangesPanelState.ts)
- `reconcileWithGit` useCallback depended on `committedFiles` and `onRefreshGitStatus`
- When it found committed files, it called `setCommittedFiles()` → recreated the function
- The `window.focus` listener effect and `lastRefreshTs` effect both depended on `reconcileWithGit`
- Both effects re-fired → called `reconcileWithGit()` again → infinite loop
- Each iteration called `git_check_files_dirty` (IPC → git status) = expensive

### Loop 2: onAgentCommitDetected (ChatView.tsx)
- `onAgentCommitDetected` was an inline arrow function in App.tsx JSX → new reference every render
- The detection useEffect had `onAgentCommitDetected` in its dependency array
- When called, it ran `setAgentCommitTs(Date.now())` → App re-render → new function ref
- Effect re-triggered because dep changed → `lastAgentCommitTs > 0` still true → called again → infinite loop

## Fix
Replaced direct state/callback dependencies with refs in both locations:

**useChangesPanelState.ts**: `committedFiles` and `onRefreshGitStatus` accessed via refs instead of useCallback deps. `reconcileWithGit` now only depends on `rootPath` and `modifiedFiles`.

**ChatView.tsx**: `onAgentCommitDetected` stored in a ref. The detection effect only depends on `lastAgentCommitTs`, not the callback reference.

## Key Insight
Never put a setState-derived value or an inline callback in a useEffect/useCallback dependency array if the effect/callback itself triggers that state change. Use refs to read current values without creating dependency cycles.

## Files Changed
- `src/hooks/useChangesPanelState.ts` (lines 57-83)
- `src/components/ChatView.tsx` (lines 651-658)
