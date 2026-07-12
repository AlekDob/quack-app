---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-12
related: [063-surface-view-prefs.md, 065-works-drawer-ux.md, 066-works-cycles-stories.md, 068-quack-plan-harness.md]
tags: [works, plan-mode, tickets, kanban, timeline, modules, plane, drawer, brain, markdown]
---

# 054 — Works layer (Plane-inspired tickets)

**Purpose:** Native project-management tickets per workspace — Plane-style **views** sidebar, list/kanban/timeline, **Modules** feature catalog (Brain UI), app-level work + feature drawers, composer quick actions, Plan mode → Work ticket, cross-session context inject, optional Plane sync.

## Storage (hybrid — v3 markdown)

| Path | Role |
|---|---|
| `{workspace}/works/snapshot.json` | **Index** — modules, labels, cycles, stories meta, item metadata, `viewPrefs`, `nextSeq`, `nextStorySeq` (`version: 3`) |
| `{workspace}/works/items/W-NNN.md` | **One markdown file per work item** — YAML frontmatter + `# title` + body |
| `{workspace}/works/stories/S-NNN.md` | **User story** — Scrum-style narrative + acceptance criteria |
| `{workspace}/works/events.jsonl` | Append-only audit log |

Legacy `.quack/works/` migrates to `works/` on hydrate (`worksDir.ts`). See **`066-works-cycles-stories.md`** for cycles + stories.

Rust: `works_store.rs` — `works_load`, `works_save`, `works_append_event` (index only).

**v1 → v2 migration:** on hydrate, legacy `descriptionBlocks` in snapshot are exported to `items/W-NNN.md`; orphan `.md` files dropped in `items/` are imported into the index.

### Work item `.md` format

```yaml
---
id: <uuid>
shortId: W-001
title: Fix composer work pill
status: in_progress
priority: medium
module: feat:054-works-layer
origin: plan
labels: [hotfix]
linkedChats: [<chatId>]
---
# Fix composer work pill

## Acceptance
- [ ] Same height as agent pill
```

| Field | Notes |
|---|---|
| `module` | `feat:{feature-slug}` from `documentation/features/` |
| Body | Markdown — plans, acceptance checklists (`- [ ]`), notes |
| Comments | Stay in `snapshot.json` index (not in `.md` yet) |

| File | Role |
|---|---|
| `src/workItemMd.ts` | Parse / serialize frontmatter + body |
| `src/worksItemFiles.ts` | Write, hydrate, migrate, import orphans |
| `src/worksWatch.ts` | `fsBus` → reload when agent edits `items/*.md` |

## Tab

| Concern | Detail |
|---|---|
| Key | `works:{wsId}` — one tab per workspace (`worksKey` in `store.ts`) |
| **Default surface** | **Side drawer** (Settings → Views → Works; override to editor tab) |
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
| `cycles` | Cycles | **Cycle dashboard** — progress, burndown, priority items (`066`) |
| `stories` | Stories | Story catalog + `StoryDrawer` |
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

Work and feature drawers portal to `document.body` when Works is an **editor tab**; when Works is in the **side drawer** (`063`), they portal into `EditorTabDrawer`'s nested stack (`065-works-drawer-ux.md`). Mutually exclusive (`openWorkDrawer` closes feature drawer and vice versa). Resizable width: `useResizableWorkDrawerWidth` (default 680px, `workDrawerWidth.ts`).

### Work item — `WorkItemDrawer.tsx`

| Area | Behaviour |
|---|---|
| Hero | `shortId` (or **Draft** in create mode) + module breadcrumb; editable title; icon actions (**work file**, feature doc, Plane sync, close) |
| Properties | Label→value grid: **Module** (select), Status, Priority (select on create), Start, Target, Labels |
| Body | **Notion block editor** (`WorkItemEditor`) — syncs to `bodyMd` via `blocksToMarkdown`; `WorkComments` below (hidden in create mode) |
| Create | Footer **Cancel** / **Create** — persists only on Create (`openWorkCreateDrawer` + `isWorkDrawerCreate`) |
| Style | Single `--bg` surface, fade-up animations, underline tabs, flat comment composer |

Bus: `workDrawer.ts` — `openWorkDrawer`, `openWorkCreateDrawer`, `subscribeWorkDrawer`.

### Feature doc — `FeatureDocDrawer.tsx`

Preview `documentation/features/*.md` from Modules catalog or work drawer. Opens immediately; content loads async.

| Concern | File / detail |
|---|---|
| Preview body | `featureDocPreview.ts` — strip YAML frontmatter + first heading matching title |
| Title hero | `featureDisplayTitle` — drops `NNN —` when badge shows number |
| File meta | `featureFileLabel` — `chat-composer.md` not `022-chat-composer.md` |
| Open in editor | Closes drawer after `openFile` |
| Nested portal | `editorDrawerStack.ts` when parent is side drawer |

Bus: `featureDocDrawer.ts`.

## Composer

| Piece | Role |
|---|---|
| `ComposerWorkBar` | Intent menu (Plan a feature / Hotfix / Blank task); breadcrumb `S › W`; planning chip; **N docs** + **K/N** acceptance chips; inject depth toggle |

See **`068-quack-plan-harness.md`** for the Quack Plan flow (story-owned plan, `StoryPlanPane`).

## Chat linkage

| Mechanism | Detail |
|---|---|
| `AIChatDescriptor.workItemId` | Optional FK to `W-NNN` |
| `AIChatDescriptor.storyId` | Optional FK to `S-NNN` (planning or story-linked) |
| `AIChatDescriptor.planning` | `true` while Jack/CC plan mode active |
| `setAIChatWorkItem` / `setAIChatStory` / `setAIChatPlanning` | Bind chat ↔ work/story |
| `linkedChats` on story/work `.md` | Bidirectional with chat ids (`worksCache.ts`) |
| `worksTurnContext.ts` | Token-efficient manifest: work/story paths, module feature doc, `related:` + `refs:`, outline, acceptance summary |
| `worksBrainRefs.ts` | Resolve `primary` / `story` / `related` / `extra` doc paths |
| Inject depth | `lcp.works.injectDepth.{wsId}` — `pointers` \| `outline` \| `pinky` (composer work menu) |
| `@W-001` / `@S-001` | Mention in composer links chat to work/story |

### Work / story frontmatter `refs:`

```yaml
refs:
  - documentation/decisions/003-git-remote.md
  - documentation/gotchas/foo.md
```

UI: **Documentation** section in work/story drawer; **N docs** chip in composer when linked.

Pinky on linked work: query = ticket title + module (not user message); skips paths already in manifest.

## Agent Hub

`WorkHubBadge` on `AIChatsRail` when `workItemId` and/or `storyId` set — shows `S-003 › W-008` or story-only while `planning`.

## Plane sync (optional)

`worksPlaneSettings.ts` (localStorage per ws) + `planeSync.ts` (REST). UI: `WorksPlanePanel` in Works toolbar + cloud icon in work drawer.

## Progress

`workProgressStore.ts` — acceptance checklist parsed from markdown body (`- [ ]` / `- [x]`); refreshed on `saveWorks` + file watch.

## Feature modules (Brain integration)

Modules sync from `documentation/features/*.md` on hydrate + Works tab open:

| Concern | File |
|---|---|
| Scan + stable ids | `worksFeatureModules.ts` — `feat:{slug}`, title from first `#` / `##` |
| Hydrate | `worksCache.ts` → `syncFeatureModules`, `refreshWorksModules` |
| Fields | `WorkModule.featureSlug`, `featurePath`, `featureNum` |
| Context inject | `workContextInject.ts` + `worksTurnContext.ts` — manifest with feature doc path + outline |

Fallback generic modules (Bug, Feature…) only when features directory is missing.

## Agent workflow

Agents work on **markdown files**, not raw JSON:

1. **List** — read `snapshot.json` for metadata or glob `.quack/works/items/*.md`
2. **Read / Write** — `Read .quack/works/items/W-042.md` (same as feature docs)
3. **Feature context** — read linked `documentation/features/{slug}.md` before coding
4. **Create** — add `items/W-NNN.md` with frontmatter; Quack imports on next hydrate/watch
5. **Link chat** — set `linkedChats` in frontmatter or `@W-001` in composer
6. **Watch** — external edits reload via `worksWatch.ts` (`fsBus`)

## Legacy block editor → drawer body

| File | Role |
|---|---|
| `workBlockEditor.ts` | Slash commands, block merge/split |
| `WorkBlockEditor.tsx` / `WorkItemEditor.tsx` | Notion-style in-drawer description editor |
| `worksBlocks.ts` | `blocksToMarkdown`, `markdownToBlocks` (round-trip for drawer) |
| `WorkComments.tsx` | Activity feed + comment composer (⌘↵ send) |

## Skills (pre-installed)

App-bundled in `src/bundledSkills/` — **two skills only** (`quack-works`, `quack-brain`). Synced to `<workspace>/.claude/skills/` on workspace open and Works hydrate:

| Skill | Role |
|---|---|
| `quack-works` | Feature docs `NNN-slug.md` + Works modules + stories + tickets + cycles (feature-creator merged here) |
| `quack-brain` | Search documentation, diary, Pinky save — after implementation |

**PM loop:** `/quack-works` → implement → `/quack-brain`.

Mirror copies in `documentation/skills/`. Upgrades via `quack-bundled-version`.

## Key files

| Concern | File |
|---|---|
| Types | `src/works.ts` |
| Views | `src/worksViews.ts` |
| Feature modules | `src/worksFeatureModules.ts` |
| Preview strip | `src/featureDocPreview.ts` |
| Cache + CRUD | `src/worksCache.ts` |
| Markdown I/O | `src/workItemMd.ts`, `src/worksItemFiles.ts`, `src/worksWatch.ts`, `src/quackDir.ts` |
| Shell | `src/components/works/WorksPane.tsx` |
| List catalog | `WorksItemsList.tsx`, `worksUi.ts` |
| Drawers | `WorkItemDrawer.tsx`, `FeatureDocDrawer.tsx`, `editorDrawerStack.ts` |
| Kanban / timeline | `WorksKanbanView.tsx`, `WorksTimelineView.tsx`, `TimelineBar.tsx` |
| Composer | `ComposerWorkBar.tsx` |
| Hub badge | `WorkHubBadge.tsx` |
| Plan bridge | `ClaudePermissionOverlay.tsx` (`onPlanApproved`) |
| Surface mode | `surfaceViewPrefs.ts` — drawer default; see `063-surface-view-prefs.md` |
| Drawer UX | `065-works-drawer-ux.md` — list catalog, draft create, nested stack |
| CSS | `App.css` — `.works-*`, `.work-drawer-*`, `.work-comments-*`, `.tool-drawer-scrim--nested` |

## Not yet

- Dedicated `quack_work_*` Rust/CC tool bridge (agents use `.md` files + skill today)
- Custom user-defined saved views (persistence beyond built-in `sidebarView`)
- Keychain storage for Plane token
- Priority edit in work drawer edit mode (display-only today; selectable on create)
