# Implementation Plan: Source Control Sections

## Technology Stack

### Frontend
- React 18 + TypeScript strict (existing)
- Zustand: NOT needed — state lives in component (consistent with ChangesPanel pattern)
- CSS: Extend existing `ChangesPanel.css`

### Backend
- Rust git.rs: Add `git_list_remotes` command + `GitRemote` struct
- All other commands already exist

## Architecture

### Problem: ChangesPanel.tsx is 627 lines (over 300-line limit)
Adding 3 more tabs would push it to ~900+ lines. Must refactor first.

### Solution: Extract tab content into sub-components

```
ChangesPanel.tsx (orchestrator, ~120 lines)
  ├── PendingTab.tsx (~150 lines) — extracted from current inline rendering
  ├── CommittedTab.tsx (~80 lines) — extracted from current inline rendering  
  ├── HistoryTab.tsx (~60 lines) — extracted from current inline rendering
  ├── BranchesTab.tsx (~120 lines) — adapted from BranchManager.tsx (simplified)
  ├── WorktreesTab.tsx (~80 lines) — new component
  └── RemotesTab.tsx (~50 lines) — new component
```

### Data Flow

```
SidePanelAccordion
  → ChangesPanel (manages activeTab, shared state)
    → invoke('git_list_branches') when Branches tab active
    → invoke('git_list_worktrees') when Worktrees tab active
    → invoke('git_list_remotes') when Remotes tab active (NEW)
    → lazy loading: each tab fetches data only when first activated
```

### Tab Type Extension

```typescript
// Before
type ActiveTab = 'pending' | 'committed' | 'history'

// After
type ActiveTab = 'pending' | 'committed' | 'history' | 'branches' | 'worktrees' | 'remotes'
```

## Component Design

### ChangesPanel.tsx (Orchestrator)
- **Responsibility**: Context bar, tab bar rendering, tab switching, shared state (rootPath, branch)
- **Pattern**: Renders active tab component via switch statement
- **Props**: Same as current + no new props needed (sub-components invoke Tauri directly)

### BranchesTab.tsx
- **Responsibility**: List branches, switch, create, delete
- **Adapted from**: BranchManager.tsx (stripped of filters, merge modal, agent detection)
- **Interfaces**: `rootPath`, `currentBranch`, `onBranchSwitch`
- **Actions**: Click to switch, "+" button to create, trash icon to delete
- **NO**: filter pills, merge modal, conflict resolver, agent avatars

### WorktreesTab.tsx
- **Responsibility**: List worktrees with path/branch/hash, add/remove
- **Data**: `invoke('git_list_worktrees', { rootPath })`
- **Actions**: "+" button for add modal (path + branch inputs), trash icon for remove
- **Display**: Path (truncated), branch name, short hash

### RemotesTab.tsx
- **Responsibility**: List remotes with name and URL
- **Data**: `invoke('git_list_remotes', { rootPath })` (NEW command)
- **Actions**: Read-only in v1. Just display name + URL.
- **Display**: Remote name bold, URL below in muted text

### PendingTab.tsx / CommittedTab.tsx / HistoryTab.tsx
- **Extracted from**: Current ChangesPanel.tsx inline rendering
- **Purpose**: Keep each tab under 150 lines, make ChangesPanel orchestrator-only

## Rust Backend Changes

### New command: `git_list_remotes`

```rust
#[derive(Debug, Clone, serde::Serialize)]
pub struct GitRemote {
    pub name: String,
    pub url: String,
}

#[tauri::command]
pub async fn git_list_remotes(root_path: String) -> Result<Vec<GitRemote>, String> {
    // Run: git remote -v
    // Parse output: origin	https://github.com/... (fetch)
    // Deduplicate (fetch/push same remote) 
}
```

Register in `main.rs` invoke handler list.

## Tab Bar Overflow Strategy

6 tabs in a sidebar panel may not fit. Strategy:
- Use compact tab labels: `Pending | Committed | History | Branches | Worktrees | Remotes`
- Reduce font-size for tabs to 11px (from current ~12px)
- Allow horizontal scroll on tab bar if needed (CSS `overflow-x: auto`)
- Consider abbreviated labels if space is tight: `Pend. | Comm. | Hist. | Branch | Tree | Remote`

## Refresh Strategy

- Branches/Worktrees/Remotes tabs use lazy loading (fetch on first activation)
- Re-fetch when `lastRefreshTs` changes (agent commit detected)
- Re-fetch on `window.focus` event (same as existing reconciliation)
- Cache data per-tab to avoid re-fetching on tab switch within same session

## Error Handling

Each tab handles its own error state:
```typescript
const [error, setError] = useState<string | null>(null)
// On invoke failure → setError(err.message) → render inline error
```

## Security Considerations
- All git operations are local filesystem only
- No credentials exposed in UI (remote URLs may contain tokens — consider masking)
- Delete operations (branch, worktree) require ConfirmModal

## Performance Strategy
- Lazy tab loading: no upfront cost for inactive tabs
- Branch list: cached after first load, refreshed on focus/commit events
- No polling — event-driven refresh only
