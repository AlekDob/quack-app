---
type: feature-doc
project: quack-app
stack: React 18, TypeScript, Zustand
created: 2026-04-09
last_verified: 2026-05-12
tags: [task-hub, sessions, priority, side-panel, accordion, pip-window, project-color]
---

## Task Hub View
**Purpose:** First section of the right-side accordion (035), showing all active (non-done) sessions grouped by priority — Needs attention, Working, Agent done, Other — giving a cross-project status overview without the project-tree hierarchy. Self-contained: owns its search input. Badge on the accordion header surfaces P1 + P3 (sessions that need attention now) even when collapsed.
**Stack:** React 18, TypeScript, Zustand (`sessionStore`, `chatStore`)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/TaskHubView.tsx` | Main container: priority grouping logic, sort, internal search input, delete/rename dialogs; exports `computeTaskHubBadge` and `isAgentDone` helpers |
| Component | `src/components/TaskHubItem.tsx` | Single session row: status dot, **colored project chip (left of title)**, title, agent avatar, relative time, context menu; exports `SessionPriority` type |
| Test | `src/components/__tests__/taskHubBadge.test.ts` | 10 unit tests for `computeTaskHubBadge` (TDD) |
| Config | `src/components/TaskHubView.css` | `.task-hub-container`, `.task-hub-search`, `.task-hub-list`, `.task-hub-group`, `.task-hub-section-header`, `.task-hub-section-count`, `.task-hub-empty` |

### Data Flow
```
[App.tsx] → props (terminals, onSessionClick, activeSessionId, onActiveSessionDone, chatSessions) → [SidePanelAccordion] → [TaskHubView]
[sessionStore.sessions] → filter(status !== 'done') → searchQuery filter (title / projectName / agentLabel)
[chatStore.chatLoadingMap] + [chatStore.pendingQuestionsMap] + [chatSessions prop] → priority assignment per session
priority assigned → sort (priority ASC, updatedAt DESC) → grouped by priority → TaskHubItem[]
TaskHubItem click → onSessionClick(sessionId) → App.tsx (session activation)
TaskHubItem context menu → handleMarkDone / handleDeleteRequest / handleRenameRequest → sessionStore.updateSession / deleteSession
[SidePanelAccordion] → useMemo(computeTaskHubBadge(sessions, chatSessions, pendingQuestionsMap)) → badge on accordion header
[App.tsx keyboard shortcut "toggleSidebarView"] → setForceExpandSection('taskhub') → SidePanelAccordion focuses the section
```

### Key Functions
- `TaskHubView(props) → JSX` — main component: owns internal `searchQuery` state, computes `sortedSessions` and `groups`, renders section headers and item list, hosts delete/rename dialog modals
- `isAgentDone(messages: ChatMessage[]) → boolean` — **exported**: returns true when the last message is a complete assistant message (`status === 'complete' || undefined`)
- `computeTaskHubBadge(sessions, chatSessions, pendingQuestionsMap) → number` — **exported pure helper**: count of sessions where `pendingQuestionsMap.get(id).size > 0` OR last message is a complete assistant message. Used by `SidePanelAccordion` to feed the section badge.
- `getItemOpacity(priority: SessionPriority, indexInGroup: number, groupSize: number) → number` — P1–P3 always `1.0`; P4 fades from `0.75` to `0.4` based on position within group
- `TaskHubItem(props) → JSX` — session row with priority accent border, status dot (reuses `AgentSessionItem.css` animations), context menu via `createPortal`

### State
| Name | Type | Scope | Description |
|------|------|-------|-------------|
| `searchQuery` | `string` | TaskHubView | Local state for the internal search input (no longer a prop) |
| `deleteDialog` | `{ id: string; title: string } \| null` | TaskHubView | Tracks the session pending deletion confirmation |
| `renameDialog` | `{ id: string; title: string } \| null` | TaskHubView | Tracks the session pending rename |
| `renameValue` | `string` | TaskHubView | Controlled input value for rename dialog |
| `sessions` | `AgentSession[]` | global (sessionStore) | Source of all sessions |
| `chatLoadingMap` | `Map<string, boolean>` | global (chatStore) | Per-session loading flag |
| `pendingQuestionsMap` | `Map<string, Set<string>>` | global (chatStore) | Per-session pending AskUser question IDs |

### Priority Order
| Priority | Label | Condition |
|----------|-------|-----------|
| 1 | Needs attention | `pendingQuestionsMap.get(id).size > 0` |
| 2 | Working | `chatLoadingMap.get(id) === true` OR last message is streaming (`status === 'streaming'`) |
| 3 | Agent done | Last message is complete assistant message (`isAgentDone`) |
| 4 | Other | None of the above (idle, no messages, etc.) |

**Badge formula** (used by `SidePanelAccordion` section header): `count(P1) + count(P3)` — i.e. "Needs attention" + "Agent done", the sessions that require human action now.

Within each priority group, sessions are sorted by `updatedAt` descending (most recent first).

### Priority Accent Colors (TaskHubItem)
| Priority | Color | Meaning |
|----------|-------|---------|
| 1 | `#a855f7` (purple) | Needs user input |
| 2 | `#22c55e` (green) | Actively working |
| 3 | `#f59e0b` (orange) | Agent done, awaiting review |
| 4 | `null` | Transparent border |

### External Dependencies
- `sessionStore` (`useSessionStore`): `sessions`, `updateSession`, `deleteSession`
- `chatStore` (`useChatStore`): `chatLoadingMap`, `pendingQuestionsMap`
- `../utils/timeFormat` (`formatRelativeTime`): relative time string for item rows
- `../utils/sessionStatus` (`getActivityDotColor`, `getTimeColor`, `getDotClassName`): dot color/class logic shared with `AgentSessionItem`
- `../hooks/useAgentAvatar`: resolves duck avatar URL from label/avatar string
- `../hooks/useProjectColor` + `../utils/projectColors` (`DEFAULT_PROJECT_COLORS`): color of the project chip — pulls custom color from `.quack-repo-order.dat` storage, falls back to a deterministic palette index hashed from `projectPath`
- `react-dom` (`createPortal`): context menu rendering at `document.body`

### Config
- `SECTION_LABELS: Record<SessionPriority, string>` — `{ 1: 'Needs attention', 2: 'Working', 3: 'Agent done', 4: 'Other' }`
- `PRIORITY_ACCENT: Record<SessionPriority, string | null>` — left-border accent hex per priority (see table above)
- `SessionPriority` type — exported from `TaskHubItem.tsx`: `1 | 2 | 3 | 4`
- Completed sessions (`status === 'done'`) are excluded — they belong in the Kanban/Projects view
- P4 opacity fades: single item → `0.7`; multiple items → `Math.max(0.4, 0.75 - (idx / size) * 0.35)`
- Project chip is rendered only when `hasMultipleProjects` (more than one distinct `projectName` across active sessions). Style: `9px / 600`, lowercase, `${projectColor}1F` background, `${projectColor}55` border, `${projectColor}` text, `maxWidth: 90px` ellipsis. Position: between status dot and title, replacing the previous tiny grey label that lived after the agent avatar.
- `projectFallbackIndex(key)` (local helper in `TaskHubItem.tsx`): 32-bit string hash of the project path, modulo `DEFAULT_PROJECT_COLORS.length`. Ensures projects without a custom color in storage still get distinct, stable hues across sessions instead of all defaulting to `DEFAULT_PROJECT_COLORS[0]` (orange).

### Cross-project switch UX
Clicking a Task Hub row whose `session.projectPath` differs from the active project triggers the cross-project switch path in `handleSessionClick` (`App.tsx`):

1. `flushSync(setProjectSwitchTarget({ projectName, projectPath }))` forces an immediate paint of the `.fullscreen-loader-overlay` (purple spinner + "Switching to <project>…") BEFORE the heavy work blocks the main thread.
2. State updates (`setActiveTabId`, `setActiveSessionIdExclusive`, `selectSession`, `setActiveId`) are deferred with `setTimeout(0)` and wrapped in React 18 `startTransition` so React can interrupt the commit for paint/input.
3. Heavy Tauri invokes (`load_agent_personality` + `inject_personality_to_claude_md` + `loadDirectory`) are deferred with `setTimeout(50)` so they start AFTER the loader has painted.
4. The loader is auto-cleared by an effect when `currentProjectPath === projectSwitchTarget.projectPath`; a 3.5s safety timeout guards against the effect not firing (race / error).
5. `updateSession({ initialPromptConsumed: true })` is also deferred (`setTimeout(0)`) to avoid piling a disk write onto the cascade.

Same-project switches run synchronously (the cascade is cheap and deferring would flash the loader).

Skills load deduplication: `loadAvailableSkills` (in `src/utils/skillsAndDroidsLoader.ts`) is now memoized with an in-flight Promise map + 2s TTL cache. The 3+ concurrent calls from `ChatInput`/`SkillSelector` during a switch share a single Tauri round-trip.

### Cross-References
- **035-side-panel-accordion** — host of the Task Hub section (first slot, `sectionIds[0]`). Section badge fed by `computeTaskHubBadge(...)` exported from `TaskHubView`. Color `#a855f7` (purple).
- **043-agent-sidebar** — parent left sidebar; no longer renders Task Hub. The view toggle (`SidebarViewToggle`) was removed on 2026-05-12.
- **053-pip-window** — the PiP floating window uses the same 4-level priority grouping (1=Needs attention, 2=Working, 3=Agent done, 4=Other) and identical section labels; both views share the same mental model for session status triage
- **`documentation/bugs/fix-token-stats-panel-blocks-project-switch.md`** — sibling fix for the cross-project freeze (token-stats gated on `enabled`)
- **`documentation/bugs/fix-double-loadagents-cross-project-session.md`** — sibling fix for `loadAgents` cascade; outstanding items in that entry (skills load x3, save x3, tab cascade) are partially mitigated by the loader + skills cache landed on 2026-05-12
