# Quickstart: Changes Panel — Branch Info & Commit History Tab

**Feature**: 003-changes-panel-branch-commits
**Date**: 2026-03-30

## Implementation Order

### Step 1: Extract GitTimelineItem (foundation)

Create `src/components/GitTimelineItem.tsx` by extracting the inline component + helpers from `GitPanel.tsx`. Update `GitPanel.tsx` to import from the new file. **Verify GitPanel still renders correctly.**

### Step 2: Add context bar to ChangesPanel (P1)

Add new props (`branch`, `isWorktree`) to `ChangesPanelProps`. Render a context bar above the tab row. Wire up the props from `SidePanelAccordion` → `ChangesPanel`. Add CSS for `.changes-context-bar`.

### Step 3: Add History tab (P2)

Add new props (`history`, `historyLoading`) to `ChangesPanelProps`. Extend `ActiveTab` to include `'history'`. Add the third tab button. Render `GitTimelineItem` list when History tab is active. Wire up history props from parent.

### Step 4: Add commit count badge (P3)

Show `history.length` as a badge on the History tab, following the existing pattern for Pending/Committed badges.

## Key Files

| File | Action | Lines (est.) |
|------|--------|-------------|
| `src/components/GitTimelineItem.tsx` | CREATE | ~130 |
| `src/components/GitPanel.tsx` | MODIFY (remove inline, add import) | -120 / +2 |
| `src/components/ChangesPanel.tsx` | MODIFY (add bar + tab + props) | +60 |
| `src/components/ChangesPanel.css` | MODIFY (add styles) | +40 |
| `src/components/SidePanelAccordion.tsx` | MODIFY (pass new props) | +10 |

## Verification

1. Open GitPanel → timeline should render identically (regression check)
2. Open ChangesPanel on a non-main branch → context bar shows branch
3. Open ChangesPanel on a worktree session → shows branch + worktree badge
4. Click History tab → commit timeline renders
5. Commit via modal → History tab shows new commit after refresh
