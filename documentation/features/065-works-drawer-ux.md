---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-17
status: active
tags: [works, drawer, modules, notion-editor, create-flow, nested-stack, markdown, module-picker]
---

# 065 — Works drawer UX (list catalog, draft create, nested stack)

**Purpose:** Polish the Works surface after v4 markdown storage and side-drawer default (`063`): homogenize the work-items list with the Modules catalog, restore in-drawer Notion editing, defer persistence until **Create**, let every ticket pick a module, stack child drawers above the editor tab drawer, and render agent-written markdown in descriptions.

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

### Full-width catalog (2026-07-13)

Catalog panes previously capped at `max-width: 720px`, leaving empty space on wide monitors.

| Class | Change |
|---|---|
| `.works-features-catalog`, `.works-items-catalog` | `width: 100%` (removed `max-width: 720px`) |
| `.works-stories-catalog` | `width: 100%` |
| `.brain-results-section`, `.brain-results` | `width: 100%` |

Applies to **All work items**, **Modules**, and **Stories** list views (`works-main--catalog`). Board and Timeline were already fluid.

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

### Inline markdown preview (2026-07-13)

Agents write normal markdown in `works/items/W-NNN.md` (`**bold**`, `` `paths` ``, links). Structural blocks (lists, `##` headings, fenced code) round-trip via `markdownToBlocks`; **inline** syntax used to show as raw text in `contentEditable`.

| Piece | Role |
|---|---|
| `renderInlineMarkdown` | Exported from `markdown.ts` — same safe subset as chat (`049`) |
| `WorkBlockInlineText.tsx` | View: rendered HTML (`.md-preview`); click → edit source; blur → preview |
| `WorkBlockRow.tsx` | Paragraphs, headings, list items, checklist lines use inline text |
| `WorkBlockEditor.tsx` | Clears `focusIdx` on blur so preview restores |

CSS: `.work-block-rendered` + inherited `.md-preview` code/strong/link styles.

Skill `quack-works` v9 documents body markdown conventions for agents.

## Drawer properties polish (2026-07-13)

| Field | UI |
|---|---|
| **Title** | Larger hero input (`.work-drawer-title`) |
| **Module** | `WorkModulePicker` — searchable portaled popover (420px), colored icon only, **No module** clears `moduleId` |
| **Status** | `WorkStatusPicker` — icon + chip (`WorkDrawerChipPickers.tsx`, `workDrawerMeta.ts`) |
| **Priority** | `WorkPriorityPicker` — icon + chip |
| **Labels** | Hash chips with workspace label colors |
| **Documentation** | `WorksDocRefsSection` — grouped refs, friendly open via `workspaceDocOpen.ts` (`070`) |

Module unlink persists empty `module:` in frontmatter (`worksFeatureModules.ts`, `workItemMd.ts`, `worksItemFiles.ts`).

## Module association

Every work item **may** have `moduleId` (index + frontmatter `module: feat:{slug}`). Empty module is valid.

| Surface | Behaviour |
|---|---|
| Work drawer | **Module** picker (full width) — all `snap.modules`, sorted by feature num; clear → no module |
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

## Overlay z-index (drawer mode gotcha)

Works in the side drawer still uses **portaled** global overlays for right-click menus and confirm dialogs. If their z-index is below the drawer stack, `preventDefault` runs but the UI is invisible behind the panel.

| Layer | Class | z-index | Notes |
|---|---|---:|---|
| Editor tab drawer | `.editor-tab-drawer--overlay` | 900 | Works surface host |
| Tool / work drawers | `.tool-drawer-scrim` | 1000 | Nested stack inside drawer |
| Context menu | `.ctx-overlay` / `.ctx-menu` | 1100 / 1101 | Work + story row menus |
| Confirm / prompt | `.dialog-backdrop` | 1500 | Delete work item, rename prompt, etc. |

Symptoms before fix: right-click “does nothing”; delete confirm appears but content bleeds through / sits under drawer.

## Feature doc drawer (2026-07-17)

`FeatureDocDrawer` preview/edit for `documentation/features/*.md`:

| Mode | Body |
|---|---|
| Preview | Tasks checklist, `MarkdownPreview`, comment composer |
| Edit | Full-height `SimpleMonacoEditor` (`work-feature-body--editing`) |
| Meta | Status + start/end dates always editable; native `type="date"` picker; patches draft while Monaco is open |

See `054-works-layer.md` for frontmatter fields and `083` for composer link.

## Related

- Works storage & views: `054-works-layer.md`
- Tab vs drawer default: `063-surface-view-prefs.md`
- Composer link existing work/story: `068-quack-plan-harness.md`
- Safe doc open from refs: `070-workspace-doc-open.md`
- Inline markdown API: `049-markdown-renderer.md`
- Skill: `documentation/skills/quack-works/SKILL.md`
