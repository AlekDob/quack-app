---
name: quack-works
description: Quack PM + Works — document product components (documentation/features/NNN-slug.md), sync Works modules, user stories S-NNN, tickets W-NNN, cycles, kanban. Use whenever the user mentions tickets, work items, stories, sprints, cycles, feature docs, feature-doc, modules, plan approval, W-NNN, S-NNN, or project task tracking in Quack — even if they don't say "Works".
quack-bundled-version: 11
---

# Quack Works

One skill for **feature mapping** + **ticket management** in Quack desktop. Every feature doc is a Works module; stories and work items hang off that module.

Pair with `/quack-brain` only for search/save after implementation (Pinky, diary, gotchas).

## When to use

- Document or update a product component → feature doc + module
- Create/update stories, tickets, cycles, session links
- Kanban, backlog, plan mode, Plane sync
- User says feature-doc, ticket, story, sprint, module, W-001, S-003

## PM loop

```
/quack-works  →  map feature doc + module + story/tickets
implement      →  code; bump last_verified on feature doc
/quack-brain   →  search context, diary, Pinky save
```

---

## Part A — Feature docs (= Works modules)

### Component vs change

| Work | Where | Not a feature doc |
|---|---|---|
| New/changed **component** (sidebar, auth, Works…) | `documentation/features/{NNN}-{slug}.md` | — |
| UX tweak, bugfix narrative | `documentation/diary/` | diary |
| Tradeoff / rationale | `documentation/decisions/` | decision |
| Incident | `documentation/bugs/` | bug record |

Name after the **component** (`command-palette`), never the change (`fix-sidebar-order`).

**Update in place** when the component exists. New `{NNN}-` file only for a genuinely new part.

### File naming (mandatory)

```
documentation/features/{NNN}-{slug}.md
```

1. List `documentation/features/`, find highest `^\d{3}-`
2. Next number = highest + 1, zero-padded
3. Rename unnumbered legacy files before creating new ones

| File | Module id |
|---|---|
| `054-works-layer.md` | `feat:054-works-layer` |
| `067-auth-flow.md` | `feat:067-auth-flow` |

Title from first `#` H1. Sync: `syncFeatureModules` on Works hydrate / tab open (`worksFeatureModules.ts`). **Do not** hand-edit `snapshot.json` modules.

### Feature doc template

Tables/lists only in the doc body. Omit empty sections.

```markdown
---
type: feature-doc
project: [name]
stack: [e.g. Tauri + React]
created: YYYY-MM-DD
last_verified: YYYY-MM-DD
tags: [slug, area]
---

## [Component Name]
**Purpose:** [1 sentence]
**Stack:** [stack]

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|

### Data Flow
[Source] → [Handler] → [Destination]

### Key Functions
- `fn(p: T) → R` — purpose

### State
- `name`: Type — purpose (scope)
```

File types: Route/Page, Component, Service, Model/Type, Store/State, Repository/API, Config, Test, Util.

After save → module appears on next hydrate. Then create/link stories and tickets (Part B).

---

## Part B — Works storage

| Path | Role |
|---|---|
| `works/snapshot.json` | Index v3 — modules, cycles, stories meta, items meta |
| `works/items/W-NNN.md` | Work item body + frontmatter |
| `works/stories/S-NNN.md` | User story + acceptance checklist |
| `works/events.jsonl` | Audit log |

Legacy `.quack/works/` / `.codetta/works/` → `works/` on first open.

### Relationships

- **Module** — `module: feat:{NNN}-{slug}` in story/work frontmatter
- **Story → items** — `parentId: <story-uuid>` on work items
- **Cycle** — `cycleId` on stories/items; auto ISO weeks (`worksCycles.ts`)

### Example work item

```yaml
---
shortId: W-042
title: Add story grouping
status: in_progress
priority: high
module: feat:066-works-cycles-stories
parentId: <story-uuid>
cycleId: <cycle-uuid>
linkedChats: [<chat-uuid>]
refs:
  - documentation/decisions/001-agent-status.md
  - documentation/gotchas/context-breakdown-estimates.md
---
```

Body (after frontmatter): normal markdown — `##` headings, `-` lists, `- [ ]` acceptance checklists, fenced code. Use `**bold**`, `` `paths` ``, and `[label](url)` for inline emphasis; Quack renders these in the drawer. Keep feature-doc bodies in `refs:` only (paths), not pasted into the ticket body.

### Brain documentation refs

| Source | Role | Auto? |
|---|---|---|
| `module` → `documentation/features/{NNN}-{slug}.md` | `primary` | yes |
| `parentId` story file | `story` | yes |
| Feature doc YAML `related:` | `related` | yes (on inject) |
| Frontmatter `refs:` on work/story | `extra` | manual |

**Do not** paste feature doc bodies into ticket bodies — paths only. Quack injects a **manifest** (paths + feature outline + acceptance summary) on each linked-chat turn (`worksTurnContext.ts`).

Inject depth (composer work menu): `pointers` | `outline` (default) | `pinky` (scoped search, deduped vs manifest).

### Quack Plan harness (Jack)

Product-owned plan mode — **story is the artifact**, not ephemeral CC plan text.

**Do not** create a story at chat start. Stories open only when the user clicks **Plan a feature** or you and the user explicitly agree it's planning time (multi-step scope, unclear path). Quick Q&A and hotfixes need no story.

| Step | What |
|---|---|
| Enter Plan / Plan a feature | `ensurePlanStory` → `S-NNN` draft, `storyId` on chat, `StoryPlanPane` opens right |
| Clarifying choices | **Orchestrator chat** on Claude Code: call `AskUserQuestion` — Quack renders clickable options above the composer (`073`). **Subagents** (`Task`/`Agent` sidechains) cannot — they return the question in their report; orchestrator asks via `AskUserQuestion`. |
| CC ExitPlanMode | `mergePlanIntoStory` — body + acceptance checklist (into linked story, or legacy `plan:` tab if none) |
| Approve | `approvePlanStory` → status `active` |
| Implement | `createWorkFromStory` → link `W-NNN`, composer shows `S › W` |

Other providers (Cursor CLI, OpenCode, API): same story panel; Jack updates `works/stories/S-NNN.md` via Write — no `ExitPlanMode` or `AskUserQuestion`.

Files: `quackPlanHarness.ts`, `planStoryMerge.ts`, `StoryPlanPane.tsx`, `storyPlanTab.ts`.

### Example story

```yaml
---
shortId: S-003
title: As a PM I group work under stories
status: active
module: feat:066-works-cycles-stories
cycleId: <cycle-uuid>
---
```

---

## Part C — Agent workflow

1. **Map** — create or update `documentation/features/{NNN}-{slug}.md` (Part A)
2. **Find** — glob `works/items/*.md`, `works/stories/*.md`, or read `snapshot.json`
3. **Story** — `works/stories/S-NNN.md` only when scope needs user-facing acceptance criteria **and** planning is explicit (not on first message)
4. **Tickets** — `works/items/W-NNN.md` with `module`, optional `parentId`, `cycleId`
5. **Read** — feature doc + linked work/story `.md` before editing code
6. **Implement** — update code; work `status` todo → in_progress → done; bump `last_verified` on feature doc
8. **Link session** — `linkedChats` on story/work; `@S-001` / `@W-001`; manifest inject. Quack **auto-links** new **work items** (not draft stories) to the active/working chat when `linkedChats` is omitted (`worksChatAutoLink.ts`).
9. **Quack Plan** (Jack PM) — user **Plan a feature** or agreed planning moment → `enterPlanning` → `S-NNN` draft + story drawer; CC `ExitPlanMode` merges into story; approve → `active`; **Start implementation** → `W-NNN` with `parentId`

Bodies live in `.md` files only — not in `snapshot.json`.

---

## Cycles & Plane

- **Cycles** — active / upcoming / completed; burndown in Works → Cycles view
- **Plane** (optional) — work items only; cycles/stories not synced v1

## UI

Activity bar **check-square** → Works. Views: status filters, Cycles, Stories, Modules. Layouts: List (story groups) / Board / Timeline. Drawers: `WorkItemDrawer`, `StoryDrawer`, `FeatureDocDrawer`.

## App source map

| Area | File |
|---|---|
| Modules sync | `src/worksFeatureModules.ts` |
| Types / cache | `src/works.ts`, `src/worksCache.ts` |
| Paths | `src/worksDir.ts` |
| Cycles | `src/worksCycles.ts` |
| Story / work I/O | `src/storyMd.ts`, `src/workItemMd.ts` |
| List groups | `src/worksListGroups.ts` |
| Brain refs / inject | `src/worksBrainRefs.ts`, `src/worksTurnContext.ts`, `src/featureDocOutline.ts` |
| Quack Plan harness | `src/quackPlanHarness.ts`, `src/components/StoryPlanPane.tsx` |

## Related

- `/quack-brain` — Pinky search, diary, decisions, save gotchas (after implementation)
