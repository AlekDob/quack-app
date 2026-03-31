# Tasks: Changes Panel — Branch Info & Commit History Tab

**Input**: Design documents from `/specs/003-changes-panel-branch-commits/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Not requested — manual testing per Quack UI standard.

**Organization**: Tasks grouped by user story. Each story is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (No tasks needed)

**Purpose**: No project initialization needed — this is an enhancement to an existing codebase.

---

## Phase 2: Foundational (Extract Shared Component)

**Purpose**: Extract `GitTimelineItem` into a shared module so both GitPanel and ChangesPanel can use it without duplication. This BLOCKS all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Extract `GitTimelineItem` component, `getAuthorInitials`, `getAuthorColor`, `TIMELINE_LINE_COLOR`, and `TIMELINE_LINE_LEFT` constants from `src/components/GitPanel.tsx` into new file `src/components/GitTimelineItem.tsx`. Export all as named exports.
- [ ] T002 Update `src/components/GitPanel.tsx` to import `GitTimelineItem`, `TIMELINE_LINE_COLOR`, and `TIMELINE_LINE_LEFT` from `src/components/GitTimelineItem.tsx`. Remove the inline definitions. Verify no other internal references break.
- [ ] T003 Verify GitPanel regression: open the Git Panel, confirm the commit timeline renders identically (avatars, colors, layout, timestamps all match pre-extraction state).

**Checkpoint**: GitTimelineItem is now a shared module. GitPanel works exactly as before.

---

## Phase 3: User Story 1 — Branch/Worktree Context Bar (Priority: P1) 🎯 MVP

**Goal**: Display the current branch name and worktree status in a persistent context bar above the tab row.

**Independent Test**: Open a session on a non-main branch → context bar shows branch name. Switch to a worktree session → shows branch + "worktree" badge. Non-git project → no context bar shown.

### Implementation for User Story 1

- [ ] T004 [US1] Add `branch?: string | null` and `isWorktree?: boolean` props to `ChangesPanelProps` interface in `src/components/ChangesPanel.tsx`
- [ ] T005 [US1] Render the context bar JSX in `src/components/ChangesPanel.tsx` above the `.changes-tabs` div: branch icon (SVG inline or Unicode `⑂`), branch name with `title` attribute for tooltip, conditional "worktree" badge. Wrap in `{branch && (...)}` for graceful absence on non-git projects (FR-010). Truncate branch name with CSS `text-overflow: ellipsis` (FR-009).
- [ ] T006 [P] [US1] Add CSS styles for `.changes-context-bar`, `.changes-branch-name`, and `.changes-worktree-badge` in `src/components/ChangesPanel.css`. Context bar: 28px height, flex row, `rgba(255,255,255,0.04)` background, `border-bottom: 1px solid rgba(255,255,255,0.08)`. Worktree badge: orange (#FF6B35) background matching Quack brand.
- [ ] T007 [US1] Wire up `branch` and `isWorktree` props in `src/components/SidePanelAccordion.tsx`: pass session branch and worktree status down to `<ChangesPanel>`. Add the corresponding props to `SidePanelAccordionProps` interface if not already present.
- [ ] T008 [US1] Verify real-time update: confirm that when `git:branch-changed` event fires (already handled in App.tsx), the new branch name propagates through the prop chain to the context bar without manual refresh (FR-003).

**Checkpoint**: Branch context bar is fully functional. US1 is independently testable.

---

## Phase 4: User Story 2 — History Tab with Commit Timeline (Priority: P2)

**Goal**: Add a "History" tab that displays the commit timeline using the shared GitTimelineItem component.

**Independent Test**: Click the "History" tab → see commit timeline with avatars, summaries, and timestamps. Commit via modal → new commit appears in History after refresh.

### Implementation for User Story 2

- [ ] T009 [US2] Add `history?: GitCommitEntry[]` and `historyLoading?: boolean` props to `ChangesPanelProps` interface in `src/components/ChangesPanel.tsx`. Import `GitCommitEntry` from `src/types.ts`.
- [ ] T010 [US2] Extend `ActiveTab` type from `'pending' | 'committed'` to `'pending' | 'committed' | 'history'` in `src/components/ChangesPanel.tsx`.
- [ ] T011 [US2] Add the "History" tab button in the `.changes-tabs` div in `src/components/ChangesPanel.tsx`, following the existing pattern for Pending and Committed buttons.
- [ ] T012 [US2] Add the History tab content rendering in `src/components/ChangesPanel.tsx`: when `activeTab === 'history'`, render loading state (if `historyLoading`), empty state ("Nessun commit trovato" if `history` is empty), or map `history` entries to `<GitTimelineItem>` components. Import `GitTimelineItem` and `TIMELINE_LINE_LEFT` from `src/components/GitTimelineItem.tsx`.
- [ ] T013 [P] [US2] Add CSS styles for `.changes-history-list` (scrollable container matching `.changes-panel-list` max-height), `.changes-tab-count-history` (badge color — use a distinct color like amber/orange to differentiate from pending green and committed blue) in `src/components/ChangesPanel.css`.
- [ ] T014 [US2] Wire up `history` and `historyLoading` props in `src/components/SidePanelAccordion.tsx`: pass commit history data down to `<ChangesPanel>`. Add the corresponding props to `SidePanelAccordionProps` interface if not already present, threading from wherever the parent fetches git history.
- [ ] T015 [US2] Verify post-commit refresh: after committing via the Changes Panel commit modal, confirm that switching to the History tab shows the new commit (may require triggering a history re-fetch from the parent).

**Checkpoint**: History tab is fully functional. US1 and US2 work independently.

---

## Phase 5: User Story 3 — Commit Count Badge (Priority: P3)

**Goal**: Show the number of loaded commits as a badge on the History tab.

**Independent Test**: Verify the History tab badge shows the correct count matching `history.length`. No commits → no badge shown.

### Implementation for User Story 3

- [ ] T016 [US3] Add commit count badge to the History tab button in `src/components/ChangesPanel.tsx`: render `{history && history.length > 0 && <span className="changes-tab-count changes-tab-count-history">{history.length}</span>}` inside the History button, following the existing Pending/Committed badge pattern.

**Checkpoint**: All three user stories are complete and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, documentation, and final quality pass.

- [ ] T017 [P] Handle detached HEAD state in the context bar: if branch name starts with `HEAD detached` or is a raw commit hash, display appropriately in `src/components/ChangesPanel.tsx`.
- [ ] T018 [P] Handle git history fetch error: if history fetch fails, show error message in the History tab content area without affecting Pending/Committed tabs in `src/components/ChangesPanel.tsx`.
- [ ] T019 Verify file size limits: confirm `src/components/ChangesPanel.tsx` stays under 300 lines and all new/modified functions stay under 20 lines. Extract helpers if needed.
- [ ] T020 Run quickstart.md verification steps: all 5 verification scenarios pass.
- [ ] T021 Add diary entry in `documentation/diary/2026-03-30.md` documenting the feature implementation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Phase 2 (needs shared GitTimelineItem extracted, though US1 doesn't directly use it — kept as dependency for clean ordering).
- **US2 (Phase 4)**: Depends on Phase 2 (directly imports GitTimelineItem).
- **US3 (Phase 5)**: Depends on US2 (adds badge to History tab button created in US2).
- **Polish (Phase 6)**: Depends on all user stories complete.

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2. Can be implemented alone as MVP.
- **US2 (P2)**: Independent after Phase 2. Can be implemented in parallel with US1 (different JSX sections).
- **US3 (P3)**: Depends on US2 (extends the History tab button).

### Parallel Opportunities

- T006 (CSS) can run in parallel with T004/T005 (JSX) — different files
- T013 (CSS) can run in parallel with T009-T012 (JSX) — different files
- T017 and T018 (edge cases) can run in parallel — different concerns
- US1 and US2 can be worked on in parallel after Phase 2 (different sections of ChangesPanel)

---

## Parallel Example: Phase 2

```bash
# These modify different sections of the same file, run sequentially:
T001: Extract GitTimelineItem into src/components/GitTimelineItem.tsx
T002: Update GitPanel.tsx imports (depends on T001)
T003: Verify regression (depends on T002)
```

## Parallel Example: US1 + US2

```bash
# After Phase 2, these can run in parallel (different files/sections):
# Agent A: US1 tasks (T004-T008) — context bar above tabs
# Agent B: US2 tasks (T009-T015) — history tab content below tabs
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 2: Extract GitTimelineItem
2. Complete Phase 3: Branch/Worktree context bar
3. **STOP and VALIDATE**: Branch shows correctly, updates real-time, graceful on non-git
4. Ship MVP — users get branch awareness immediately

### Incremental Delivery

1. Phase 2 → Shared component ready
2. US1 → Branch context bar → Test → Ship (MVP!)
3. US2 → History tab → Test → Ship
4. US3 → Badge count → Test → Ship
5. Phase 6 → Polish edge cases → Final ship

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 21 |
| **US1 tasks** | 5 (T004-T008) |
| **US2 tasks** | 7 (T009-T015) |
| **US3 tasks** | 1 (T016) |
| **Foundational tasks** | 3 (T001-T003) |
| **Polish tasks** | 5 (T017-T021) |
| **Parallel opportunities** | 4 (T006∥T004, T013∥T009, T017∥T018, US1∥US2) |
| **Suggested MVP** | Phase 2 + US1 (8 tasks) |
| **Files created** | 1 (`GitTimelineItem.tsx`) |
| **Files modified** | 4 (`GitPanel.tsx`, `ChangesPanel.tsx`, `ChangesPanel.css`, `SidePanelAccordion.tsx`) |

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All tasks follow checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
- No test tasks generated (manual testing per Quack standard)
- Commit after each phase checkpoint
