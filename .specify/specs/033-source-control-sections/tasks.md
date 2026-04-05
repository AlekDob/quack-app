# Implementation Tasks: Source Control Sections (033)

## Phase 1: Backend — Rust `git_list_remotes`

- [x] 1.1 Implement `GitRemote` struct and `git_list_remotes` command in `src-tauri/src/git.rs`
  - Parse `git remote -v` output
  - Deduplicate fetch/push entries
  - Return `Vec<GitRemote>` with name + url
  - **Depends on**: None
  - **Requirement**: FR-008

- [x] 1.2 Register `git_list_remotes` in Tauri invoke handler (`main.rs` or `lib.rs`)
  - **Depends on**: 1.1
  - **Requirement**: FR-008

- [x] 1.3 [P] Add `GitRemote` TypeScript type in `src/types.ts`
  - **Depends on**: None
  - **Requirement**: FR-007

## Phase 2: Refactor — Extract existing tabs into sub-components

- [x] 2.1 Extract `PendingTab.tsx` from ChangesPanel inline rendering
  - Move pending file list rendering, stage/discard actions, commit button
  - Props: rootPath, pendingEntries, onStage, onDiscard, onCommit, etc.
  - **Depends on**: None
  - **Requirement**: SC-005

- [x] 2.2 [P] Extract `CommittedTab.tsx` from ChangesPanel inline rendering
  - Move committed file list rendering, clear action
  - Props: rootPath, committedEntries, onClear
  - **Depends on**: None
  - **Requirement**: SC-005

- [x] 2.3 [P] Extract `HistoryTab.tsx` from ChangesPanel inline rendering
  - Move GitTimelineItem rendering, loading state
  - Props: history, historyLoading
  - **Depends on**: None
  - **Requirement**: SC-005

- [x] 2.4 Slim down ChangesPanel.tsx to orchestrator role
  - Keep: context bar, tab bar, state management, reconcileWithGit
  - Delegate: tab content to sub-components
  - Verify: file stays under 300 lines
  - **Depends on**: 2.1, 2.2, 2.3
  - **Requirement**: SC-005

## Phase 3: New tab components

- [x] 3.1 Create `BranchesTab.tsx` — simplified branch list
  - Adapt from BranchManager.tsx: strip filters, merge modal, agent detection
  - List branches with current marker, switch on click
  - "+" button for inline branch creation (input + enter)
  - Trash icon for branch deletion with ConfirmModal
  - Props: rootPath, currentBranch, onBranchSwitch
  - **Depends on**: 2.4
  - **Requirement**: FR-003, FR-004

- [x] 3.2 [P] Create `WorktreesTab.tsx` — worktree list with add/remove
  - Fetch via `invoke('git_list_worktrees')`
  - Display: path (truncated), branch, short hash
  - "+" button for add modal (path + branch inputs)
  - Trash icon for remove with ConfirmModal
  - Props: rootPath
  - **Depends on**: 2.4
  - **Requirement**: FR-005, FR-006

- [x] 3.3 [P] Create `RemotesTab.tsx` — read-only remote list
  - Fetch via `invoke('git_list_remotes')`
  - Display: name bold, URL muted below
  - Empty state: "Nessun remote configurato"
  - Props: rootPath
  - **Depends on**: 1.1, 1.2, 1.3, 2.4
  - **Requirement**: FR-007

## Phase 4: Integration — Wire tabs into ChangesPanel

- [x] 4.1 Extend `ActiveTab` type and add tab buttons for Branches/Worktrees/Remotes
  - Add badge counts on each tab
  - Handle tab overflow (CSS horizontal scroll or compact labels)
  - **Depends on**: 3.1, 3.2, 3.3
  - **Requirement**: FR-001, FR-002

- [x] 4.2 Wire lazy loading — fetch data only when tab first activated
  - Track `loadedTabs` set to avoid redundant fetches
  - Re-fetch on `lastRefreshTs` change and `window.focus`
  - **Depends on**: 4.1
  - **Requirement**: FR-010

- [x] 4.3 Wire `onBranchSwitch` from BranchesTab back to parent
  - Update context bar branch name
  - Reset pending/committed state on branch switch
  - Trigger `onRefreshGitStatus()` callback
  - **Depends on**: 4.1
  - **Requirement**: SC-002

## Phase 5: CSS & Polish

- [x] 5.1 Style new tabs and tab overflow in `ChangesPanel.css`
  - Compact tab labels at 11px
  - Horizontal scroll if needed
  - Badge styling consistent with History tab
  - **Depends on**: 4.1
  - **Requirement**: FR-002

- [x] 5.2 Style BranchesTab, WorktreesTab, RemotesTab content
  - Branch current marker (asterisk or bold)
  - Worktree path truncation with tooltip
  - Remote URL muted color
  - Hover actions (switch, delete, remove)
  - **Depends on**: 5.1
  - **Requirement**: SC-001

## Phase 6: Testing & Documentation

- [x] 6.1 Manual test: branches tab (list, switch, create, delete)
  - **Depends on**: 4.3
  - **Requirement**: SC-001, SC-002

- [x] 6.2 [P] Manual test: worktrees tab (list, add, remove)
  - **Depends on**: 4.2
  - **Requirement**: SC-001

- [x] 6.3 [P] Manual test: remotes tab (list, empty state)
  - **Depends on**: 4.2
  - **Requirement**: SC-001

- [x] 6.4 Verify all files under 300 lines
  - **Depends on**: All
  - **Requirement**: SC-005

- [x] 6.5 Update feature doc `documentation/features/032-changes-panel-agent-commit-refresh.md`
  - Add new sections and files
  - **Depends on**: All
  - **Requirement**: N/A

- [x] 6.6 Write diary entry `documentation/diary/2026-04-04.md`
  - **Depends on**: All
  - **Requirement**: N/A

## Notes

- `[P]` indicates tasks that can be parallelized
- Phase 2 (refactor) is prerequisite for Phase 3 (new tabs) — must extract before adding
- BranchManager.tsx remains as standalone component (not deleted) — BranchesTab is a simplified version
- Remote URL masking: defer to v2 if tokens in URLs become a concern
