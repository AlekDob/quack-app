---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-04
last_verified: 2026-04-04
tags: [changes-panel, git, branches, worktrees, remotes, source-control]
---

## Source Control Sections — Branches, Worktrees, Remotes
**Purpose:** Expand the Changes Panel from 3 tabs (Pending/Committed/History) to 6 tabs, adding Branches, Worktrees, and Remotes for a complete source control experience without leaving the sidebar.
**Stack:** React 18, TypeScript strict, Tauri v2 invoke, Rust

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/ChangesPanel.tsx | Orchestrator (159 lines). Routes to tab components, manages badge counts via `Promise.all` |
| Component | src/components/ChangesPanelTabs.tsx | 6-tab scrollable bar with color-coded badges. Exports `ActiveTab` type |
| Component | src/components/ChangesPanelContextBar.tsx | Context bar: project name, branch icon, worktree badge |
| Component | src/components/BranchesTab.tsx | Branch list with switch, create (inline input), delete (confirm modal) |
| Component | src/components/WorktreesTab.tsx | Worktree list with add (path + branch inputs), remove (confirm modal) |
| Component | src/components/RemotesTab.tsx | Read-only remote list (name + URL), empty state: "No remotes configured" |
| Component | src/components/PendingTab.tsx | Extracted from old ChangesPanel: pending file list, stage/discard, commit button |
| Component | src/components/CommittedTab.tsx | Extracted from old ChangesPanel: committed file list, clear all button |
| Component | src/components/HistoryTab.tsx | Extracted from old ChangesPanel: git timeline via GitTimelineItem |
| Component | src/components/FileRow.tsx | Shared file row: chevron expand, status badge (N/M/D), inline diff, stage/discard/editor actions |
| Service | src/hooks/useChangesPanelState.ts | All git state + callbacks: expand/collapse, diff loading, stage, discard, commit, reconcile with git |
| Rust | src-tauri/src/git.rs | `git_list_remotes` command + `GitRemote` struct (parses `git remote -v`, deduplicates fetch/push) |
| Model/Type | src/types.ts | `GitRemote` interface (`name`, `url`), `FileStatus` type (`'new' \| 'modified' \| 'deleted'`), `DiffState` interface (`content`, `loading`) — shared across PendingTab, CommittedTab, FileRow, useChangesPanelState |
| Config | src/components/ChangesPanel.css | Scrollable tab bar, color-coded badges, `sc-*` shared styles for source control rows |

### Tab Layout
```
Pend. | Comm. | Hist. | Branch | Tree | Remote
```
- Green badge: pending count
- Blue badge: committed count
- Amber badge: history count
- Purple badge: branch count
- Sky badge: worktree count
- Pink badge: remote count

### Data Flow
- `[Mount/lastRefreshTs]` --> `[ChangesPanel.loadCounts()]` --> `[Promise.all: git_list_branches, git_list_worktrees, git_list_remotes]` --> `[badge state]`
- `[Tab click]` --> `[ActiveTab state]` --> `[Lazy render: BranchesTab/WorktreesTab/RemotesTab]` --> `[invoke on mount]` --> `[local state]`
- `[BranchesTab.handleSwitch]` --> `[git_switch_branch]` --> `[onBranchSwitch callback]` --> `[onRefreshGitStatus + loadCounts]`
- `[useChangesPanelState.reconcileWithGit]` --> `[git_check_files_dirty]` --> `[committedFiles set update]`

### Key Functions
- `ChangesPanel(props) --> JSX` — orchestrates tabs, badge counts, modals
- `loadCounts() --> void` — fetches branch/worktree/remote counts in parallel
- `handleBranchSwitch(branchName: string) --> void` — triggers refresh after branch switch
- `useChangesPanelState(params) --> StateAndHandlers` — all pending/committed state, diff cache, stage/discard/commit handlers
- `reconcileWithGit() --> void` — checks files dirty via git, moves clean files to committed set
- `loadDiff(filePath: string, status: FileStatus) --> void` — fetches diff content for inline display
- `toggleFile(filePath: string) --> void` — expand/collapse file row + lazy diff load
- `handleStageFile(filePath: string) --> void` — stages single file via `git_stage`
- `handleDiscardFile(filePath: string) --> void` — discards or triggers delete confirm for new files
- `handleCommit() --> void` — stages all + commits + moves to committed set
- `BranchesTab.handleSwitch(branchName: string) --> void` — switches branch via `git_switch_branch`
- `BranchesTab.handleCreate() --> void` — creates branch via `git_create_branch`
- `BranchesTab.handleDelete() --> void` — deletes branch via `git_delete_branch` (non-force)
- `WorktreesTab.handleAdd() --> void` — adds worktree via `git_add_worktree`
- `WorktreesTab.handleRemove() --> void` — removes worktree via `git_remove_worktree`
- `git_list_remotes(root_path: Option<String>) --> Result<Vec<GitRemote>, String>` — parses `git remote -v`, deduplicates by name

### State
- `activeTab`: ActiveTab — current tab selection (component)
- `branchCount`: number — badge count for branches tab (component)
- `worktreeCount`: number — badge count for worktrees tab (component)
- `remoteCount`: number — badge count for remotes tab (component)
- `expandedFiles`: Set<string> — which files have diff panel open (component, via hook)
- `diffCache`: Map<string, DiffState> — cached diff content per file (component, via hook)
- `stagedFiles`: Set<string> — files staged via UI (component, via hook)
- `committedFiles`: Set<string> — files detected as committed after reconcile (component, via hook)
- `branches`: GitBranch[] — local branch list in BranchesTab (component)
- `worktrees`: GitWorktree[] — worktree list in WorktreesTab (component)
- `remotes`: GitRemote[] — remote list in RemotesTab (component)

### External Dependencies
- Tauri invoke: `git_list_branches`, `git_list_worktrees`, `git_list_remotes`, `git_switch_branch`, `git_create_branch`, `git_delete_branch`, `git_add_worktree`, `git_remove_worktree`, `git_check_files_dirty`, `git_stage`, `git_stage_all`, `git_commit`, `git_diff`, `git_discard_file`, `read_file_content`
- `sonner`: toast notifications for all git operations
- `ConfirmModal`: shared confirm dialog for delete/remove actions

### Key Design Decisions
- **Refactored ChangesPanel**: 627 lines --> 159 lines via extraction of 7 sub-components + 1 hook
- **Simplified BranchesTab**: stripped-down version of BranchManager (no filters, no merge modal, no agent detection)
- **Tab labels abbreviated**: `Pend. | Comm. | Hist.` to fit 6 tabs in sidebar width
- **Scrollable tab bar**: CSS `overflow-x: auto` with hidden scrollbar for narrow panels
- **Lazy tab rendering**: each tab only mounts when selected, fetches its own data on mount
- **Shared `sc-*` CSS classes**: source control rows, headers, actions, delete buttons reused across Branches/Worktrees/Remotes
- **Protected branches**: main/master cannot be deleted from BranchesTab UI
- **Worktree path truncation**: `truncatePath()` shows only last 2 segments for long paths

### Brain References
- `documentation/patterns/pattern-changes-panel.md` — ChangesPanel architecture
- `documentation/features/032-changes-panel-agent-commit-refresh.md` — agent commit detection
