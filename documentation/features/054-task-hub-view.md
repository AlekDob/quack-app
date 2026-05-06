---
type: feature-doc
project: quack-app
stack: React 18, TypeScript, Zustand
created: 2026-04-09
last_verified: 2026-05-06
tags: [task-hub, sessions, priority, sidebar, pip-window, project-color]
---

## Task Hub View
**Purpose:** Alternative sidebar view showing all active (non-done) sessions grouped by priority — Needs attention, Agent done, Working, Other — giving a cross-project status overview without the project-tree hierarchy.
**Stack:** React 18, TypeScript, Zustand (`sessionStore`, `chatStore`)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/TaskHubView.tsx` | Main container: priority grouping logic, sort, search filter, delete/rename dialogs |
| Component | `src/components/TaskHubItem.tsx` | Single session row: status dot, **colored project chip (left of title)**, title, agent avatar, relative time, context menu; exports `SessionPriority` type |
| Component | `src/components/SidebarViewToggle.tsx` | Folder/list icon toggle switching `sidebarView` between `'projects'` and `'taskhub'` |
| Config | `src/components/TaskHubView.css` | `.task-hub-list`, `.task-hub-group`, `.task-hub-section-header`, `.task-hub-section-count`, `.task-hub-empty` |

### Data Flow
```
[sessionStore.sessions] → filter(status !== 'done') → searchQuery filter (title / projectName / agentLabel)
[chatStore.chatLoadingMap] + [chatStore.pendingQuestionsMap] + [chatSessions prop] → priority assignment per session
priority assigned → sort (priority ASC, updatedAt DESC) → grouped by priority → TaskHubItem[]
TaskHubItem click → onSessionClick(sessionId) → App.tsx (session activation)
TaskHubItem context menu → handleMarkDone / handleDeleteRequest / handleRenameRequest → sessionStore.updateSession / deleteSession
SidebarViewToggle onChange → useUIStore.setSidebarView('taskhub' | 'projects')
```

### Key Functions
- `TaskHubView(props) → JSX` — main component: computes `sortedSessions` and `groups`, renders section headers and item list, hosts delete/rename dialog modals
- `isAgentDone(messages: ChatMessage[]) → boolean` — returns true when the last message is a complete assistant message (`status === 'complete' || undefined`)
- `getItemOpacity(priority: SessionPriority, indexInGroup: number, groupSize: number) → number` — P1–P3 always `1.0`; P4 fades from `0.75` to `0.4` based on position within group
- `TaskHubItem(props) → JSX` — session row with priority accent border, status dot (reuses `AgentSessionItem.css` animations), context menu via `createPortal`
- `SidebarViewToggle(props) → JSX` — two icon buttons (folder = projects, checklist = taskhub); active state via `var(--bg-hover)`

### State
| Name | Type | Scope | Description |
|------|------|-------|-------------|
| `deleteDialog` | `{ id: string; title: string } \| null` | TaskHubView | Tracks the session pending deletion confirmation |
| `renameDialog` | `{ id: string; title: string } \| null` | TaskHubView | Tracks the session pending rename |
| `renameValue` | `string` | TaskHubView | Controlled input value for rename dialog |
| `sessions` | `AgentSession[]` | global (sessionStore) | Source of all sessions |
| `chatLoadingMap` | `Map<string, boolean>` | global (chatStore) | Per-session loading flag |
| `pendingQuestionsMap` | `Map<string, Set<string>>` | global (chatStore) | Per-session pending AskUser question IDs |
| `sidebarView` | `'projects' \| 'taskhub'` | global (uiStore) | Active sidebar display mode |

### Priority Order
| Priority | Label | Condition |
|----------|-------|-----------|
| 1 | Needs attention | `pendingQuestionsMap.get(id).size > 0` |
| 2 | Agent done | Last message is complete assistant message (`isAgentDone`) |
| 3 | Working | `chatLoadingMap.get(id) === true` OR last message is streaming (`status === 'streaming'`) |
| 4 | Other | None of the above (idle, no messages, etc.) |

Within each priority group, sessions are sorted by `updatedAt` descending (most recent first).

### Priority Accent Colors (TaskHubItem)
| Priority | Color | Meaning |
|----------|-------|---------|
| 1 | `#a855f7` (purple) | Needs user input |
| 2 | `#f59e0b` (orange) | Agent done, awaiting review |
| 3 | `#22c55e` (green) | Actively working |
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
- `SECTION_LABELS: Record<SessionPriority, string>` — `{ 1: 'Needs attention', 2: 'Agent done', 3: 'Working', 4: 'Other' }`
- `PRIORITY_ACCENT: Record<SessionPriority, string | null>` — left-border accent hex per priority (see table above)
- `SessionPriority` type — exported from `TaskHubItem.tsx`: `1 | 2 | 3 | 4`
- Completed sessions (`status === 'done'`) are excluded — they belong in the Kanban/Projects view
- P4 opacity fades: single item → `0.7`; multiple items → `Math.max(0.4, 0.75 - (idx / size) * 0.35)`
- Project chip is rendered only when `hasMultipleProjects` (more than one distinct `projectName` across active sessions). Style: `9px / 600`, lowercase, `${projectColor}1F` background, `${projectColor}55` border, `${projectColor}` text, `maxWidth: 90px` ellipsis. Position: between status dot and title, replacing the previous tiny grey label that lived after the agent avatar.
- `projectFallbackIndex(key)` (local helper in `TaskHubItem.tsx`): 32-bit string hash of the project path, modulo `DEFAULT_PROJECT_COLORS.length`. Ensures projects without a custom color in storage still get distinct, stable hues across sessions instead of all defaulting to `DEFAULT_PROJECT_COLORS[0]` (orange).

### Cross-References
- **043-agent-sidebar** — parent sidebar feature; `SidebarViewToggle` lives in `TerminalSidebar.tsx`; `sidebarView` state in `uiStore` drives the conditional render between `TaskHubView` and the project tree
- **053-pip-window** — the PiP floating window uses the same 4-level priority grouping (1=Needs attention, 2=Agent done, 3=Working, 4=Other) and identical section labels; both views share the same mental model for session status triage
