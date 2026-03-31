# Research: Changes Panel — Branch Info & Commit History Tab

**Feature**: 003-changes-panel-branch-commits
**Date**: 2026-03-30

## Research Tasks

### R1: How to pass branch info to ChangesPanel

**Decision**: Add `branch` and `isWorktree` props to `ChangesPanelProps`. Parent (`SidePanelAccordion`) already has access to session/terminal context through its own props chain from App.tsx.

**Rationale**: Prop-passing is the simplest approach and consistent with how `rootPath` is already passed. No need for a Zustand store or context — the data flows naturally from App.tsx → SidePanelAccordion → ChangesPanel.

**Alternatives considered**:
- Zustand store for branch state: Rejected — over-engineering. Branch is already tracked in App.tsx session state.
- Direct Tauri invoke from ChangesPanel: Rejected — would duplicate the branch watcher already running in App.tsx.

### R2: How to share GitTimelineItem between GitPanel and ChangesPanel

**Decision**: Extract `GitTimelineItem` (+ helpers `getAuthorInitials`, `getAuthorColor`, `TIMELINE_LINE_COLOR`, `TIMELINE_LINE_LEFT`) into a new file `src/components/GitTimelineItem.tsx`. Both GitPanel and ChangesPanel import from there.

**Rationale**: The component is ~120 lines with inline styles. It's self-contained with no dependencies beyond `GitCommitEntry` from types.ts. Extraction is trivial and satisfies FR-006 (no duplication).

**Alternatives considered**:
- Copy-paste into ChangesPanel: Rejected — violates FR-006 and DRY.
- Render GitPanel's timeline section as a portal: Rejected — over-engineered, tight coupling.

### R3: How to pass commit history to ChangesPanel

**Decision**: Add `history`, `historyLoading`, and `historyError` props to `ChangesPanelProps`. The parent already has access to commit history (it's fetched in App.tsx and passed to GitPanel through the same prop chain).

**Rationale**: Consistent with GitPanel's pattern — history is prop-driven, not fetched internally. This keeps ChangesPanel a pure display component.

**Alternatives considered**:
- Fetch history inside ChangesPanel via invoke: Rejected — would create duplicate fetching logic.
- Zustand store for git history: Rejected — history is already managed in App.tsx state.

### R4: Context bar UI pattern

**Decision**: A thin bar (28px height) above the tab row with: `[GitBranch icon] branch-name [worktree badge]`. Truncate at ~30 chars with ellipsis + tooltip. Use existing orange accent color (#FF6B35) for worktree badge.

**Rationale**: Follows VS Code / Fork pattern of context info above actions. Orange badge aligns with Quack brand. 28px keeps it compact without stealing space from file list.

**Alternatives considered**:
- Branch inside tab bar: Rejected — mixes context with navigation.
- Branch in a dropdown only: Rejected — not visible at a glance (fails SC-001).
