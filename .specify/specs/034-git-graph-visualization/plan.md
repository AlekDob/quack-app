# Implementation Plan: Git Graph Visualization

## Architecture Overview

```
Rust (git.rs)                    React (frontend)
┌──────────────────┐            ┌──────────────────────────────┐
│ git_commit_history│            │ computeGraphLanes()          │
│ + parents, refs   │ ──JSON──> │ (DAG → lane assignments)     │
│ + --all flag      │            │         │                    │
└──────────────────┘            │         ▼                    │
                                 │ GraphColumn (SVG paths)      │
                                 │ + GitTimelineItem (content)  │
                                 │ + RefBadge (branch/tag)      │
                                 │ + CommitPopover (details)    │
                                 └──────────────────────────────┘
```

## Phase 1: Rust Backend Changes

### Extend `git_commit_history` format

Current format:
```
%H%x1f%an%x1f%ad%x1f%at%x1f%s
```

New format:
```
%H%x1f%P%x1f%d%x1f%an%x1f%ad%x1f%at%x1f%s
```

New fields:
- `%P` — parent hashes (space-separated, empty for root commits)
- `%d` — ref decorations (e.g. ` (HEAD -> main, origin/main, tag: v1.0)`)

### New/updated types

```rust
// Extend existing GitCommitEntry
pub struct GitCommitEntry {
    pub hash: String,
    pub parent_hashes: Vec<String>,   // NEW
    pub refs: Vec<String>,            // NEW (parsed from %d)
    pub summary: String,
    pub author: String,
    pub relative_time: String,
    pub timestamp: Option<i64>,
}
```

### Add `--all` parameter

```rust
pub async fn git_commit_history(
    root_path: Option<String>,
    limit: Option<usize>,
    branch_name: Option<String>,
    all: Option<bool>,              // NEW — when true, add --all flag
) -> Result<Vec<GitCommitEntry>, String>
```

## Phase 2: Graph Lane Algorithm

This is the core algorithm. It assigns each commit to a lane (column) based on parent-child relationships.

### Algorithm: "Swimming Lanes" (simplified gitk approach)

```typescript
interface GraphNode {
  commit: GraphCommitEntry
  lane: number          // assigned column (0 = leftmost)
  color: string         // lane color
  edges: GraphEdge[]    // connections to parent commits
}

interface GraphEdge {
  fromRow: number       // index in commit list
  toRow: number         // parent commit index
  fromLane: number
  toLane: number
  color: string
}
```

**Algorithm steps** (per commit, top-down):

1. Maintain `activeLanes: (string | null)[]` — array of commit hashes occupying each lane
2. For each commit (newest first):
   a. Find if this commit's hash is already in activeLanes (it was expected by a child)
   b. If found → use that lane. If not → find first empty lane or append
   c. For each parent hash:
      - First parent: stays in same lane (main line)
      - Additional parents: find/create a lane for merge source
   d. Replace current commit hash with first parent hash in the lane
   e. Record edges connecting this commit to each parent

**Max lanes**: Cap at 8. If more branches active, reuse lanes of terminated branches.

**Color palette**: 8 distinct colors, assigned to lane index:
```typescript
const LANE_COLORS = [
  '#34d399', // emerald (main branch)
  '#60a5fa', // blue
  '#f472b6', // pink
  '#fbbf24', // amber
  '#a78bfa', // purple
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#f87171', // red
]
```

### File: `src/utils/gitGraphLayout.ts` (~150 lines)

Pure function: `computeGraphLanes(commits: GraphCommitEntry[]): GraphNode[]`

## Phase 3: SVG Graph Column Rendering

### Component: `GraphColumn.tsx` (~120 lines)

Renders the SVG lane visualization for each commit row. One SVG per row, aligned left of the commit content.

**Dimensions**:
- Lane width: 16px per lane
- Row height: matched to GitTimelineItem height (~40px)
- Dot radius: 5px (commit dot on its lane)
- Line width: 2px

**SVG elements per row**:
- Vertical lines: straight paths for lanes passing through
- Commit dot: circle at the commit's lane position
- Merge curve: bezier path from merge parent's lane to commit's lane
- Branch-off curve: bezier path from commit's lane to child's lane (drawn on child row)

**Merge/branch-off curve**:
```svg
<path d="M {fromX} 0 C {fromX} {midY}, {toX} {midY}, {toX} {height}" />
```

## Phase 4: Ref Badges

### Component: `RefBadge.tsx` (~40 lines)

Small colored badge showing branch name or tag:
- Background: lane color at 15% opacity
- Border: lane color at 30% opacity
- Text: lane color at full
- Font: 10px, monospace
- Truncate at 24 chars with ellipsis
- Tag icon (small SVG) for tags vs branch icon for branches

### Ref parsing from `%d` output:

```typescript
function parseRefs(raw: string): { branches: string[], tags: string[] } {
  // Input: " (HEAD -> main, origin/main, tag: v1.0)"
  // Clean parentheses, split by ", "
  // Separate "tag: ..." from branch names
  // Remove "HEAD -> " prefix
}
```

## Phase 5: Commit Detail Popover

### Component: `CommitPopover.tsx` (~100 lines)

Triggered by clicking a commit row. Shows:
- Full hash (copyable)
- Parent hash(es) (with merge indicator)
- Author name
- Full commit message (not just subject)
- Timestamp (absolute)

**Positioning**: Appears below the clicked row, inside the scroll container. Uses `position: absolute` relative to the history list.

**No diff stats in v1** — would require additional `git show --stat` call per click. Defer to v2.

## Phase 6: Integration

### Updated HistoryTab.tsx

```tsx
// Before: simple list of GitTimelineItem
// After: graph-aware rendering

<div className="git-graph-container">
  {graphNodes.map((node, idx) => (
    <div className="git-graph-row" key={node.commit.hash}>
      <GraphColumn
        node={node}
        totalLanes={maxLanes}
        rowHeight={ROW_HEIGHT}
      />
      <div className="git-graph-content">
        <RefBadge refs={node.commit.refs} color={node.color} />
        <GitTimelineItem entry={node.commit} isLast={idx === last} />
      </div>
    </div>
  ))}
</div>
```

### GitTimelineItem changes
- Remove the vertical line (now handled by GraphColumn)
- Remove the avatar circle (replaced by commit dot in GraphColumn)
- Keep only the text content (summary, author, time)
- OR keep avatar but shift it to after the graph column

## File Structure

```
src/
  utils/
    gitGraphLayout.ts      (~150 lines) — lane algorithm
    gitGraphColors.ts      (~20 lines)  — color palette + helpers
  components/
    GraphColumn.tsx         (~120 lines) — SVG per-row rendering
    RefBadge.tsx            (~40 lines)  — branch/tag badge
    CommitPopover.tsx       (~100 lines) — click detail popover
    HistoryTab.tsx          (update)     — wire graph layout + new components
    GitTimelineItem.tsx     (update)     — strip timeline chrome, keep content
```

## Performance Strategy

- Lane computation: O(n * maxLanes) — fast for 200 commits
- SVG rendering: one SVG per visible row (virtualized if needed later)
- No virtualization in v1 (200 commits max should be fine)
- `useMemo` on `computeGraphLanes` with `history` as dependency

## Risk: GitTimelineItem refactor

GitTimelineItem currently renders its own timeline line + avatar. We need to either:
1. **Strip it**: Remove line/avatar, keep only text content
2. **Conditional mode**: Add `graphMode` prop that disables line/avatar

Option 2 is safer — preserves backward compatibility if GitTimelineItem is used elsewhere.
