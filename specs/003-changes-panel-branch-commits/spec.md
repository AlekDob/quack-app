# Feature Specification: Changes Panel — Branch Info & Commit History Tab

**Feature Branch**: `003-changes-panel-branch-commits`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "Enhance the Changes Panel (div.changes-panel) to show the current branch/worktree name and add a tab to view committed changes using the existing git-history-timeline component"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Current Branch/Worktree at a Glance (Priority: P1)

As a developer reviewing changes in the Changes Panel, I want to immediately see which Git branch (or worktree) the current modifications belong to, so I have full context before accepting, rejecting, or committing changes.

**Why this priority**: Without branch context, users risk committing to the wrong branch or losing track of which workspace they're operating in — especially when multiple agents run on different worktrees simultaneously.

**Independent Test**: Open a session with a project on a non-main branch. The Changes Panel header should display the branch name. Switch branches or worktrees and verify the label updates.

**Acceptance Scenarios**:

1. **Given** a session with an active project on branch `feat/login`, **When** I open the Changes Panel, **Then** I see "feat/login" in a persistent context bar above the tab row, with a branch icon.
2. **Given** a session running inside a worktree (e.g., `.worktrees/task-abc123`), **When** I open the Changes Panel, **Then** I see the worktree's branch name (e.g., `task/abc123-my-feature`) in the context bar, plus a "worktree" badge to distinguish it from the main working directory.
3. **Given** a session where the branch changes mid-conversation (agent checks out another branch), **When** the branch change event fires, **Then** the displayed branch name updates in real-time without requiring a manual refresh.
4. **Given** a project with no Git repository, **When** I open the Changes Panel, **Then** no branch info is shown (graceful absence, no errors).

---

### User Story 2 - View Commit History in Changes Panel (Priority: P2)

As a developer, I want to see the recent commit history directly within the Changes Panel, so I can review what has already been committed during this session without navigating to the full Git Panel.

**Why this priority**: The Changes Panel already has "Pending" and "Committed" tabs. Adding a commit history view completes the workflow: see what's pending, see what's been committed in this session, and see the broader commit timeline — all without context-switching.

**Independent Test**: After making commits in a session, switch to the "History" tab in the Changes Panel and verify commits appear in chronological order with the same visual timeline as the GitPanel.

**Acceptance Scenarios**:

1. **Given** a project with commit history, **When** I click the "History" tab in the Changes Panel, **Then** I see a commit timeline rendered using the same visual style already present in the GitPanel (vertical line, colored avatars, author initials, summary, relative time).
2. **Given** I just committed changes via the Changes Panel commit modal, **When** I switch to the "History" tab, **Then** the new commit appears at the top of the timeline.
3. **Given** the commit history is loading, **When** I switch to the "History" tab, **Then** I see a loading indicator until the data is ready.
4. **Given** a project with no commits yet, **When** I switch to the "History" tab, **Then** I see an empty state message (e.g., "Nessun commit trovato").

---

### User Story 3 - Contextual Commit Count Badge on History Tab (Priority: P3)

As a developer, I want the "History" tab to show a count of recent commits, so I can quickly gauge activity without opening the tab.

**Why this priority**: The "Pending" tab already shows a file count badge. Mirroring this pattern on the "History" tab maintains UI consistency and provides at-a-glance info.

**Independent Test**: Verify that the History tab label shows a commit count badge that matches the number of commits displayed in the timeline.

**Acceptance Scenarios**:

1. **Given** a project with 12 commits in the loaded history, **When** I look at the tab bar, **Then** the "History" tab displays "12" as a badge count.
2. **Given** no commits exist, **When** I look at the tab bar, **Then** no badge is shown (or "0" is hidden).

---

### Edge Cases

- What happens when the branch name is very long (e.g., `feature/JIRA-12345-implement-oauth2-with-multiple-providers-and-fallback`)? It should truncate with ellipsis and show full name on hover tooltip.
- What happens when the user is in detached HEAD state? Display the short commit hash (e.g., `HEAD detached at a1b2c3d`).
- What happens if the git history fetch fails (e.g., corrupted repo)? Show error state in the History tab without breaking the Pending/Committed tabs.
- What happens when switching between projects/sessions? Branch info and history should update to reflect the new project context.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the current Git branch name in a persistent "context bar" positioned above the tab row in the Changes Panel, visible regardless of which tab is active. Layout: `[branch-icon] branch-name [worktree-badge?]`.
- **FR-002**: System MUST visually distinguish when the current context is a worktree (e.g., icon or badge) versus the main working directory.
- **FR-003**: System MUST update the displayed branch name in real-time when the branch changes (listening to existing branch change events).
- **FR-004**: System MUST add a third tab labeled "History" alongside the existing "Pending" and "Committed" tabs.
- **FR-005**: The "History" tab MUST render commit entries using the same visual timeline style already used in the Git Panel (vertical line, colored avatars, author initials, summary, relative time).
- **FR-006**: System MUST NOT duplicate the git-history-timeline implementation — it MUST reuse the existing component or extract it into a shared module.
- **FR-007**: The "History" tab MUST show a loading state while commit history is being fetched.
- **FR-008**: The "History" tab MUST show an empty state when no commits exist.
- **FR-009**: Long branch names MUST be truncated with ellipsis and show the full name on hover (tooltip).
- **FR-010**: System MUST gracefully handle non-git projects by hiding branch info entirely.

### Key Entities

- **Branch Info**: The current branch name, whether it's a worktree, and the worktree path (if applicable). Sourced from session/terminal state already tracked by the application.
- **Commit Entry**: Hash, summary, author, relative time, timestamp. Already defined in the codebase as a shared type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the current branch within 1 second of opening the Changes Panel.
- **SC-002**: Branch name updates within 2 seconds of a branch switch event.
- **SC-003**: Commit history loads and displays within 3 seconds for repositories with up to 500 commits.
- **SC-004**: No duplicate code between the Changes Panel history view and the existing Git Panel timeline — shared component or direct reuse.

## Assumptions

- The existing branch-changed event provides reliable real-time branch updates (already verified in the application layer).
- The existing commit entry type and commit history fetching logic (used in the Git Panel) can be reused or shared without modification.
- The Changes Panel is always rendered within a session context that has access to the project root path, session branch, and worktree path.
- The tab state will be extended from two values (pending/committed) to three (pending/committed/history).
