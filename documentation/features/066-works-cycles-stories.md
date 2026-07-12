---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-12
related: [054-works-layer.md, 065-works-drawer-ux.md, 068-quack-plan-harness.md]
tags: [works, cycles, stories, plane, burndown, scrum]
---

# 066 — Works cycles + stories

**Purpose:** Plane-style **weekly cycles** with progress + burndown charts, and Scrum-style **user stories** (`S-NNN`) that spawn backlog work items (`W-NNN`). Storage lives in git-trackable `works/` at the workspace root (not `.quack/`).

## Storage (v3)

| Path | Role |
|---|---|
| `{workspace}/works/snapshot.json` | Index — `version: 3`, modules, labels, cycles, stories meta, items meta, `nextSeq`, `nextStorySeq` |
| `{workspace}/works/items/W-NNN.md` | Work item body + frontmatter |
| `{workspace}/works/stories/S-NNN.md` | User story body + acceptance criteria |
| `{workspace}/works/events.jsonl` | Audit log |

Legacy `.quack/works/` and `.codetta/works/` auto-migrate to `works/` on first hydrate (`worksDir.ts`).

## Cycles

- **Auto weekly** — ISO weeks (Mon–Sun); last / current / next created on hydrate (`worksCycles.ts` → `ensureWeeklyCycles`).
- **Status** — `active` (this week), `upcoming`, `completed`.
- **Custom cycles** — `createCustomCycle` in `worksCache.ts` (manual only; auto cycles cannot be deleted).
- Work items link via `cycleId` in frontmatter.

### UI — Views sidebar → **Cycles**

`WorksCyclesPanel`: cycle list (active / upcoming / completed) + detail dashboard:

1. **Progress** — segmented bar (done / started / backlog)
2. **Burndown** — SVG line chart (ideal vs remaining), zero npm deps (`WorksCycleCharts.tsx`)
3. **Priority work items** — top items in cycle by priority

Persisted selection: `viewPrefs.activeCycleId`.

## Stories

- Separate entity `WorkStory` — **not** a work item kind.
- File `works/stories/S-NNN.md` with frontmatter: `module`, `cycleId`, `status` (`draft` | `active` | `done`), optional `linkedChats`.
- Body template: User story + Acceptance checklist (`storyMd.ts` → `defaultStoryBody`).
- Child work items: `parentId` on `W-NNN` points to story `id`; module + cycle inherited on **Add work item** from story drawer.
- **Quack Plan** (`068`): new stories created as `draft` via `ensurePlanStory`; CC plan text merges on `ExitPlanMode`; approve → `active`; **Start implementation** spawns `W-NNN`.

### UI — Views sidebar → **Stories**

- `WorksStoriesList` — Brain-style catalog rows
- `StoryDrawer` — create/edit, module + cycle pickers, child work list, **Add work item**
- `WorkItemDrawer` — optional **Story** (parent) and **Cycle** selects

## Key files

| Area | Files |
|---|---|
| Paths + migration | `src/worksDir.ts` |
| Cycles logic | `src/worksCycles.ts` |
| Story I/O | `src/storyMd.ts`, `src/worksStoryFiles.ts` |
| Cache CRUD | `src/worksCache.ts` |
| Drawers | `src/storyDrawer.ts`, `StoryDrawer.tsx`, `WorkItemDrawer.tsx` |
| Main UI | `WorksPane.tsx`, `WorksCyclesPanel.tsx`, `WorksCycleCharts.tsx`, `WorksStoriesList.tsx` |
| Views rail | `worksViews.ts` — `cycles`, `stories` |
| Watcher | `worksWatch.ts` — `items/` + `stories/` |
| Context inject | `worksTurnContext.ts` — `buildStoryTurnContext`, sibling chat summaries |
| Quack Plan | `quackPlanHarness.ts`, `StoryPlanPane.tsx`, `planStoryMerge.ts` — see `068` |

## Agent workflow

0. **Map** — `/quack-works`: create/update `documentation/features/{NNN}-{slug}.md` → module `feat:{slug}`
1. **Story** — `works/stories/S-NNN.md`; `module: feat:{slug}` in frontmatter; or **Plan a feature** in composer (Jack)
2. **Spawn tasks** — `works/items/W-NNN.md` with `parentId` + `module: feat:{slug}` + optional `cycleId`
3. **Cycle** — assign `cycleId`; read progress from snapshot `cycles[]`
4. **Save** — `/quack-brain` for diary + gotchas after implement

Bundled skills: `/quack-works`, `/quack-brain` only (`src/bundledSkills/`).

Plane sync: cycles/stories **not** mapped in v1 (work items only).
