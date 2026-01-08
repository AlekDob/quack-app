# Git Worktree Isolation for Tasks

> **Date**: 2026-01-07
> **Status**: Implemented
> **Version**: 1.0

## Overview

Git Worktree Isolation is a feature that allows each Kanban task to operate in its own isolated Git worktree. This enables true parallel development where multiple tasks can work on different branches simultaneously without interfering with each other or the main repository.

### What is a Git Worktree?

A Git worktree is a linked working copy of your repository. Unlike traditional branching where you switch between branches in a single directory, worktrees let you check out multiple branches at once in separate directories. Each worktree maintains its own working directory but shares the same `.git` repository, making them lightweight and efficient.

### Why Use Worktrees for Tasks?

**Benefits:**
- **Parallel Development**: Work on multiple tasks simultaneously without switching branches
- **Isolation**: Each task has its own sandbox - no conflicts or accidental commits to wrong branches
- **Safety**: Main repository remains clean while tasks are in progress
- **Terminal Access**: Run tests, builds, or any commands directly in the task's worktree
- **Automatic Cleanup**: Worktrees are automatically merged and removed when tasks complete

**Use Cases:**
- Testing experimental features without affecting main work
- Running long-running builds while continuing development
- Code review workflows where you need to check out PRs
- Parallel bug fixes that need separate testing environments

---

## How to Use

### 1. Creating a Task with Worktree

When creating a new Kanban task, you can optionally enable worktree isolation:

**Steps:**
1. Click **"Add Task"** button in Kanban view (or press `Cmd+N`)
2. Fill in task details (title, prompt, project, branch)
3. Check the **"Use isolated worktree"** checkbox
4. Click **"Create Task"**

The task will be created in the **TODO** column without creating the worktree yet (worktrees are created lazily when needed).

### 2. Starting a Task (Worktree Creation)

When you move a task from **TODO** to **IN PROGRESS**, the system automatically:

1. **Creates a new branch** with naming pattern: `task/{id}-{slug}`
   - Example: `task/a1b2c3d4-fix-authentication-bug`
2. **Creates a worktree** at: `.worktrees/task-{id}`
   - Example: `.worktrees/task-a1b2c3d4/`
3. **Sets agent's working directory** to the worktree path
4. **Updates task metadata** with worktree path and branch name

**Visual Indicator:**
- Tasks with worktrees show an **orange Git badge** (🌳) on the Kanban card
- Hovering over the badge shows the worktree path

**Branch Naming:**
- Pattern: `task/{shortId}-{slug}`
- Short ID: Last 8 characters of task UUID
- Slug: Kebab-case version of task title (max 50 chars, first 5 words)

**Example:**
```
Task Title: "Fix authentication bug in login flow"
Task ID: "kanban-1704722400000-a1b2c3d4"
Branch: task/a1b2c3d4-fix-authentication-bug
Worktree: /path/to/project/.worktrees/task-a1b2c3d4
```

### 3. Working in the Worktree

**Option A: Right-Click Menu**

1. Right-click on the task card
2. Select **"Open Terminal in Worktree"**
3. Terminal window opens with `cwd` set to worktree path

**Option B: Agent Chat**

When you open the task's chat drawer, the AI agent's working directory is automatically set to the worktree. All file operations, Git commands, and terminal commands execute within the worktree.

**What You Can Do:**
- Run tests: `npm test`, `cargo test`, `swift test`
- Build project: `npm run build`, `cargo build`
- Run dev servers: `npm run dev`
- Edit files (changes are isolated to this worktree)
- Commit changes (commits go to the task branch)
- Run any command - it's a full working copy!

### 4. Completing a Task (Auto-Merge & Cleanup)

When you move a task from **IN PROGRESS** to **DONE**, the system automatically:

1. **Checks for uncommitted changes** in the worktree
2. **Auto-commits** any uncommitted work with message:
   ```
   🤖 Auto-commit: {Task Title}

   This commit was automatically created when the task was marked as done.
   ```
3. **Stashes main branch changes** (if any) to avoid conflicts
4. **Switches to target branch** (default: `main`)
5. **Merges the task branch** into the target
6. **Removes the worktree** and optionally deletes the branch
7. **Restores stashed changes** (if any)

**Merge Strategy:**
- Default merge commit (preserves full history)
- Manual conflict resolution required if conflicts detected
- Main branch remains unchanged if merge fails

**Cleanup Configuration:**
```typescript
// Default settings (in worktreeService.ts)
{
  maxWorktrees: 10,                   // Maximum worktrees per project
  defaultTargetBranch: 'main',        // Where to merge
  cleanupOnMerge: true,               // Remove worktree after merge
  deleteBranchOnMerge: true,          // Delete task branch after merge
}
```

---

## Technical Architecture

### File Structure

```
src/
├── services/
│   └── worktreeService.ts          # Core worktree operations
├── stores/
│   └── kanbanStore.ts              # Lifecycle integration
└── components/kanban/
    ├── AddKanbanTaskModal.tsx      # Worktree checkbox UI
    └── KanbanCard.tsx              # Visual badge + context menu

src-tauri/src/
└── git.rs                          # Rust Git commands
```

### Core Service: `worktreeService.ts`

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `ensureWorktree(task)` | Create worktree if not exists (called on TODO → IN_PROGRESS) |
| `mergeAndCleanup(task)` | Merge branch and remove worktree (called on IN_PROGRESS → DONE) |
| `cleanupWorktree(task)` | Remove worktree and optionally delete branch |
| `hasUncommittedChanges(path)` | Check if worktree has uncommitted work |
| `autoCommitWorktreeChanges(path, title)` | Auto-commit all changes before merge |
| `generateBranchName(task)` | Generate task branch name |
| `generateWorktreePath(task)` | Generate worktree path |

**Branch Naming Logic:**
```typescript
function slugify(text: string, maxLength: 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')     // Remove special chars
    .trim()
    .split(/\s+/)                     // Split by whitespace
    .slice(0, 5)                      // Take first 5 words
    .join('-')
    .slice(0, maxLength);             // Limit length
}

function generateBranchName(task: KanbanTask): string {
  const slug = slugify(task.title);
  const shortId = task.id.slice(-8); // Last 8 chars of task ID
  return `task/${shortId}-${slug}`;
}
```

### Lifecycle Integration: `kanbanStore.ts`

**Worktree Lifecycle Hooks:**

```typescript
// In moveTask() function:
if (newStatus === 'in_progress' && task.status === 'todo') {
  if (task.useWorktree && !task.worktreePath) {
    // CREATE WORKTREE
    const worktreePath = await ensureWorktree(task);
    const branchName = generateBranchName(task);
    updates.worktreePath = worktreePath;
    updates.branch = branchName;
  }
}

if (newStatus === 'done' && task.status !== 'done') {
  if (task.useWorktree && task.worktreePath) {
    // MERGE & CLEANUP
    const result = await mergeAndCleanup(task, {
      defaultTargetBranch: task.targetBranch || 'main',
    });
    if (result.success) {
      updates.worktreePath = undefined; // Clear worktree path
    }
  }
}
```

### Rust Git Commands: `git.rs`

**Tauri Commands:**

| Command | Rust Function | Purpose |
|---------|--------------|---------|
| `git_add_worktree` | `git_add_worktree_impl` | Create new worktree with branch |
| `git_remove_worktree` | `git_remove_worktree_impl` | Remove worktree (with --force option) |
| `git_stage_all` | `git_stage_all_impl` | Stage all changes (git add .) |
| `git_commit` | `git_commit_impl` | Create commit with message |
| `git_stash_push` | `git_stash_push_impl` | Stash changes before merge |
| `git_stash_pop` | `git_stash_pop_impl` | Restore stashed changes |
| `git_merge_branch` | `git_merge_branch_impl` | Merge branch into current |
| `git_switch_branch` | `git_switch_branch_impl` | Checkout different branch |
| `git_delete_branch` | `git_delete_branch_impl` | Delete branch after merge |
| `git_status_summary` | `git_status_summary_impl` | Check for uncommitted changes |

**Example Rust Implementation:**
```rust
#[tauri::command]
pub fn git_add_worktree(
    path: String,
    branch_name: String,
    create_branch: bool,
    root_path: Option<String>,
) -> Result<(), String> {
    git_add_worktree_impl(path, branch_name, create_branch, root_path)
        .map_err(|err| err.to_string())
}
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Drag task TODO → IN_PROGRESS                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ kanbanStore.moveTask()                                       │
│  • Check if task.useWorktree === true                        │
│  • Check if worktree doesn't exist yet                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ worktreeService.ensureWorktree(task)                         │
│  • Generate branch name: task/{id}-{slug}                    │
│  • Generate worktree path: .worktrees/task-{id}              │
│  • Check worktree limit (max 10)                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ invoke('git_add_worktree') → Rust                            │
│  • Execute: git worktree add -b {branch} {path}              │
│  • Create isolated working directory                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Update Task in Store                                         │
│  • task.worktreePath = "/path/to/.worktrees/task-a1b2c3d4"   │
│  • task.branch = "task/a1b2c3d4-fix-auth-bug"                │
│  • task.status = "in_progress"                               │
│  • Save to storage (quack-kanban.json)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ UI Updates                                                   │
│  • Show orange Git badge on card                             │
│  • Enable "Open Terminal in Worktree" context menu           │
│  • Set agent cwd to worktree path                            │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Components

### 1. Task Creation Modal (`AddKanbanTaskModal.tsx`)

**Worktree Checkbox:**
```tsx
<div className="form-group">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={useWorktree}
      onChange={(e) => setUseWorktree(e.target.checked)}
    />
    <span>Use isolated worktree</span>
  </label>
  <p className="help-text">
    Create a separate Git worktree for this task.
    Allows parallel development without switching branches.
  </p>
</div>
```

**What Happens:**
- Checkbox sets `task.useWorktree = true`
- Worktree is NOT created immediately (lazy creation)
- Created only when task moves to IN_PROGRESS

### 2. Kanban Card (`KanbanCard.tsx`)

**Visual Indicator:**
```tsx
{task.useWorktree && task.worktreePath && (
  <div className="worktree-badge" title={task.worktreePath}>
    🌳 Worktree
  </div>
)}
```

**Context Menu:**
```tsx
{task.useWorktree && task.worktreePath && (
  <div
    className="context-menu-item"
    onClick={() => onOpenTerminal?.(task.worktreePath!, `Task: ${task.title}`)}
  >
    Open Terminal in Worktree
  </div>
)}
```

**Styling:**
```css
.worktree-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.3);
  border-radius: 4px;
  font-size: 11px;
  color: #fb923c;
}
```

### 3. Terminal Integration

**Opening Terminal in Worktree:**
```typescript
const handleOpenTerminal = (path: string, label?: string) => {
  invoke('open_terminal_window', {
    initialPath: path,
    label: label || `Terminal: ${path}`,
  });
};
```

**Result:**
- New Terminal Window App opens
- Working directory (`cwd`) set to worktree path
- User can run any command (tests, builds, etc.)

---

## Merge & Conflict Resolution

### Auto-Merge Process

**When task moves to DONE:**

1. **Check worktree for uncommitted changes**
   ```typescript
   const hasChanges = await hasUncommittedChanges(task.worktreePath);
   if (hasChanges) {
     await autoCommitWorktreeChanges(task.worktreePath, task.title);
   }
   ```

2. **Stash main branch changes (if any)**
   ```typescript
   const mainHasChanges = await hasUncommittedChangesInMain(task.projectPath);
   if (mainHasChanges) {
     await invoke('git_stash_push', {
       message: `Auto-stash before merging task ${task.id}`,
       rootPath: task.projectPath,
     });
   }
   ```

3. **Switch to target branch**
   ```typescript
   await invoke('git_switch_branch', {
     branchName: 'main',
     rootPath: task.projectPath,
   });
   ```

4. **Merge task branch**
   ```typescript
   await invoke('git_merge_branch', {
     branchName: task.branch,
     rootPath: task.projectPath,
   });
   ```

5. **Cleanup worktree**
   ```typescript
   await cleanupWorktree(task, deleteBranch = true);
   ```

6. **Restore stashed changes**
   ```typescript
   await invoke('git_stash_pop', {
     rootPath: task.projectPath,
   });
   ```

### Merge Result Types

```typescript
interface MergeResult {
  success: boolean;
  strategy?: 'fast-forward' | 'merge-commit';
  hasConflicts?: boolean;
  conflictedFiles?: string[];
  error?: string;
}
```

**Success Cases:**
- `success: true` - Merge completed, worktree cleaned up
- `success: true, strategy: 'fast-forward'` - Fast-forward merge (clean history)
- `success: true, strategy: 'merge-commit'` - Merge commit created

**Error Cases:**
- `success: false, hasConflicts: true` - Conflicts detected, manual resolution needed
- `success: false, error: string` - Other error (permissions, Git state, etc.)

### Handling Merge Conflicts

**Scenario: Task has conflicts with main branch**

1. **System detects conflicts:**
   ```typescript
   if (errorStr.includes('conflict') || errorStr.includes('CONFLICT')) {
     const conflictedFiles = await getConflictedFiles(task.projectPath);
     return {
       success: false,
       hasConflicts: true,
       conflictedFiles,
       error: 'Merge conflicts detected. Please resolve them manually.',
     };
   }
   ```

2. **User sees error notification:**
   ```
   ⚠️ Merge conflicts in:
   - src/auth/login.ts
   - src/api/users.ts

   Please resolve manually in the main repository.
   ```

3. **Manual Resolution Steps:**
   ```bash
   # In main repository (not worktree)
   cd /path/to/project

   # Check merge status
   git status

   # Resolve conflicts in your editor
   # Then stage resolved files
   git add .

   # Complete merge
   git commit

   # Now you can manually cleanup the worktree
   git worktree remove .worktrees/task-a1b2c3d4
   git branch -d task/a1b2c3d4-fix-auth-bug
   ```

4. **Or abort merge:**
   ```typescript
   await worktreeService.abortMerge(task.projectPath);
   ```

### Conflict Prevention Best Practices

1. **Keep tasks small and focused** - Reduces likelihood of conflicts
2. **Pull main branch before starting** - Work from latest code
3. **Communicate with team** - Know what files others are touching
4. **Merge frequently** - Don't let task branches diverge too much

---

## Troubleshooting

### Common Issues

#### 1. "Maximum worktrees limit (10) reached"

**Problem:** You have 10 or more active worktrees in the project.

**Solution:**
```typescript
// Option A: Complete or cancel some tasks
// Option B: Increase limit (in worktreeService.ts)
const DEFAULT_CONFIG: WorktreeConfig = {
  maxWorktrees: 20, // Increase limit
  // ...
};
```

**Check active worktrees:**
```bash
git worktree list
```

#### 2. "Failed to switch to main: uncommitted changes"

**Problem:** Main branch has uncommitted changes that conflict with checkout.

**Solution:**
The system should auto-stash, but if it fails:
```bash
cd /path/to/project
git stash push -m "Manual stash before merge"
# Then retry task completion
```

#### 3. Worktree path not cleaning up after merge

**Problem:** Worktree directory still exists after task completion.

**Solution:**
```bash
# Manually remove worktree
git worktree remove .worktrees/task-a1b2c3d4 --force

# Or prune broken worktrees
git worktree prune
```

#### 4. "Branch already exists" when starting task

**Problem:** Task branch from previous attempt still exists.

**Solution:**
```bash
# Delete old branch (if safe)
git branch -d task/a1b2c3d4-old-name

# Or force delete
git branch -D task/a1b2c3d4-old-name
```

#### 5. Terminal can't access worktree files

**Problem:** Opened terminal but `cd` to worktree fails.

**Solution:**
- Check worktree still exists: `git worktree list`
- Verify path: `ls .worktrees/task-{id}`
- Recreate if missing (move task back to TODO, then to IN_PROGRESS)

### Debugging Commands

**Check worktree status:**
```bash
git worktree list
```

**Check task branch:**
```bash
git branch | grep task/
```

**Inspect worktree Git state:**
```bash
cd .worktrees/task-a1b2c3d4
git status
git log --oneline -5
```

**View merge state:**
```bash
git status
cat .git/MERGE_HEAD  # If merge in progress
```

---

## Best Practices

### When to Use Worktrees

**✅ Good Use Cases:**
- Tasks requiring different dependencies or build configurations
- Long-running tasks (experiments, refactors, large features)
- Tasks where you need to run tests independently
- Parallel bug fixes that need separate testing
- Code review workflows (check out PR branch in worktree)

**❌ When NOT to Use:**
- Quick one-file changes (overhead not worth it)
- Simple documentation updates
- Tasks that will complete in <10 minutes
- When disk space is limited (worktrees duplicate working files)

### Workflow Recommendations

1. **Use descriptive task titles** - They become branch names
2. **Keep tasks small** - Easier to merge, fewer conflicts
3. **Commit frequently in worktree** - Don't rely on auto-commit
4. **Test before marking DONE** - Auto-merge doesn't run tests
5. **Pull main regularly** - Keep worktree in sync with upstream
6. **Clean up old tasks** - Don't let worktrees accumulate

### Performance Tips

**Disk Space:**
- Each worktree adds ~size of working directory
- `.git` objects are shared (no duplication)
- 10 worktrees ≈ 10× working directory size

**Memory:**
- Running builds in multiple worktrees = multiple Node/Cargo processes
- Watch mode in each worktree = additional file watchers
- Limit concurrent active worktrees (default: 10)

**Git Performance:**
- Worktrees share `.git/objects` (no performance impact)
- Many stale worktrees slow down `git worktree list`
- Run `git worktree prune` periodically

---

## Configuration

### Default Settings

Located in `src/services/worktreeService.ts`:

```typescript
const DEFAULT_CONFIG: WorktreeConfig = {
  maxWorktrees: 10,                   // Maximum worktrees per project
  defaultTargetBranch: 'main',        // Merge destination
  cleanupOnMerge: true,               // Auto-remove worktree after merge
  deleteBranchOnMerge: true,          // Auto-delete task branch after merge
};
```

### Per-Task Override

You can override settings when calling merge:

```typescript
await mergeAndCleanup(task, {
  defaultTargetBranch: 'develop',     // Custom target branch
  cleanupOnMerge: false,              // Keep worktree after merge
  deleteBranchOnMerge: false,         // Keep branch after merge
});
```

### Worktree Location

**Default:** `.worktrees/task-{shortId}` in project root

**Example:**
```
/Users/you/project/
├── .git/
├── .worktrees/
│   ├── task-a1b2c3d4/   (Task 1 worktree)
│   ├── task-e5f6g7h8/   (Task 2 worktree)
│   └── task-i9j0k1l2/   (Task 3 worktree)
├── src/
└── package.json
```

**Why `.worktrees/`?**
- Clear naming (obvious purpose)
- Easy to gitignore (add `.worktrees/` to `.gitignore`)
- Isolated from main code (no accidental file conflicts)

---

## Related Documentation

- **Kanban Board**: `docs/05-features/kanban-board.md` - Overall Kanban system
- **Git Integration**: `docs/01-architecture.md#git-integration` - Git architecture
- **Terminal System**: `docs/01-architecture.md#terminal-system` - Terminal integration

---

## Future Enhancements

### Planned Features

- [ ] **Worktree Templates** - Pre-configure worktrees with dependencies installed
- [ ] **Visual Merge Conflict Resolver** - In-app conflict resolution UI
- [ ] **Worktree Metrics** - Track disk usage, stale worktrees
- [ ] **Auto-Sync** - Keep worktree in sync with main branch (rebase/merge)
- [ ] **Worktree Snapshots** - Checkpoint worktree state before risky operations
- [ ] **Parallel Testing** - Run tests in all worktrees simultaneously
- [ ] **Worktree Sharing** - Export worktree as tarball for team collaboration

### Experimental Ideas

- **Multi-Branch Tasks** - Single task across multiple branches/worktrees
- **Worktree Preloading** - Create worktrees in background for faster task start
- **Smart Cleanup** - Auto-remove stale worktrees after N days
- **Worktree Diff View** - Compare changes across worktrees

---

## Appendix: Git Worktree Primer

### What is `git worktree`?

Git worktrees are a built-in Git feature (since v2.5) that allows you to have multiple working directories attached to the same repository.

**Traditional Git workflow:**
```bash
git checkout feature-branch     # Switch branch (changes current directory)
# Make changes
git checkout main               # Switch back (discards feature-branch view)
```

**With worktrees:**
```bash
git worktree add ../feature .worktrees/feature-branch
# Now you have TWO directories:
# - /path/to/project (main branch)
# - /path/to/project/.worktrees/feature-branch (feature branch)
```

### Key Git Commands

**Create worktree:**
```bash
git worktree add -b <branch-name> <path>
```

**List worktrees:**
```bash
git worktree list
```

**Remove worktree:**
```bash
git worktree remove <path>
```

**Prune stale worktrees:**
```bash
git worktree prune
```

### Worktree Internals

**Shared:**
- `.git/objects` (all commits, trees, blobs)
- `.git/refs` (branches, tags)
- `.git/config` (repository configuration)

**Separate:**
- Working directory files
- `.git/index` (staging area)
- `.git/HEAD` (current branch)

**Result:** Lightweight worktrees (~same size as working directory, not full repo clone)

---

**Last Updated**: 2026-01-07
**Contributors**: Agent Magnus (Documentation Writer Expert)
