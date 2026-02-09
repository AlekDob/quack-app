---
type: bug_fix
project: quack-app
created: 2026-02-08
tags: [git, ui, real-time, tauri, file-watcher]
---

# Bug: Stale branch indicator after git checkout

## Problem
When an agent runs `git checkout <branch>` via CLI in the terminal, the branch chip in the right panel (AgentPersonalityCard) stays stuck on the old branch. New sessions show the correct branch because they read from disk at initialization time.

## Root Cause Analysis

### Data Flow (Before Fix)
```
App.tsx:1403 useEffect → reads activeTerminal.branch (priority)
                      → fallback: invoke('git_current_branch')
                      → dependencies: [activeTerminal, tauriAvailable]
```

**The Problem:** Neither dependency changes when git state changes on disk.

### Priority System
1. **Primary source**: `activeTerminal.branch` (stored in terminal metadata)
2. **Fallback**: `git_current_branch()` Tauri command (only if branch field is undefined)

When an agent does `git checkout`:
- Filesystem `.git/HEAD` changes ✓
- `activeTerminal` reference stays the same ✗
- `useEffect` never re-runs ✗
- UI shows stale branch ✗

## Solution: File Watcher on `.git/HEAD`

Watch the `.git/HEAD` file (30 bytes, changes only on checkout) using existing `notify 8.2` crate. Emit Tauri event when branch changes. Frontend listens and updates both UI state and terminal persistence.

### Implementation

#### 1. Rust Backend (`src-tauri/src/git_watcher.rs`)
- `GitBranchWatcherManager` with `HashMap<String, Debouncer<...>>`
- Watches `.git/HEAD` with `NonRecursive` mode, 200ms debounce
- Reads branch directly from file (no process spawn)
- Handles worktrees: if `.git` is file, follows gitdir reference
- Emits `git:branch-changed` event with `{ projectPath, branch }`

#### 2. Frontend (`src/App.tsx`)
**Two changes:**

a) Start watcher lazily (in existing useEffect at line 1403):
```typescript
if (cwd) {
  invoke('start_git_branch_watcher', { projectPath: cwd }).catch(() => {});
}
```
Idempotent — safe to call repeatedly.

b) Listen for events (new useEffect after line 1431):
```typescript
listen<{ projectPath: string; branch: string }>('git:branch-changed', (event) => {
  // Update gitBranch display if matches active terminal
  if (activeCwd && projectPath === activeCwd) {
    setGitBranch(branch);
  }

  // Update ALL terminals with matching cwd (persistence)
  setTerminals(prev => prev.map(t =>
    t.cwd === projectPath ? { ...t, branch } : t
  ));
});
```

### Edge Cases Handled
- **Multiple terminals, same repo**: One watcher per project, event updates all matching terminals
- **Worktrees**: Detects `.git` file vs directory, follows gitdir reference
- **Non-git directory**: `git_root()` fails, watcher not started, silent catch
- **Detached HEAD**: Parses raw hash, truncates to 7 chars
- **Rapid checkouts**: 200ms debounce coalesces

### Files Modified
1. `src-tauri/src/git_watcher.rs` — NEW (~100 lines)
2. `src-tauri/src/git.rs:430` — `git_root` made `pub(crate)`
3. `src-tauri/src/lib.rs` — Module + state + commands registered
4. `src/App.tsx` — Event listener + watcher start (~25 lines)

**Total: ~130 lines. No new dependencies.**

### Performance
- Zero polling overhead
- File watcher triggers only on actual `.git/HEAD` changes
- ~200ms latency from checkout to UI update
- Minimal memory footprint (one watcher per project)

## Verification Steps
1. Build: `npm run tauri dev`
2. Open agent session
3. Run `git checkout <other-branch>` in terminal
4. Verify branch chip updates within ~500ms
5. Switch to another agent on same project
6. Verify their branch also updated
7. Switch back — verify it updates again

## Key Learnings
1. **Reactive dependencies matter**: useEffect won't re-run if refs don't change
2. **File watchers > polling**: 200ms latency vs 3-5s, zero CPU waste
3. **Idempotent watcher start**: Safe to call on every terminal switch
4. **Update all instances**: Don't just update display — update ALL terminals with same path
5. **Auto-persistence**: Terminals auto-save when state changes (2s debounce)
