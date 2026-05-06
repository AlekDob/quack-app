---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18)
created: 2026-04-05
last_verified: 2026-04-22
tags: [agent-sidebar, sidebar, navigation, dnd-kit, project-groups, agents, sessions, dormant-agents]
---

## Agent Sidebar
**Purpose:** Left sidebar providing project/agent/session navigation with drag-to-reorder, project groups, favorites, search, and dual-view toggle (projects vs task hub).
**Stack:** React 18, TypeScript, Zustand, dnd-kit, Tauri Store

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/TerminalSidebar.tsx` | Main sidebar container: search, DnD context, project groups rendering, favorites toggle, footer |
| Component | `src/components/RepositoryGroup.tsx` | Single project section: agents list, sessions metro-line, git menu, agent DnD, team modal |
| Component | `src/components/AgentSelector.tsx` | Agent creation/selection panel with marketplace templates and bundle import |
| Component | `src/components/AgentSessionItem.tsx` | Session row: status dot, title, badge, relative time, context menu, metro-line connector |
| Component | `src/components/AgentPersonalityCard.tsx` | Expanded agent card with avatar, role, personality details, export button |
| Component | `src/components/SidebarViewToggle.tsx` | Toggle switch between "projects" and "taskhub" views |
| Component | `src/components/TaskHubView.tsx` | Alternative sidebar view grouping sessions by priority |
| Component | `src/components/GroupCreationModal.tsx` | Modal for creating/editing project groups |
| Component | `src/components/DragHandle.tsx` | Reusable grip icon for drag-and-drop handles |
| Store/State | `src/stores/groupStore.ts` | Zustand store for project groups CRUD via Tauri invoke |
| Store/State | `src/stores/uiStore.ts` | `sidebarView` state (`'projects' \| 'taskhub'`) |
| Util | `src/utils/sessionScrollMemory.ts` | Module-level Map singleton: per-session `{messageId}` anchor storage |
| Component | `src/components/AnchorIndicator.tsx` | Floating anchor icon aligned with the scrollbar rail (set/remove/jump-to anchor) |
| Config | `src/components/AnchorIndicator.css` | Anchor indicator styling + hover X button |
| Config | `.quack-repo-order.dat` | Tauri Store file persisting project order, colors, and favorites |
| Config | `src/App.css` | `.sidebar`, `.sidebar-header`, `.sidebar-list`, `.sortable-repository-group`, `.repository-group` classes |
| Config | `src/components/AgentSelector.css` | Agent selector card grid, editing form, marketplace section |
| Config | `src/components/AgentSessionItem.css` | Metro-line connector, status dots, context menu, pulse animation |
| Config | `src/components/AgentPersonalityCard.css` | Expanded agent card layout, avatar, export button |
| Config | `src/components/GroupCreationModal.css` | Group modal form, project picker, color selector |
| Config | `src/components/TaskHubView.css` | Task hub priority-grouped layout |

### Data Flow
```
[Tauri Store (.quack-repo-order.dat)] --> [TerminalSidebar (load order/colors/favorites)]
[TerminalSidebar] --> [DndContext (dnd-kit)] --> [SortableContext (top-level sections)] --> [SortableRepositoryGroup | SortableGroupSection]
[SortableGroupSection] --> [SortableContext (intra-group projects)] --> [SortableRepositoryGroup (insideGroup)]
[RepositoryGroup] --> [SortableAgent (dnd-kit)] --> [AgentPersonalityCard / AgentSessionItem]
[AgentSessionItem click] --> [onSessionClick(sessionId)] --> [App (session activation)] --> [ChatView remount (key change)] --> [ChatInput mount → auto-focus textarea]
[useGroupStore] --> [Tauri invoke (list_groups/create_group/update_group/delete_group)]
[SidebarViewToggle] --> [useUIStore.setSidebarView] --> [projects | taskhub conditional render]
[Intra-group drag] --> [handleRepoDragEnd detects both repo-* in same group] --> [arrayMove on group.projects] --> [updateGroup (Rust persist) + saveRepositoryOrder (local)]
```

### Key Functions
- `TerminalSidebar(props) --> JSX` -- main sidebar with search, DnD, project iteration, footer
- `SortableRepositoryGroup(props) --> JSX` -- dnd-kit sortable wrapper; insideGroup prop hides project borders when nested in a group
- `SortableGroupSection(props) --> JSX` -- sortable wrapper for group sections (multiple projects)
- `fuzzyMatch(query: string, target: string) --> boolean` -- sidebar search filter
- `RepositoryGroup(props) --> JSX` -- project section with agents, sessions, git menu
- `SortableAgent(props) --> JSX` -- draggable agent card within a project
- `getAvatarUrl(avatarName: string) --> string` -- resolve avatar image path (dev/prod)
- `getRepoDisplayName(path: string) --> string` -- extract display name from repo path
- `getBranchName(terminal: TerminalInfo) --> string` -- extract branch from terminal metadata
- `getRelativeTimeString(date: Date) --> string` -- human-readable relative time
- `AgentSelector(props) --> JSX` -- agent creation/selection with marketplace integration
- `AgentSessionItem(props) --> JSX` -- compact session row with metro-line styling
- `AgentPersonalityCard(props) --> JSX` -- expanded agent details with export
- `SidebarViewToggle(props) --> JSX` -- projects/taskhub toggle switch
- `TaskHubView(props) --> JSX` -- sessions grouped by priority
- `GroupCreationModal(props) --> JSX` -- create/edit project groups
- `useGroupStore.loadGroups() --> Promise<void>` -- fetch groups via Tauri
- `useGroupStore.createGroup(name, projects, color?, notes?) --> Promise<ProjectGroup>` -- create group
- `useGroupStore.deleteGroup(groupId) --> Promise<void>` -- delete group
- `useGroupStore.getGroupForProject(path) --> Promise<ProjectGroup | null>` -- lookup
- `handleAddToGroup(groupId, projectPath, label) --> Promise<void>` -- add standalone project to existing group via context menu
- `handleRepoDragEnd (intra-group branch)` -- detects both active/over inside same group, reorders group.projects via updateGroup + repositoryOrder sync

### State
- `query`: string -- sidebar search filter text (component)
- `repositoryOrder`: string[] -- persisted project display order (component)
- `projectColors`: Record<string, string> -- per-project border color (component)
- `favorites`: Set<string> -- favorited project repo keys (component)
- `showFavoritesOnly`: boolean -- filter to show only starred projects (component)
- `activeRepoId`: string | null -- currently expanded repo key for DnD (component)
- `collapsedGroupSections`: Set<string> -- collapsed group IDs (component)
- `sidebarView`: 'projects' | 'taskhub' -- active sidebar mode (global, uiStore)
- `groups`: ProjectGroup[] -- project groups from Rust backend (global, groupStore)
- `agentOrder`: Record<string, string[]> -- per-project agent display order (RepositoryGroup)
- `activeAgentId`: string | null -- currently dragged agent within a project (RepositoryGroup)

### External Dependencies
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`: drag-and-drop for projects and agents
- `@tauri-apps/plugin-store`: persist project order/colors/favorites to `.quack-repo-order.dat`
- `@tauri-apps/api/core` (invoke): Tauri commands for group CRUD (`list_groups`, `create_group`, `update_group`, `delete_group`, `sync_group_contexts`)
- `@tauri-apps/plugin-shell` (open): open external links (Discord, changelog)

### UX: Auto-Focus on Session Select
When a session is clicked (or a new session is created), `ChatView` remounts because its React `key` includes `activeSessionId`. This triggers `ChatInput`'s mount `useEffect` which auto-focuses `textarea.chat-input-field` with a 100ms delay (ensures DOM readiness). This replaces a previous custom-event approach (`quack:focus-chat-input`) that failed due to the unmount/remount cycle.

### UX: Scroll Behavior on Session Switch (Anchor-based)
On session open, the chat always scrolls to the bottom — unless the user has set an **anchor**. The `AnchorIndicator` component renders a small anchor icon aligned with the scrollbar rail:
- **Click (not anchored)** → anchors the message currently centered in the viewport; `messageId` saved in a module-level Map per session.
- **Click (anchored)** → smooth-scrolls to the anchored message.
- **Hover anchored icon** → reveals an "X" → click to clear.
- **Next session open** → if an anchor exists, chat jumps to the anchored message; otherwise scrolls to the bottom.
- `ResizeObserver` (500ms cap) keeps the target aligned while markdown/code/images finish mounting.
- Zero store/subscription cost: Map singleton at module level, cleared on reload.
- The scroll-to-bottom pill button (`showScrollButton`) is still shown when the user is not at the bottom.
- Virtualized list (>100 messages) keeps always-scroll-to-bottom without anchor UX.
- See `patterns/pattern-session-scroll-memory.md`.

### Active vs Dormant Agents (performance + anti-duplicate)
Agents within a project are split into two rendering tiers inside `RepositoryGroup.tsx`:

- **Active agents** = zero sessions OR at least one session with `status !== "done"`. Rendered full-size as `SortableAgent` cards (avatar, DnD, sessions metro-line, notification badges, 60s tick timer). Newly created agents (no sessions yet) belong here so the user can interact with them immediately.
- **Dormant agents** = HAS sessions AND every session is `done` (fully archived). Rendered as a compact chip row under the branch groups: `DORMANT · N` header + `<button>` chips with agent label only. No per-agent `useSessionStore` subscription, no DnD.

**Click on a dormant chip** → opens `NewSessionModal` pre-filled with `setNewSessionModalAgentId(agent.id)` → creates a **new session on the existing agent** (reuse, not duplicate). **Hover** → `KeyboardShortcutTooltip` shows `{role} · Start new session` (or `Start new session with {label}` if personality.role missing).

Computation (single pass, memoized by `[mainAgents, allSessionsForRepo]`):
```ts
const sessionsByAgent = groupBy(allSessionsForRepo, s => s.agentId);
const dormantAgents = mainAgents.filter(a => {
  const sessions = sessionsByAgent.get(a.id);
  if (!sessions || sessions.length === 0) return false; // newly created → active
  return sessions.every(s => s.status === "done");      // all archived → dormant
});
```

**Rationale**:
- **Performance**: project with 10 agents / 2 active previously instantiated 10 memoized cards + 10 store subscriptions + 10 avatar loads + 10 timers. Now only 2. Dormant are pure text chips.
- **Anti-duplicate**: "Add Agent" (`handleOpenNewTerminalModal`) always creates a new `TerminalInfo` via `create_terminal` with no uniqueness check on label. Keeping dormant names visible prevents users from accidentally recreating an agent that already exists.
- **Clutter**: active prominent, dormant still recoverable (not hidden completely).

**Trade-off**: dormant chips bypass the per-agent notification logic (none needed — no active session by definition). Worktree agents are not split (always rendered in `WORKTREES` section).

### Cross-Feature: @ Mention Popup (→ 025-team-delegation-footer)
The sidebar `terminals` (agents grouped by project) are the same data source used for the `@` mention popup's "Team" section. App.tsx filters `terminals` by matching `cwd` (excluding the active agent) and passes them as `projectTerminals` prop to `ChatView` → `ChatInput`. This means every agent visible in the sidebar under the same project is also citeable via `@` in the chat input. See `025-team-delegation-footer.md` for delegation flow details.

### Config
- `DEFAULT_PROJECT_COLORS`: 8-color palette for auto-assigning project border colors (default: `['#FF6B35', '#4DA6FF', '#9B59B6', '#2ECC71', '#E74C3C', '#F39C12', '#1ABC9C', '#E84393']`)
- `COMMUNICATION_STYLES`: 5 personality styles for agent creation (professional, friendly, casual, technical, sarcastic)
- `.quack-repo-order.dat`: Tauri Store persisting `{ order: string[], colors: Record<string, string>, favorites?: string[] }`
