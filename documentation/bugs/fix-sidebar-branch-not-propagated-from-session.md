---
type: bug_fix
project: quack-app
created: 2026-04-01
last_verified: 2026-04-01
tags: [git, sidebar, branch, session, terminal, repositorygroup]
---

# Fix: Sidebar shows "main" instead of session branch

## Symptom

The RepositoryGroup sidebar (`div.agent-sessions-container`) shows `main` as the agent's branch, while the Changes panel and chat stream header correctly display the session's branch (e.g. `001-mvp-youtube-wrapper`).

## Root Cause

Two-part timing issue:

### 1. Session branch never propagated to terminal

When a session is created with an explicit `branch` field, it's stored only on `AgentSession.branch`. The sidebar reads `TerminalInfo.branch` (via `agent.branch || "main"` in `RepositoryGroup.sortedBranches`). Nobody was copying `session.branch` → `terminal.branch`.

### 2. Git watcher missed the checkout

The `git:branch-changed` file watcher was supposed to bridge this gap, but:
- Session creation calls `git_switch_branch` → `.git/HEAD` changes
- Watcher starts AFTER the session is opened (`start_git_branch_watcher` in the activeTerminal useEffect)
- By the time the watcher is watching, `.git/HEAD` already has the new branch
- No change detected → no event emitted → `terminal.branch` stays `undefined`

### Data Flow (Before Fix)

```
Session created with branch="001-mvp..."
  → AgentSession.branch = "001-mvp..."  ✅
  → git_switch_branch() changes .git/HEAD
  → Watcher not yet started (starts on terminal activation)
  → TerminalInfo.branch = undefined  ❌
  → Sidebar: agent.branch || "main" → shows "main"  ❌
```

## Fix

### Fix 1 — Rust: Initial emit on watcher start (`git_watcher.rs`)

After creating the debouncer and registering it, immediately read the current branch from `.git/HEAD` and emit a `git:branch-changed` event. This catches the case where the checkout happened before the watcher was watching.

```rust
// After watchers.insert(...)
drop(watchers); // release lock before emit
if let Ok(branch) = read_branch_from_head(&head_path) {
    app_for_init.emit("git:branch-changed", &GitBranchChangedEvent {
        project_path,
        branch,
    });
}
```

Required cloning `app` before the debouncer closure consumes it: `let app_for_init = app.clone();`

### Fix 2 — Frontend: Session branch → Terminal branch (`App.tsx`)

In the `useEffect` that overrides `gitBranch` when active session has explicit branch, also update the terminal's branch field via `setTerminals`:

```typescript
useEffect(() => {
  if (!activeSessionId) return;
  const session = useSessionStore.getState().sessions.find(s => s.id === activeSessionId);
  if (session?.branch) {
    setGitBranch(session.branch);
    setTerminals((prev) =>
      prev.map((t) =>
        t.id === session.agentId ? { ...t, branch: session.branch } : t
      )
    );
  }
}, [activeSessionId]);
```

### Data Flow (After Fix)

```
Session created with branch="001-mvp..."
  → AgentSession.branch = "001-mvp..."  ✅
  → git_switch_branch() changes .git/HEAD
  → Session activated → useEffect fires
  → setTerminals: TerminalInfo.branch = "001-mvp..."  ✅
  → Sidebar: agent.branch = "001-mvp..."  ✅

  (Also: watcher starts, emits initial branch,
   git:branch-changed listener updates ALL terminals with same cwd)
```

## Files Modified

1. `src-tauri/src/git_watcher.rs` — `app_for_init` clone + initial emit after watcher start
2. `src/App.tsx` — `setTerminals` in session branch override useEffect
3. `src/tests/branchTerminalSync.test.ts` — 12 tests covering propagation and grouping

## Relationship to Prior Fixes

- Extends `bug-stale-branch-indicator-after-checkout.md` (original watcher fix)
- Extends `bug-fix-git-panel-not-updating.md` (worktree branch display)
- Same data flow: `TerminalInfo.branch` → `RepositoryGroup.sortedBranches`

## Key Learnings

1. **Session ≠ Terminal**: branch can exist on one but not the other — always propagate
2. **Watcher initial state**: file watchers only fire on CHANGES, not on start — emit initial state explicitly
3. **Idempotent start_watching**: returns early if already watching, so initial emit only fires once per project lifecycle
