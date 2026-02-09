---
type: pattern
project: quack-app
created: 2026-02-08
tags: [git, file-watcher, tauri, real-time, notify]
---

# Pattern: Git Branch Real-Time Watcher

## Use Case
Detect when git branch changes via CLI commands (like `git checkout`) and update UI in real-time without polling.

## Architecture

```
CLI: git checkout main
    ↓
.git/HEAD file changes
    ↓
Rust File Watcher (notify) detects change
    ↓
Read .git/HEAD directly (no git command)
    ↓
Parse branch name
    ↓
Emit Tauri event: git:branch-changed
    ↓
Frontend listener updates:
  - gitBranch state (UI display)
  - terminal.branch (persistence)
```

## Rust Implementation

### Manager Pattern
```rust
pub struct GitBranchWatcherManager {
    watchers: Arc<Mutex<HashMap<String, Debouncer<RecommendedWatcher, FileIdMap>>>>,
}
```

Key characteristics:
- One watcher per project path (HashMap key)
- Uses `notify_debouncer_full` with 200ms debounce
- `NonRecursive` mode (watches `.git/` directory, filters for HEAD file)
- Idempotent start: calling twice on same path is no-op

### Worktree Support
```rust
fn resolve_head_path(git_root: &PathBuf) -> Result<PathBuf, String> {
    let dot_git = git_root.join(".git");

    if dot_git.is_dir() {
        // Normal repository
        Ok(dot_git.join("HEAD"))
    } else if dot_git.is_file() {
        // Worktree: .git is a file containing "gitdir: /path/to/..."
        let content = fs::read_to_string(&dot_git)?;
        let gitdir = content.strip_prefix("gitdir: ")?.trim();
        Ok(PathBuf::from(gitdir).join("HEAD"))
    } else {
        Err("...")
    }
}
```

### Branch Parsing (No Process Spawn)
```rust
fn read_branch_from_head(head_path: &PathBuf) -> Result<String, String> {
    let content = fs::read_to_string(head_path)?.trim();

    if let Some(branch) = content.strip_prefix("ref: refs/heads/") {
        Ok(branch.to_string())  // Normal branch
    } else {
        Ok(content.chars().take(7).collect())  // Detached HEAD (short hash)
    }
}
```

**Why no `git` command?**
- `.git/HEAD` format is stable and simple
- Pure file I/O is ~50x faster than spawning `git branch --show-current`
- Works offline, no git binary dependency

## Frontend Integration

### Lifecycle
```typescript
// Start watcher when terminal activates (idempotent)
useEffect(() => {
  if (activeTerminal?.cwd) {
    invoke('start_git_branch_watcher', {
      projectPath: activeTerminal.cwd
    }).catch(() => {}); // Silent if not git repo
  }
}, [activeTerminal]);
```

### Event Listener
```typescript
useEffect(() => {
  const unlistenPromise = listen<{ projectPath: string; branch: string }>(
    'git:branch-changed',
    (event) => {
      const { projectPath, branch } = event.payload;

      // Update display if matches active terminal
      if (activeTerminal?.cwd === projectPath) {
        setGitBranch(branch);
      }

      // Update ALL terminals with this project (persistence)
      setTerminals(prev =>
        prev.map(t => t.cwd === projectPath ? { ...t, branch } : t)
      );
    }
  );

  return () => {
    unlistenPromise.then(unlisten => unlisten()).catch(() => {});
  };
}, [activeTerminal?.cwd]);
```

**Critical:** Update both display AND all terminal instances. Don't just update UI — multiple terminals can point to the same repo.

## Registration (lib.rs)

```rust
mod git_watcher;

tauri::Builder::default()
    .manage(git_watcher::GitBranchWatcherManager::new())
    .invoke_handler(tauri::generate_handler![
        git_watcher::start_git_branch_watcher,
        git_watcher::stop_git_branch_watcher,
        git_watcher::stop_all_git_branch_watchers,
    ])
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Latency (checkout → UI update) | ~200ms |
| CPU overhead (idle) | 0% |
| Memory per watcher | ~50KB |
| File watched | `.git/HEAD` (~30 bytes) |
| Debounce window | 200ms |
| Mode | NonRecursive |

## Reusable for Other Git State
This pattern extends to other git files:

| File | Use Case |
|------|----------|
| `.git/HEAD` | Current branch (this pattern) |
| `.git/MERGE_HEAD` | Detect merge in progress |
| `.git/REBASE_HEAD` | Detect rebase in progress |
| `.git/refs/heads/*` | Detect new branches created |

Just change the watch path and parse logic.

## Gotchas

1. **Don't watch `.git/` recursively** — generates noise from index updates
2. **Debounce is critical** — rapid checkouts happen during scripted flows
3. **Handle both display + persistence** — UI state != stored state
4. **Idempotent start** — frontend calls on every terminal switch
5. **Silent failures OK** — not all projects are git repos

## Comparison with Alternatives

| Approach | Pros | Cons |
|----------|------|------|
| **File watcher (this)** | Real-time, zero polling, efficient | Slightly more complex |
| **Polling (5s)** | Simple | CPU waste, 5s lag, scales badly |
| **Git hooks** | Native git integration | Requires repo config, not portable |
| **Parse terminal output** | No file access needed | Fragile, locale-dependent, slow |

## Dependencies
- `notify = "8.2"` (already in Cargo.toml)
- `notify-debouncer-full = "0.6"` (already in Cargo.toml)
- No new dependencies needed
