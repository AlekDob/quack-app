---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18)
created: 2026-04-05
last_verified: 2026-04-06
tags: [agent-sidebar, sidebar, navigation, dnd-kit, project-groups, agents, sessions]
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
[TerminalSidebar] --> [DndContext (dnd-kit)] --> [SortableRepositoryGroup] --> [RepositoryGroup]
[RepositoryGroup] --> [SortableAgent (dnd-kit)] --> [AgentPersonalityCard / AgentSessionItem]
[AgentSessionItem click] --> [onSessionClick(sessionId)] --> [App (session activation)]
[useGroupStore] --> [Tauri invoke (list_groups/create_group/update_group/delete_group)]
[SidebarViewToggle] --> [useUIStore.setSidebarView] --> [projects | taskhub conditional render]
```

### Key Functions
- `TerminalSidebar(props) --> JSX` -- main sidebar with search, DnD, project iteration, footer
- `SortableRepositoryGroup(props) --> JSX` -- dnd-kit sortable wrapper with colored border-left
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

### Cross-Feature: @ Mention Popup (→ 025-team-delegation-footer)
The sidebar `terminals` (agents grouped by project) are the same data source used for the `@` mention popup's "Team" section. App.tsx filters `terminals` by matching `cwd` (excluding the active agent) and passes them as `projectTerminals` prop to `ChatView` → `ChatInput`. This means every agent visible in the sidebar under the same project is also citeable via `@` in the chat input. See `025-team-delegation-footer.md` for delegation flow details.

### Config
- `DEFAULT_PROJECT_COLORS`: 8-color palette for auto-assigning project border colors (default: `['#FF6B35', '#4DA6FF', '#9B59B6', '#2ECC71', '#E74C3C', '#F39C12', '#1ABC9C', '#E84393']`)
- `COMMUNICATION_STYLES`: 5 personality styles for agent creation (professional, friendly, casual, technical, sarcastic)
- `.quack-repo-order.dat`: Tauri Store persisting `{ order: string[], colors: Record<string, string>, favorites?: string[] }`
