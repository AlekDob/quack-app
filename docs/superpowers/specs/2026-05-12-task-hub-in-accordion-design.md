---
type: design-spec
project: quack-app
created: 2026-05-12
status: approved
related_features: [035-side-panel-accordion, 043-agent-sidebar, 054-task-hub-view]
tags: [task-hub, side-panel, accordion, ui-refactor, sidebar-cleanup]
---

# Task Hub in Accordion (Design Spec)

## Context

Today the **Task Hub** view (feature 054) lives in the left sidebar as an alternative to the project tree. To see it the user clicks a `SidebarViewToggle` (folder/checklist icons) and loses the project tree until they toggle back. The user wants the Task Hub *always within reach* while keeping the project tree visible.

The right-side **Side Panel Accordion** (feature 035) is the natural home: it already hosts 13 collapsible sections (Changes, Brain, Skills, etc.) with hover-peek behavior in compact mode. Adding the Task Hub as the **first section** gives it priority placement plus a badge that surfaces "needs your attention" counts even when the section is collapsed.

## Goals

- Make the Task Hub reachable from the right panel without losing the project tree on the left.
- Surface "actionable" sessions (P1 Needs attention + P2 Agent done) via a badge on the section header — visible even when collapsed.
- Single source of truth: Task Hub lives in **one place only** (right panel).
- Reuse `TaskHubView` as-is (no fork, no compact variant).

## Non-Goals

- No changes to `TaskHubItem`, priority logic, or project-color chip rendering.
- No PiP window changes (feature 053 keeps its own priority logic).
- No new keyboard shortcut: the existing one is **remapped** to focus the accordion section.
- No additional test coverage beyond the new badge calculation (existing TaskHubView has no tests today).

## Design

### 1. New Accordion Section

| Field | Value |
|---|---|
| Section ID | `taskhub` |
| Title | `Task Hub` |
| Color (`CATEGORY_COLORS`) | `#a855f7` (purple — matches P1 accent inside `TaskHubItem`) |
| Icon | checklist (3 horizontal lines + 3 dots, reused from `SidebarViewToggle`, normalized to `viewBox="0 0 20 20"` size 14x14 for consistency with sibling icons) |
| Position | `sectionIds[0]` — first slot, before `changes` |
| Badge | `pendingCount(P1) + agentDoneCount(P3)` |
| Focus-mode | standard (`flex: 1`, content scroll up to `80vh - 50px`) |
| Hover-peek (compact mode) | standard (500ms enter / 300ms leave debounce) |

### 2. Badge Calculation

Extract a pure helper to make it testable:

```ts
// in TaskHubView.tsx (exported)
export function computeTaskHubBadge(
  sessions: AgentSession[],
  chatSessions: Map<string, ChatMessage[]> | undefined,
  pendingQuestionsMap: Map<string, Set<string>>
): number {
  let count = 0;
  for (const session of sessions) {
    if (session.status === 'done') continue;
    const pending = pendingQuestionsMap.get(session.id);
    if (pending && pending.size > 0) {
      count++; // P1
      continue;
    }
    const messages = chatSessions?.get(session.id) ?? [];
    if (isAgentDone(messages)) {
      count++; // P2
    }
  }
  return count;
}
```

`SidePanelAccordion.tsx` calls `computeTaskHubBadge(...)` with values from `sessionStore` + `chatStore` to feed the `badge` prop.

### 3. Internal Search

`TaskHubView` currently receives `searchQuery` as a prop fed by the **left** sidebar's search input. With the move, that source disappears. Refactor:

- Remove `searchQuery` from `TaskHubViewProps`.
- Add a small `<input type="text" placeholder="Search tasks">` as a header **inside** `TaskHubView`, with local `useState`.
- Style: existing `.task-hub-search` CSS class (reuse left-sidebar search styles, scoped via component CSS).

This makes `TaskHubView` self-contained and matches how `SkillsPanel` / `MCPPanel` already work (each owns its own search).

### 4. Props Chain (App.tsx -> SidePanelAccordion -> TaskHubView)

`SidePanelAccordion` needs the following new props (passed through to `TaskHubView`):

- `terminals: TerminalInfo[]`
- `onSessionClick: (sessionId: string) => void`
- `activeSessionId?: string`
- `onActiveSessionDone?: () => void`
- `chatSessions?: Map<string, ChatMessage[]>`

All of these already exist in `App.tsx` and are currently passed to `TerminalSidebar`. No new state is introduced — just a second consumer.

`lastReadTimestamps` was in the prop type but unused inside the component — drop it.

### 5. Cleanup (removals)

| File | Change |
|---|---|
| `src/components/SidebarViewToggle.tsx` | **DELETE FILE** |
| `src/stores/uiStore.ts` | Remove `sidebarView: 'projects' \| 'taskhub'` field and `setSidebarView` action |
| `src/App.tsx` | Remove `sidebarView` subscription; remap the existing keyboard shortcut (line ~10901) so that instead of toggling sidebar mode it sets `focusedSection='taskhub'` in `SidePanelAccordion` (via a new `forceExpandSection` prop value or callback) |
| `src/components/TerminalSidebar.tsx` | Remove imports of `SidebarViewToggle` and `TaskHubView`; remove conditional render `{sidebarView === 'taskhub' && <TaskHubView ... />}`; always render the project tree; remove the toggle button from the sidebar header |

### 6. Keyboard Shortcut Remap

Today `App.tsx:10901` does:
```ts
setSidebarView(sidebarView === 'projects' ? 'taskhub' : 'projects');
```

After the refactor: same shortcut focuses the accordion's `taskhub` section (already supported by `forceExpandSection` prop on `SidePanelAccordion`). If the section is already focused, the shortcut collapses it.

### 7. CSS

No new files. `TaskHubView.css` gains a small `.task-hub-search` block for the internal search input. `SidePanelAccordion.css` needs no changes — the new section uses the existing `--category-color` CSS var mechanism (purple is wired automatically via `CATEGORY_COLORS.taskhub`).

## Test Plan

- **New unit test**: `src/components/__tests__/taskHubBadge.test.ts` covering `computeTaskHubBadge`:
  - empty sessions -> 0
  - all done -> 0
  - one P1 (pending question) -> 1
  - one P3 (agent done) -> 1
  - one P1 + one P3 -> 2
  - P2 (loading) -> 0 (excluded)
  - P4 (idle) -> 0 (excluded)
- **Manual smoke tests** (in `documentation/diary/2026-05-12.md`):
  - Open Quack with one or more active sessions, verify Task Hub section appears as #0 with purple icon.
  - Trigger an AskUserQuestion in a session -> badge increments by 1.
  - Complete an agent reply -> badge increments by 1.
  - Mark a session done -> badge decrements.
  - Compact mode (collapse panel) -> Task Hub icon visible in 44px strip with purple dot.
  - Hover over Task Hub icon in compact mode -> peek overlay (420px) shows the view.
  - Keyboard shortcut -> focuses Task Hub section in accordion.
  - Click a session in Task Hub -> activates that session (same as before).
  - Search "foo" inside Task Hub -> filters sessions by title/projectName/agentLabel.

## Trade-offs

- **Removing `searchQuery` prop changes `TaskHubView` API**: if we ever wanted to reintroduce a left-sidebar Task Hub view we'd need to re-add the prop. Accepted: the user explicitly chose "single source of truth in DX".
- **Peek overlay is 420px wide**: `TaskHubItem` rows have project chip + agent avatar + timestamp + title. With ellipsis on title and `maxWidth: 90px` on project chip it works, but long titles get clipped earlier than in the left sidebar. Accepted: no compact variant fork.
- **Adding a section at `[0]` shifts the order**: the existing `sectionIds` array drives DOM order via CSS `order`. Inserting at the top is one-line in code but shifts focus persistence: any user who previously had `changes` focused at startup will still see `changes` focused — no migration needed because focus state is ephemeral (component state, not persisted).

## Migration / Cleanup Checklist (post-implementation)

- [ ] Delete `src/components/SidebarViewToggle.tsx`
- [ ] Verify no remaining references to `sidebarView` (`grep -r "sidebarView" src/`)
- [ ] Update `documentation/features/054-task-hub-view.md`: change "lives in left sidebar via toggle" -> "lives in right accordion, section #0"
- [ ] Update `documentation/features/035-side-panel-accordion.md`: add section #0 `taskhub` + badge formula; bump section count from 13 to 14
- [ ] Update `documentation/features/043-agent-sidebar.md`: remove `SidebarViewToggle` row and `sidebarView` references
- [ ] Add diary entry to `documentation/diary/2026-05-12.md`
- [ ] Consider Brain entry under `documentation/patterns/` if the "extract pure helper -> badge" pattern is reusable

## Open Questions

None. All operational decisions resolved during brainstorming.
