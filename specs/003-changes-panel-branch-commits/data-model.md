# Data Model: Changes Panel — Branch Info & Commit History Tab

**Feature**: 003-changes-panel-branch-commits
**Date**: 2026-03-30

## Entities

### ChangesPanelProps (modified)

Existing props remain unchanged. New props added:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | `string \| null` | No | Current git branch name |
| `isWorktree` | `boolean` | No | Whether operating in a git worktree |
| `history` | `GitCommitEntry[]` | No | Commit history entries |
| `historyLoading` | `boolean` | No | Whether history is being fetched |

### ActiveTab (modified)

Extended union type:

| Value | Description |
|-------|-------------|
| `'pending'` | Files modified but not committed (existing) |
| `'committed'` | Files committed in this session (existing) |
| `'history'` | Git commit timeline (new) |

### GitCommitEntry (unchanged, already exported)

| Field | Type | Description |
|-------|------|-------------|
| `hash` | `string` | Commit SHA |
| `summary` | `string` | Commit message first line |
| `author` | `string` | Author name |
| `relativeTime` | `string` | Human-readable time ago |
| `timestamp` | `number?` | Unix epoch for formatted date |

### GitTimelineItem Props (extracted)

| Field | Type | Description |
|-------|------|-------------|
| `entry` | `GitCommitEntry` | The commit to render |
| `lineLeft` | `number` | X position of the vertical timeline line |
| `isLast` | `boolean` | Whether this is the last item (hides bottom line) |

## State Transitions

```
Tab state: 'pending' → 'committed' → 'history' (user clicks)
                ↑___________↑_____________↑ (bidirectional)

Branch display: null → 'branch-name' (project loaded)
                     → updated (git:branch-changed event)
                     → null (project closed / non-git)
```

## Relationships

- `ChangesPanel` → renders `GitTimelineItem` (in History tab)
- `GitPanel` → renders `GitTimelineItem` (in timeline column)
- Both import `GitTimelineItem` from shared `src/components/GitTimelineItem.tsx`
- Both receive `GitCommitEntry[]` as props from parent chain
