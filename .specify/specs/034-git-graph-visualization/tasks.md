# Implementation Tasks: Git Graph Visualization (034)

## Phase 1: Rust Backend — Extend git_commit_history

- [x] 1.1 Add `parent_hashes: Vec<String>` and `refs: Vec<String>` to `GitCommitEntry` struct in git.rs
  - Update format string to include `%P` and `%d`
  - Parse parent hashes (space-split), parse refs (strip parens, split commas)
  - **Depends on**: None
  - **Requirement**: FR-001

- [x] 1.2 Add `all: Option<bool>` parameter to `git_commit_history` command
  - When true, add `--all` flag to git log
  - **Depends on**: 1.1
  - **Requirement**: FR-002

- [x] 1.3 Update TypeScript `GitCommitEntry` in types.ts
  - Add `parentHashes: string[]` and `refs: string[]`
  - **Depends on**: None
  - **Requirement**: FR-001

## Phase 2: Graph Lane Algorithm

- [x] 2.1 Create `src/utils/gitGraphColors.ts` — color palette + lane color helper
  - 8-color palette, `getLaneColor(index: number)` function
  - **Depends on**: None
  - **Requirement**: FR-005

- [x] 2.2 Create `src/utils/gitGraphLayout.ts` — core lane algorithm
  - `computeGraphLanes(commits)` → `GraphNode[]`
  - Swimming lanes approach: track activeLanes, assign per commit
  - Compute edges (straight, merge, branch-off)
  - Cap at 8 lanes max
  - **Depends on**: 1.3, 2.1
  - **Requirement**: FR-003, FR-009

## Phase 3: SVG Graph Rendering

- [x] 3.1 Create `GraphColumn.tsx` — SVG per-row lane visualization
  - Render vertical pass-through lines for active lanes
  - Render commit dot on commit's lane
  - Render merge curves (bezier) for incoming parent connections
  - Render branch-off curves for outgoing child connections
  - Props: node, totalLanes, rowHeight
  - **Depends on**: 2.2
  - **Requirement**: FR-004

- [x] 3.2 [P] Create `RefBadge.tsx` — branch/tag label badge
  - Parse refs into branches vs tags
  - Color-coded badge matching lane color
  - Truncate long names, branch/tag icon
  - **Depends on**: 2.1
  - **Requirement**: FR-006

## Phase 4: Commit Popover

- [x] 4.1 Create `CommitPopover.tsx` — click detail panel
  - Full hash (copyable), parent hashes, author, full message, timestamp
  - Positioned below clicked row, closes on Escape/outside click
  - **Depends on**: None
  - **Requirement**: FR-007

## Phase 5: Integration

- [x] 5.1 Update `GitTimelineItem.tsx` — add `graphMode` prop
  - When graphMode=true: hide vertical line + avatar circle, keep text only
  - Preserve existing behavior when graphMode=false/undefined
  - **Depends on**: None
  - **Requirement**: FR-010

- [x] 5.2 Update `HistoryTab.tsx` — wire graph layout and new components
  - Call `computeGraphLanes(history)` with useMemo
  - Render GraphColumn + RefBadge + GitTimelineItem per row
  - Handle commit click → show CommitPopover
  - **Depends on**: 3.1, 3.2, 4.1, 5.1
  - **Requirement**: FR-003, FR-010

- [x] 5.3 Update `ChangesPanel.tsx` — pass `all: true` for history fetch
  - Ensure SidePanelAccordion / App.tsx passes `--all` flag when fetching history
  - **Depends on**: 1.2
  - **Requirement**: FR-002

## Phase 6: CSS + Polish

- [x] 6.1 Add git graph styles to ChangesPanel.css or new GitGraph.css
  - Graph container layout (flex row: graph column + content)
  - Row hover state
  - SVG line colors, dot styles
  - Ref badge styles
  - Popover positioning + glassmorphism
  - **Depends on**: 5.2
  - **Requirement**: SC-005

- [x] 6.2 Performance validation — test with 200 commits, 20 branches
  - Verify smooth scroll, no lag
  - **Depends on**: 6.1
  - **Requirement**: FR-008, SC-005

## Phase 7: Documentation

- [x] 7.1 Create feature doc `documentation/features/034-git-graph-visualization.md`
  - **Depends on**: All
  - **Requirement**: N/A

- [x] 7.2 Diary entry
  - **Depends on**: All
  - **Requirement**: N/A

- [x] 7.3 Verify all files under 300 lines
  - **Depends on**: All
  - **Requirement**: SC-006

## Notes

- `[P]` = parallelizable
- Phase 1 (Rust) and Phase 2-4 (frontend utils/components) can overlap
- Critical path: 1.1 → 1.2 → 5.3 (backend) AND 2.2 → 3.1 → 5.2 (frontend)
- GitTimelineItem backward compatibility preserved via `graphMode` prop
- No diff stats in popover for v1 (would need extra git call per click)
