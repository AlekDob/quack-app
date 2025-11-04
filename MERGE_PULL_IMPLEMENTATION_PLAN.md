# Git Merge & Pull Implementation Plan

## Overview
Implement merge functionality for branches and pull capability for remote commits in the Quack Git Panel. This will complete the Git workflow integration allowing users to fully manage their repositories from within the app.

## Current State

### Already Implemented ✅
- Git Panel with Fork-style layout (3 columns: Branches, Files, Timeline)
- Branch listing with folder structure (agent/, feature/, etc.)
- Branch switching functionality
- Branch creation (via terminal modal)
- Branch deletion (with safety checks - prevents deleting main/master/current)
- Push functionality (button in header, shows ahead count)
- Stage/Unstage files
- Commit functionality
- Diff viewer (in separate drawer)
- Agent ↔ Branch integration (avatars on branches)
- Remote branch tracking

### Backend Commands Already Available ✅
Located in `src-tauri/src/git.rs`:
- `git_merge_branch` - Merge with automatic conflict detection
- `git_abort_merge` - Cancel ongoing merge
- `git_resolve_conflict` - Resolve conflicts with strategies (ours/theirs)
- `git_get_conflicts` - Get list of conflicted files with status

### Missing Implementation ❌
1. **Pull functionality** - Fetch and merge remote changes
2. **UI for merge operations** - Trigger merge from branch list
3. **Conflict resolution UI** - Already created but not integrated
4. **Pull button in header** - Similar to Push button

## Architecture

### File Structure
```
src/
├── components/
│   ├── GitPanel.tsx              # Main Git panel (already has merge commands)
│   ├── GitSidebar.tsx            # Branches tree (needs merge UI integration)
│   ├── GitFilesColumn.tsx        # Unstaged/Staged files
│   ├── ConflictResolver.tsx      # Conflict resolution UI (created, not integrated)
│   └── DiffDrawer.tsx            # Diff viewer drawer
├── types.ts                       # Type definitions
└── App.tsx                        # Main app (state management)

src-tauri/src/
├── git.rs                         # Git commands (merge already implemented)
└── lib.rs                         # Command registration
```

## Implementation Plan

### Phase 1: Pull Functionality (Backend)

#### 1.1 Create Git Pull Command (Rust)
**File:** `src-tauri/src/git.rs`

**New Function:**
```rust
#[tauri::command]
pub fn git_pull(
    branch_name: String,
    root_path: Option<String>
) -> Result<GitPullResult, String> {
    git_pull_impl(branch_name, root_path).map_err(|e| e.to_string())
}

fn git_pull_impl(
    branch_name: String,
    root_path: Option<String>
) -> Result<GitPullResult> {
    // Implementation details:
    // 1. Get git root directory
    // 2. Ensure clean working tree (or allow with conflicts)
    // 3. Run: git pull origin <branch_name>
    // 4. Detect merge conflicts (similar to git_merge_branch)
    // 5. Return result with:
    //    - success: bool
    //    - has_conflicts: bool
    //    - conflicted_files: Vec<String>
    //    - ahead: i32 (new commits pulled)
    //    - message: String
}
```

**New Type:**
```rust
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitPullResult {
    pub success: bool,
    pub has_conflicts: bool,
    pub conflicted_files: Vec<String>,
    pub commits_pulled: i32,
    pub message: String,
}
```

#### 1.2 Register Pull Command
**File:** `src-tauri/src/lib.rs`

Add to `invoke_handler!`:
```rust
git_pull,
```

### Phase 2: Pull Functionality (Frontend)

#### 2.1 Add Pull Button to Git Panel Header
**File:** `src/components/GitPanel.tsx`

**Location:** Header, next to Push button

**Implementation:**
```typescript
// State
const [pulling, setPulling] = useState(false);

// Handler
const handlePull = async () => {
  if (!summary?.branch || pulling) return;

  setPulling(true);
  try {
    const result: GitPullResult = await invoke('git_pull', {
      branchName: summary.branch,
      rootPath,
    });

    if (result.hasConflicts) {
      // Show conflict resolver
      setConflictedFiles(result.conflictedFiles);
      setShowConflictResolver(true);
    } else {
      // Success - refresh panel
      await refreshGitData();
      if (result.commitsPulled > 0) {
        alert(`Successfully pulled ${result.commitsPulled} commit(s)`);
      }
    }
  } catch (error) {
    alert(`Pull failed: ${error}`);
  } finally {
    setPulling(false);
  }
};

// UI
{summary?.behind > 0 && (
  <button
    className="git-pull-button"
    onClick={handlePull}
    disabled={pulling}
  >
    {pulling ? 'Pulling…' : `Pull ↓ ${summary.behind}`}
  </button>
)}
```

#### 2.2 Add CSS for Pull Button
**File:** `src/App.css`

```css
.git-pull-button {
  padding: 0.5rem 0.875rem;
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  color: #60a5fa;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.git-pull-button:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
}

.git-pull-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### 2.3 Add TypeScript Type
**File:** `src/types.ts`

```typescript
export interface GitPullResult {
  success: boolean;
  hasConflicts: boolean;
  conflictedFiles: string[];
  commitsPulled: number;
  message: string;
}
```

### Phase 3: Merge from Branch List

#### 3.1 Add Merge Button to Branch Items
**File:** `src/components/GitSidebar.tsx`

**Location:** In branch item (on hover or always visible)

**Implementation:**
```typescript
// Add to branch item rendering
<div className="git-sidebar-branch-actions">
  {!branch.isCurrent && (
    <button
      className="branch-action-button merge"
      onClick={(e) => {
        e.stopPropagation();
        onMergeBranch?.(branch.name);
      }}
      title={`Merge ${branch.name} into current branch`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
        <line x1="6" y1="9" x2="6" y2="21" />
      </svg>
      Merge
    </button>
  )}
</div>
```

#### 3.2 Add Merge Handler in GitPanel
**File:** `src/components/GitPanel.tsx`

**Implementation:**
```typescript
const handleMergeBranch = async (branchName: string) => {
  if (!summary?.branch) return;

  const confirmed = confirm(
    `Merge "${branchName}" into "${summary.branch}"?\n\n` +
    `This will merge all changes from ${branchName} into your current branch.`
  );

  if (!confirmed) return;

  setMerging(true);
  try {
    const result: GitMergeResult = await invoke('git_merge_branch', {
      branchName,
      rootPath,
    });

    if (result.hasConflicts) {
      // Show conflict resolver
      setConflictedFiles(result.conflictedFiles);
      setShowConflictResolver(true);
      setMergeInProgress(branchName);
    } else {
      // Success
      await refreshGitData();
      alert(`Successfully merged ${branchName} into ${summary.branch}`);
    }
  } catch (error) {
    alert(`Merge failed: ${error}`);
  } finally {
    setMerging(false);
  }
};

// Pass to GitSidebar
<GitSidebar
  // ... other props
  onMergeBranch={handleMergeBranch}
/>
```

#### 3.3 Add CSS for Branch Actions
**File:** `src/components/GitSidebar.css`

```css
.git-sidebar-branch-actions {
  display: none;
  gap: 0.25rem;
  margin-left: auto;
}

.git-sidebar-branch-item:hover .git-sidebar-branch-actions {
  display: flex;
}

.branch-action-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: rgba(168, 182, 221, 0.7);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.branch-action-button.merge:hover {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}
```

### Phase 4: Conflict Resolution Integration

#### 4.1 Integrate ConflictResolver Component
**File:** `src/components/GitPanel.tsx`

The ConflictResolver component is already created (`src/components/ConflictResolver.tsx`). We need to:

**State:**
```typescript
const [showConflictResolver, setShowConflictResolver] = useState(false);
const [conflictedFiles, setConflictedFiles] = useState<GitConflictFile[]>([]);
const [mergeInProgress, setMergeInProgress] = useState<string | null>(null);
```

**Render:**
```typescript
{showConflictResolver && (
  <ConflictResolver
    files={conflictedFiles}
    onResolve={handleResolveConflicts}
    onAbort={handleAbortMerge}
    onClose={() => setShowConflictResolver(false)}
  />
)}
```

**Handlers:**
```typescript
const handleResolveConflicts = async (
  resolutions: { file: string; strategy: 'ours' | 'theirs' }[]
) => {
  try {
    for (const { file, strategy } of resolutions) {
      await invoke('git_resolve_conflict', {
        filePath: file,
        strategy,
        rootPath,
      });
    }

    // Refresh and close
    await refreshGitData();
    setShowConflictResolver(false);
    setMergeInProgress(null);
    alert('Conflicts resolved successfully!');
  } catch (error) {
    alert(`Failed to resolve conflicts: ${error}`);
  }
};

const handleAbortMerge = async () => {
  const confirmed = confirm(
    'Abort merge and return to previous state?\n\n' +
    'This will discard all merge changes.'
  );

  if (!confirmed) return;

  try {
    await invoke('git_abort_merge', { rootPath });
    await refreshGitData();
    setShowConflictResolver(false);
    setMergeInProgress(null);
    alert('Merge aborted successfully');
  } catch (error) {
    alert(`Failed to abort merge: ${error}`);
  }
};
```

### Phase 5: Enhanced UX

#### 5.1 Pull on Startup (Optional)
**File:** `src/components/GitPanel.tsx`

Add auto-fetch on panel open to check for remote changes:
```typescript
useEffect(() => {
  if (isOpen && summary?.branch) {
    // Fetch (don't merge) to update remote tracking
    invoke('git_fetch', { rootPath }).catch(console.error);
  }
}, [isOpen]);
```

#### 5.2 Visual Indicators
- **Behind count badge** on branch items (if behind remote)
- **Merge in progress indicator** when conflicts detected
- **Loading states** for pull/merge operations

#### 5.3 Notifications
- Desktop notification on successful pull (if behind > 0)
- Desktop notification on merge conflicts
- Sound feedback (quack!) on successful operations

## Testing Checklist

### Pull Functionality
- [ ] Pull button appears when behind > 0
- [ ] Pull button disabled during operation
- [ ] Successful pull updates timeline
- [ ] Pull with conflicts shows ConflictResolver
- [ ] Pull with no remote changes shows message
- [ ] Pull updates ahead/behind counts

### Merge Functionality
- [ ] Merge button appears on non-current branches
- [ ] Merge confirmation dialog shows
- [ ] Successful merge updates branch list
- [ ] Merge with conflicts shows ConflictResolver
- [ ] Cannot merge current branch into itself
- [ ] Merge preserves agent associations

### Conflict Resolution
- [ ] ConflictResolver shows all conflicted files
- [ ] "Accept Ours" strategy works
- [ ] "Accept Theirs" strategy works
- [ ] "Abort Merge" returns to clean state
- [ ] Select all functionality works
- [ ] Help section is informative

### Integration
- [ ] Pull → Conflicts → Resolve → Success flow
- [ ] Merge → Conflicts → Resolve → Success flow
- [ ] Merge → Conflicts → Abort → Clean state
- [ ] Git Panel refreshes after operations
- [ ] Terminal updates if git commands run

## Edge Cases to Handle

### Pull
1. **Dirty working tree** - Warn user to commit/stash first
2. **No remote branch** - Show error message
3. **Network failure** - Graceful error handling
4. **Diverged branches** - Suggest merge or rebase

### Merge
1. **Fast-forward merge** - Success message without conflicts
2. **Already merged** - Inform user
3. **Unrelated histories** - Allow with --allow-unrelated-histories
4. **Binary file conflicts** - Special handling needed

### Conflicts
1. **Too many conflicts** - Paginate file list
2. **Large files** - Warn before resolving
3. **Deleted files** - Special UI indication
4. **Both modified** - Default to manual resolution

## Future Enhancements (Not in This Plan)

- Rebase functionality
- Cherry-pick commits
- Interactive conflict resolution (line-by-line)
- Merge strategies selection (recursive, ours, theirs)
- Visual merge tree/graph
- Compare branches before merge
- Fetch vs Pull distinction in UI
- Branch protection rules

## Success Criteria

The implementation is complete when:
1. ✅ Pull button works and updates local branch
2. ✅ Merge from branch list works
3. ✅ Conflict resolution UI shows and resolves conflicts
4. ✅ All operations properly refresh Git Panel
5. ✅ Error handling is robust and user-friendly
6. ✅ UI is consistent with existing Fork-style design
7. ✅ Agent ↔ Branch associations are preserved
8. ✅ All testing checklist items pass

## Notes for Implementation Agent

- **Backend commands are ALREADY IMPLEMENTED** in `src-tauri/src/git.rs` - just need registration for `git_pull`
- **ConflictResolver component EXISTS** - just needs integration
- **Follow existing patterns** from Push button and Branch delete
- **Use same color scheme**: Blue for Pull, Green for Merge success
- **Maintain Fork-style design** - clean, minimal, functional
- **Test with real repositories** - don't just assume it works
- **Handle errors gracefully** - Git operations can fail in many ways
- **Document any deviations** from this plan in commit messages

## Estimated Implementation Time

- Phase 1 (Pull Backend): 30 minutes
- Phase 2 (Pull Frontend): 1 hour
- Phase 3 (Merge UI): 1 hour
- Phase 4 (Conflict Integration): 1 hour
- Phase 5 (UX Polish): 30 minutes
- Testing & Bug Fixes: 1 hour

**Total: ~5 hours**

---

**Created:** 2025-11-03
**For:** Quack App Git Panel Enhancement
**Agent:** To be assigned
**Priority:** High
**Status:** Ready for Implementation

🦆 Quack quack! This plan is comprehensive and ready to go!
