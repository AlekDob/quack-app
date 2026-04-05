# Feature Specification: Git Graph Visualization (Fork-style)

**Feature Branch**: `034-git-graph-visualization`
**Created**: 2026-04-04
**Status**: Draft
**Input**: Add branch graph visualization to History tab, showing lanes, merge/diverge points, ref labels, and commit detail popover -- like Fork/GitKraken.

## Clarifications

### Q1: Scope of the graph?
**Answer**: All branches (`--all`), showing the full repo topology.

### Q2: Ref labels on commits?
**Answer**: Yes, colored badge labels for branch names and tags (e.g. "origin/main", "004-feature-map").

### Q3: Interactivity level?
**Answer**: Click on a commit shows details popover (hash, parent, diff stats, full message).

## User Scenarios & Testing

### User Story 1 - View branch topology in History tab (Priority: P1)

The user opens the History tab and sees a multi-lane graph showing commits across all branches. Each lane has a distinct color. Merge commits show lines converging, branch-off points show lines diverging. The graph scrolls vertically with the commit list.

**Why this priority**: Core value -- without the graph lanes, this feature doesn't exist.

**Independent Test**: Open History tab on a repo with 3+ branches and at least one merge. Verify multiple colored lanes appear with correct topology.

**Acceptance Scenarios**:

1. **Given** a repo with main + 2 feature branches, **When** I open History, **Then** I see 3 colored lanes with diverge/merge points
2. **Given** a merge commit, **When** rendered, **Then** two lines converge into one dot
3. **Given** a branch-off commit, **When** rendered, **Then** one line splits into two from that dot
4. **Given** 50+ commits across branches, **When** scrolling, **Then** graph renders smoothly without lag

---

### User Story 2 - See ref labels on commits (Priority: P2)

Commits that are branch tips or tags show colored badge labels (e.g. "origin/main", "v1.2.0", "004-feature-map-whiteboard"). Badge color matches the lane color.

**Why this priority**: Without labels, the user can't tell which lane is which branch.

**Independent Test**: Verify that HEAD commit shows current branch label, remote tracking branches show "origin/..." labels.

**Acceptance Scenarios**:

1. **Given** a commit at branch tip, **When** rendered, **Then** shows branch name badge in lane color
2. **Given** a commit with tag, **When** rendered, **Then** shows tag badge with tag icon
3. **Given** a commit with multiple refs, **When** rendered, **Then** shows all ref badges

---

### User Story 3 - Click commit for details popover (Priority: P3)

Clicking a commit row opens a popover/drawer showing: full hash, parent hash(es), author + email, full commit message, and diff stat summary (files changed, insertions, deletions).

**Why this priority**: Nice-to-have, adds value but graph works without it.

**Independent Test**: Click a merge commit, verify popover shows 2 parent hashes and diff stats.

**Acceptance Scenarios**:

1. **Given** the graph rendered, **When** I click a commit row, **Then** a popover appears with commit details
2. **Given** a merge commit clicked, **When** popover opens, **Then** shows 2 parent hashes
3. **Given** the popover open, **When** I click outside or press Escape, **Then** it closes

---

### Edge Cases

- Repo with 20+ active branches: graph must cap lanes (max ~8?) and collapse distant branches
- Detached HEAD state: should still render graph correctly
- Empty repo (no commits): show empty state
- Very long branch names: truncate with ellipsis in badge
- Octopus merges (3+ parents): render all incoming lines

## Requirements

### Functional Requirements

- **FR-001**: Rust backend MUST extend `git_commit_history` to include parent hashes and ref decorations
- **FR-002**: Rust backend MUST support `--all` flag to fetch commits across all branches
- **FR-003**: Frontend MUST compute lane assignments from commit DAG (parent-child relationships)
- **FR-004**: Frontend MUST render colored SVG paths for each lane (vertical lines, merge curves, branch-off curves)
- **FR-005**: Frontend MUST assign deterministic colors to lanes (same branch = same color across renders)
- **FR-006**: Frontend MUST render ref labels (branch names, tags) as colored badges on commit rows
- **FR-007**: Frontend MUST show a commit detail popover on click with hash, parents, author, message, diff stats
- **FR-008**: Graph MUST handle repos with up to 200 commits and 20 branches without performance issues
- **FR-009**: Graph MUST support max ~8 visible lanes (collapse lanes for distant branches)
- **FR-010**: Frontend MUST preserve the existing author avatar and commit info rendering alongside the graph

### Key Entities

- **GraphCommit**: extends GitCommitEntry with parentHashes, refs, laneIndex, laneColor
- **GraphLane**: id, color, active flag, branch name association
- **GraphEdge**: fromCommitIdx, toCommitIdx, fromLane, toLane, type (straight/merge/branch-off)

## Success Criteria

- **SC-001**: Graph renders correctly for repos with 3+ branches and merge commits
- **SC-002**: Lane colors are consistent within a session (same branch = same color)
- **SC-003**: Ref labels visible and readable on branch tip commits
- **SC-004**: Popover shows correct parent info for both regular and merge commits
- **SC-005**: Scroll performance stays smooth (60fps) for 200-commit history
- **SC-006**: All new files stay under 300 lines
