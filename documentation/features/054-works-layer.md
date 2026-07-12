---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-12
tags: [works, plan-mode, tickets, kanban, timeline, modules, plane, drawer, brain]
---

# 054 — Works layer (Plane-inspired tickets)

**Purpose:** Native project-management tickets per workspace — Plane-style **views** sidebar, list/kanban/timeline, **Modules** feature catalog (Brain UI), app-level work + feature drawers, composer quick actions, Plan mode → Work ticket, cross-session context inject, optional Plane sync.

## Storage

| Path | Role |
|---|---|
| `{workspace}/.codetta/works/snapshot.json` | Modules, labels, items, `viewPrefs` (layout + `sidebarView`) |
| `{workspace}/.codetta/works/events.jsonl` | Append-only audit log |

Rust: `works_store.rs` — `works_load`, `works_save`, `works_append_event`.

## Tab

| Concern | Detail |
|---|---|
| Key | `works:{wsId}` — one tab per workspace (`worksKey` in `store.ts`) |
| Command | `view.open_works` (⌘P → Open Works) |
| Activity bar | `columns-2` icon (Organigramma / Brain / Usage group) |
| Layout | `.pane-content > .works-root { inset: 0 }` — portal + full-bleed stage |

## Sidebar — Plane-style views (v3)

Left rail is a **collection of views**, not module filters. Persisted in `viewPrefs.sidebarView`.

| View id | Label | Main panel |
|---|---|---|
| `all` | All work items | List / kanban / timeline (filtered: none) |
| `in_progress` | In progress | Same layouts, status filter |
| `todo` | Todo | Same |
| `backlog` | Backlog | Same |
| `done` | Completed | Same |
| `cancelled` | Cancelled | Same |
| `modules` | Modules | **Feature catalog** (not work items) |

| File | Role |
|---|---|
| `src/worksViews.ts` | `WORKS_SIDEBAR_VIEWS`, `filterItemsByView`, `countForView` |
| `src/components/works/WorksViewsRail.tsx` | Left rail UI + count badges |
| `src/components/works/WorksFeaturesCatalog.tsx` | Modules view — Brain search bar + `.brain-hit-row` list, stagger animation |
| `src/components/works/WorksPane.tsx` | Wires view → filter or catalog; breadcrumb shows active view name |

**Modules view:** scans `snap.modules` with `featurePath`; search filters name/slug/path; row click → `openFeatureDocDrawer`. Work count per feature shown in badge.

**Gotcha:** Kanban/timeline layout switcher hidden on `modules` view; Add work item hidden there too.

## Main layouts (work views)

| Layout | Component | Notes |
|---|---|---|
| List | `WorksPane` | Default; sorted by `updatedAt` |
| Kanban | `WorksKanbanView` | HTML5 DnD → `updateWorkItem` status |
| Timeline | `WorksTimelineView` | Week columns; `TimelineBar` drag move + resize handles → dates |

Context menu (`useWorkItemContextMenu.tsx`): Rename, Duplicate, Delete on list/kanban/timeline rows.

## App-level drawers

Both mount on `document.body` via portal; mutually exclusive (`openWorkDrawer` closes feature drawer and vice versa). Resizable width: `useResizableWorkDrawerWidth` (default 680px, `workDrawerWidth.ts`).

### Work item — `WorkItemDrawer.tsx`

| Area | Behaviour |
|---|---|
| Hero | `shortId` + module breadcrumb; editable title; icon actions (feature doc, Plane sync, close) |
| Properties | Cursor-style label→value grid: Status (select), Priority, Start, Target, Labels |
| Body | `WorkItemEditor` (Notion blocks) + `WorkComments` (Activity / Comments tabs) |
| Style | Single `--bg` surface, fade-up animations, underline tabs, flat comment composer |

Bus: `workDrawer.ts` — `openWorkDrawer`, `subscribeWorkDrawer`.

### Feature doc — `FeatureDocDrawer.tsx`

Preview `documentation/features/*.md` from Modules catalog or work drawer.

| Concern | File / detail |
|---|---|
| Preview body | `featureDocPreview.ts` — strip YAML frontmatter + first heading matching title |
| Title hero | `featureDisplayTitle` — drops `NNN —` when badge shows number |
| File meta | `featureFileLabel` — `chat-composer.md` not `022-chat-composer.md` |
| Open in editor | Closes drawer after `openFile` |

Bus: `featureDocDrawer.ts`.

## Composer

| Piece | Role |
|---|---|
| `ComposerWorkBar` | Work pill, + Work menu, plan draft on Plan enter, status cycle |
| `ComposerWorkActions` | Acceptance N/M, linked sessions, active tasks, edits flag (`workProgressStore`) |

## Chat linkage

| Mechanism | Detail |
|---|---|
| `AIChatDescriptor.workItemId` | Optional FK |
| `setAIChatWorkItem` | Bind chat ↔ work |
| `workContextInject.ts` | Prepends `[Quack Work — …]` + feature path on send |
| `@W-001` | Mention in composer links chat to work |

## Agent Hub

`WorkHubBadge` on `AIChatsRail` when `chat.workItemId` is set.

## Plane sync (optional)

`worksPlaneSettings.ts` (localStorage per ws) + `planeSync.ts` (REST). UI: `WorksPlanePanel` in Works toolbar + cloud icon in work drawer.

## Progress

`workProgressStore.ts` — acceptance checklist + linked chat todos/diffs; refreshed on `saveWorks`.

## Feature modules (Brain integration)

Modules sync from `documentation/features/*.md` on hydrate + Works tab open:

| Concern | File |
|---|---|
| Scan + stable ids | `worksFeatureModules.ts` — `feat:{slug}`, title from first `#` / `##` |
| Hydrate | `worksCache.ts` → `syncFeatureModules`, `refreshWorksModules` |
| Fields | `WorkModule.featureSlug`, `featurePath`, `featureNum` |
| Context inject | `workContextInject.ts` includes `documentation/features/…` path |

Fallback generic modules (Bug, Feature…) only when features directory is missing.

## Block editor + comments

| File | Role |
|---|---|
| `workBlockEditor.ts` | Block helpers + slash commands |
| `WorkBlockEditor.tsx` / `WorkBlockRow.tsx` / `WorkBlockSlashMenu.tsx` | Notion-style description |
| `WorkComments.tsx` | Activity feed + comment composer (⌘↵ send) |

## Skills (pre-installed)

Bundled in `documentation/skills/` — `/` slash menu via `loadSkills` (`source: bundled`):

| Skill | Role |
|---|---|
| `quack-brain` | Brain + Works PM loop |
| `quack-works` | Ticket CRUD, views, Plane sync, module ↔ feature doc |

## Key files

| Concern | File |
|---|---|
| Types | `src/works.ts` |
| Views | `src/worksViews.ts` |
| Feature modules | `src/worksFeatureModules.ts` |
| Preview strip | `src/featureDocPreview.ts` |
| Cache + CRUD | `src/worksCache.ts` |
| Shell | `src/components/works/WorksPane.tsx` |
| Drawers | `WorkItemDrawer.tsx`, `FeatureDocDrawer.tsx` |
| Kanban / timeline | `WorksKanbanView.tsx`, `WorksTimelineView.tsx`, `TimelineBar.tsx` |
| Composer | `ComposerWorkBar.tsx`, `ComposerWorkActions.tsx` |
| Hub badge | `WorkHubBadge.tsx` |
| Plan bridge | `ClaudePermissionOverlay.tsx` (`onPlanApproved`) |
| CSS | `App.css` — `.works-*`, `.work-drawer-*`, `.work-comments-*` |

## Not yet

- Dedicated `quack_work_*` Rust/CC tool bridge (agents use snapshot.json + skill today)
- Custom user-defined saved views (persistence beyond built-in `sidebarView`)
- Keychain storage for Plane token
- Priority edit in work drawer (display-only today)
