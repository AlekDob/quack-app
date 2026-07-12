---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-12
tags: [works, drawer, modules, notion-editor, create-flow, nested-stack]
---

# 065 — Works drawer UX (list catalog, draft create, nested stack)

**Purpose:** Polish the Works surface after v4 markdown storage and side-drawer default (`063`): homogenize the work-items list with the Modules catalog, restore in-drawer Notion editing, defer persistence until **Create**, let every ticket pick a module, and stack child drawers (feature preview, work detail) above the editor tab drawer.

## Work list — same UI as Modules

| Before | After |
|---|---|
| Table columns (Work / Module / State / Priority) | Brain **catalog** rows (`.brain-hit-row`) |

| Piece | File |
|---|---|
| List host | `WorksItemsList.tsx` — search bar, count head, animated rows |
| Shared labels | `worksUi.ts` — `formatModuleLabel`, `formatWorkHitTitle`, `sortWorkModules` |
| Shell wiring | `WorksPane.tsx` — list layout uses `works-main--catalog` padding |

Each row shows: `W-NNN · title`, status pill, priority dot, module path on hover, chevron. Context menu unchanged (`useWorkItemContextMenu`).

## Draft create flow

**Before:** Add work item → ticket persisted immediately → drawer opens on empty `W-NNN`.

**After:**

1. **Add work item** → `openWorkCreateDrawer({ draft: { title: "New work", origin: "manual" } })`
2. Drawer in **Draft** mode — hero shows `Draft`, no `shortId` yet
3. User fills title, module, status, dates, labels, description
4. **Create** → `createWorkItem` + optional `updateWorkItem` patch → transitions to edit drawer
5. **Cancel** / close / scrim → nothing written to disk

| Piece | Detail |
|---|---|
| Bus | `workDrawer.ts` — discriminated union: `{ workId }` edit vs `{ create: true, draft? }` |
| Helpers | `openWorkCreateDrawer`, `isWorkDrawerCreate` |
| Footer | `.work-drawer-footer` — Cancel + Create (primary) |

## Description — Notion block editor (not read-only)

Drawer body uses `WorkItemEditor` → `WorkBlockEditor` (slash menu, headings, lists, checklists, code).

| Direction | Function |
|---|---|
| Blocks → disk | `blocksToMarkdown` on change → `updateWorkItem({ bodyMd })` → `worksItemFiles.writeWorkItemFile` |
| Disk → blocks | `markdownToBlocks` on hydrate (`worksBlocks.ts`) |

`blocksDirty` ref prevents external watch reload from clobbering mid-edit state.

## Module association

Every work item has `moduleId` (index + frontmatter `module: feat:{slug}`).

| Surface | Behaviour |
|---|---|
| Work drawer | **Module** select (full width) — all `snap.modules`, sorted by feature num |
| Create | `createWorkItem({ moduleId })` when set; else legacy name inference |
| List row | Subtitle: `NNN · name — documentation/features/…` on hover |

## Nested drawer stack (Works in side drawer)

When Works lives in `EditorTabDrawer` (`z-index: 900`), child drawers must portal **inside** the parent, not only to `document.body` at `z-index: 1000` (broken stacking / invisible child).

```
EditorTabDrawer (fixed, z-index 900)
├── editor-tab-drawer-body  ← WorksPane
└── editor-drawer-nested-stack  ← portal target
    └── FeatureDocDrawer / WorkItemDrawer (.tool-drawer-scrim--nested)
```

| File | Role |
|---|---|
| `editorDrawerStack.ts` | `registerEditorDrawerStack`, `drawerPortalTarget(wsId)`, `subscribeDrawerPortal` |
| `EditorTabDrawer.tsx` | Renders stack div; registers on ref when `shown` |
| `FeatureDocDrawer.tsx`, `WorkItemDrawer.tsx` | Portal to stack when parent drawer open, else `document.body` |
| CSS | `.tool-drawer-scrim--nested` — `position: absolute; inset: 0` inside parent |

Feature doc drawer opens immediately (shell visible) while markdown loads.

Mutual exclusion unchanged: `openWorkDrawer` closes feature drawer; `openFeatureDocDrawer` closes work drawer.

## Related

- Works storage & views: `054-works-layer.md`
- Tab vs drawer default: `063-surface-view-prefs.md`
- Skill: `documentation/skills/quack-works/SKILL.md`
