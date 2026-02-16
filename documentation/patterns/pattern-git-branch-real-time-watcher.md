---
type: pattern
created: 2026-02-08
tags: [git, file-watcher, tauri, real-time, notify]
---

# Pattern: Git Branch Real-Time Watcher

## Use Case

Detect when git branch changes via CLI commands (like `git checkout`) and update UI in real-time without polling.

## Architecture

```
CLI: git checkout main
  -> .git/HEAD file changes
  -> Rust File Watcher (notify) detects change
  -> Read .git/HEAD directly (no git command)
  -> Parse branch name
  -> Emit Tauri event: git:branch-changed
  -> Frontend listener updates gitBranch state + terminal.branch persistence
```

## Rust Implementation

- One watcher per project path (HashMap key)
- Uses `notify_debouncer_full` with 200ms debounce
- `NonRecursive` mode (watches `.git/` directory, filters for HEAD file)
- Idempotent start: calling twice on same path is no-op
- Worktree support: resolves `.git` file to actual gitdir path

### Branch Parsing (No Process Spawn)

Pure file I/O reading `.git/HEAD` -- ~50x faster than spawning `git branch --show-current`. Works offline, no git binary dependency.

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Latency (checkout to UI update) | ~200ms |
| CPU overhead (idle) | 0% |
| Memory per watcher | ~50KB |
| Debounce window | 200ms |

## Gotchas

1. Don't watch `.git/` recursively -- generates noise from index updates
2. Debounce is critical -- rapid checkouts happen during scripted flows
3. Handle both display + persistence -- UI state != stored state
4. Idempotent start -- frontend calls on every terminal switch
5. Silent failures OK -- not all projects are git repos
