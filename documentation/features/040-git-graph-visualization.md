---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18 + TypeScript)
created: 2026-04-04
last_verified: 2026-04-04
tags: [git-graph, visualization, history-tab, source-control, svg]
---

## Git Graph Visualization
**Purpose:** Fork/GitKraken-style multi-lane colored SVG graph showing branches, merges, diverge points, ref badges, and commit detail popover in the History tab.
**Stack:** Tauri v2 (Rust backend) + React 18 + TypeScript strict

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Util | `src/utils/gitGraphLayout.ts` | `computeGraphLanes()` — lane assignment algorithm, `GraphCommitInput`, `GraphNode`, `GraphEdge` types |
| Util | `src/utils/gitGraphColors.ts` | `LANE_COLORS` (8-color palette), `getLaneColor()`, `MAX_LANES` constant |
| Component | `src/components/GraphColumn.tsx` | `GraphColumn` — renders one SVG row (passthrough lines, merge edges, commit dot) |
| Component | `src/components/RefBadge.tsx` | `RefBadge` — inline branch/tag badges with lane color, icon per type |
| Component | `src/components/CommitPopover.tsx` | `CommitPopover` — click-to-expand detail panel (hash copy, parents, author, date) |
| Component | `src/components/HistoryTab.tsx` | `HistoryTab` — orchestrator: graph mode vs legacy linear timeline, row selection, empty state: "No commits found" |
| Component | `src/components/GitTimelineItem.tsx` | `GitTimelineItem` — legacy timeline row, supports `graphMode` prop for minimal rendering |
| Config | `src/components/GitGraph.css` | Styles for graph container, rows, ref badges, commit popover, SVG dot hover |
| Service | `src-tauri/src/git.rs` | `git_commit_history()` Tauri command — `--all` flag, `parentHashes`, `refs` via `%P` / `%d` format |
| Model/Type | `src/types.ts` | `GitCommitEntry` — `parentHashes?: string[]`, `refs?: string[]` fields |

### Data Flow
```
[git log --all --pretty=%H%P%d%an%ad%at%s] → [git.rs parse_commit_lines()] → [Tauri invoke] → [HistoryTab toGraphInput()] → [computeGraphLanes()] → [GraphNode[]] → [GraphColumn SVG + RefBadge + CommitPopover]
```

### Key Functions
- `computeGraphLanes(commits: GraphCommitInput[]) → GraphNode[]` — main lane assignment algorithm; maintains activeLanes slot array, assigns lanes, builds edges. `GraphNode` includes `activeLanes: (string | null)[]` for pass-through rendering
- `processCommit(commit, activeLanes, hashToIndex, selfIndex) → CommitProcessResult` — per-commit lane resolution: first parent continues lane, extra parents open new lanes
- `claimLane(activeLanes, hash) → number` — reuses null slots, appends new up to MAX_LANES (8), overflows to lane 0
- `resolveParentLane(activeLanes, parentHash) → number` — finds existing lane or claims new for parent
- `getLaneColor(laneIndex: number) → string` — modular color lookup from 8-color palette
- `toGraphInput(entry: GitCommitEntry) → GraphCommitInput` — adapter from Tauri response to graph input
- `hasGraphData(history: GitCommitEntry[]) → boolean` — checks if parentHashes present for graph mode
- `laneX(lane: number) → number` — converts lane index to SVG x coordinate (LANE_WIDTH=16)
- `renderEdge(edge, key) → JSX` — bezier curve SVG path for merge/branch-off connections
- `renderPassthroughLine(lane, color) → JSX` — vertical SVG line for active lane continuity
- `renderDot(lane, color) → JSX` — commit circle with dark stroke
- `isBranchRef(ref: string) → boolean` — distinguishes branch from tag refs
- `cleanRefName(ref: string) → string` — strips `tag: ` and `HEAD -> ` prefixes
- `truncateRef(name, max) → string` — truncates long ref names to 24 chars
- `formatDate(ts: number) → string` — unix timestamp to locale date string
- `copyHash(hash: string) → void` — clipboard copy + toast notification
- `git_commit_history_impl(limit, branch_name, root_path, all) → Vec<GitCommitEntry>` — Rust: builds git log args with optional `--all`, parses output
- `parse_commit_lines(output: &str) → Vec<GitCommitEntry>` — Rust: splits `\x1f`-delimited log output into structs
- `parse_refs(raw: &str) → Vec<String>` — Rust: extracts ref names from `%d` decoration string

### State
- `selectedIdx`: `number | null` — index of commit with open popover (component)
- `graphNodes`: `GraphNode[]` — memoized lane-assigned nodes from `computeGraphLanes` (component)
- `useGraph`: `boolean` — derived flag: true when parentHashes data is available (component)
- `maxLanes`: `number` — max active lanes across all rows, capped at MAX_LANES=8 (component)

### External Dependencies
- `sonner`: toast notification for hash copy feedback
- `navigator.clipboard`: browser Clipboard API for hash copy

### Config
- `LANE_COLORS`: 8-color palette — emerald, blue, pink, amber, purple, cyan, orange, red
- `MAX_LANES`: `8` — maximum concurrent graph lanes before overflow
- `LANE_WIDTH`: `16px` — horizontal spacing per lane in SVG
- `DOT_RADIUS`: `4px` — commit dot size (expands to 5 on hover)
- `ROW_HEIGHT`: `36px` — SVG row height matching CSS min-height
- `git log --pretty=format:%H%x1f%P%x1f%d%x1f%an%x1f%ad%x1f%at%x1f%s` — Rust log format with unit-separator delimiter
