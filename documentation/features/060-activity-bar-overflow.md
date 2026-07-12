---
type: feature-doc
project: quack-desktop
stack: Tauri (React 19 + TypeScript)
created: 2026-07-12
last_verified: 2026-07-12
tags: [activity-bar, overflow, reorder, pointer-events, localStorage, customize, sidebar, tab-launcher]
---

## Activity bar — dynamic overflow, customize, sidebar vs tab
**Purpose:** The view-icons column (Explorer → Organigramma) no longer hardcodes 12+ buttons. Icons render from a persisted order; **how many show on the bar is driven by available vertical space** (workspace list + window height). Overflow opens in a `…` menu. Users reorder via a customize panel (pointer drag). **Sidebar sections** (left panel) and **tab launchers** (editor tabs) are visually distinct — separator + different active affordance. **AI Chat is not on this bar** (right column / shortcuts only).
**Stack:** React 19, TypeScript strict, `localStorage`, pointer events, `ResizeObserver`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Registry | `src/activityBarViews.ts` | `ACTIVITY_BAR_VIEWS`, `barIconSegments`, `ActivityBarIconKind` (`sidebar` \| `tab`) |
| Prefs | `src/activityBarPrefs.ts` | `useActivityBarPrefs`, `moveActivityBarItem`, `computeBarIconLayout` |
| Height | `src/useActivityBarViewHeight.ts` | `useActivityBarViewHeight` — bar height minus workspace block |
| Popover | `src/useActivityBarPopoverPosition.ts` | Viewport-clamped side popover (flip up near bottom) |
| Hook | `src/usePointerListReorder.ts` | Generic pointer drag (WKWebView-safe) |
| Hook | `src/useWorkspaceReorder.ts` | Thin wrapper → `reorderWorkspaces` |
| Component | `src/components/ActivityBarViewIcons.tsx` | List + footer (`…` + customize grip) |
| Component | `src/components/ActivityBarIconButton.tsx` | Single icon; `--sidebar` / `--tab` classes |
| Component | `src/components/ActivityBarMorePopover.tsx` | Overflow menu + kind labels |
| Component | `src/components/ActivityBarCustomizePopover.tsx` | Two-zone reorder panel |
| Component | `src/components/ActivityBar.tsx` | Workspace icons + delegates view-icons |
| Styles | `src/App.css` | `.view-icons-*`, `.activity-icon--sidebar/tab`, `.ab-*` |

### Icon registry (12 icons)
| Kind | IDs | Click behaviour |
|------|-----|-----------------|
| `sidebar` | `files`, `search`, `git`, `tasks`, `todos`, `outline`, `bookmarks`, `remote` | `toggleSidebarSection` — panel left |
| `tab` | `store`, `usage`, `brain`, `whiteboard` | Open `store:` / `usage:` / `brain:` / `wb:` tab |

**Not in registry:** `ai` (removed — chat is the right `AIChatsRail` / composer, not an activity-bar launcher).

Default order: sidebar block first, then tab block (matches pre-refactor `ActivityBar.tsx` minus AI).

### Data flow — how many icons show
```text
useActivityBarViewHeight(barRef, wsListRef, sepRef, openIds.length)
  → availablePx for .view-icons

computeBarIconLayout(availablePx, order.length)
  → reserve 1 slot for customize grip (always)
  → if all icons fit: show all, no …
  → else reserve 1 slot for …, visible = remaining slots

barIds = order.slice(0, visible)   // priority = order index
overflowIds = order.slice(visible)
```

**Prefs** (`localStorage`, global):
- `lcp.activityBar.order` — full ordered id list
- `lcp.activityBar.visibleCount` — split index for customize zones only (On bar / More menu); **does not cap** visible icons on the live bar (height wins)

Slot math: `ACTIVITY_ICON_SLOT_PX = 42` (38px icon + 4px gap).

### Layout (DOM)
```text
.activity-bar
  .ws-list + .activity-sep
  .view-icons (flex:1)
    .view-icons-list     ← icons + kind separators
    .view-icons-footer   ← margin-top:auto
      […]  if overflow
      [grip] customize   ← always visible
```

### Visual grouping — sidebar vs tab
- `barIconSegments(order)` inserts `.view-icons-kind-sep` when `kind` changes in the visible list (works after user reorder).
- **Sidebar** (`.activity-icon--sidebar`): active = **left vertical trace** (VS Code section style).
- **Tab** (`.activity-icon--tab`): slightly muted idle color; active = **bottom-center pip** (not left trace).
- More popover rows show **Sidebar** / **Tab** suffix; separator between kind groups.

### Entry points — customize / overflow
| Action | Result |
|--------|--------|
| Click `…` | Overflow icons + link to customize |
| Click grip (⋮⋮) footer | Customize panel (always available, even when no overflow) |
| Right-click view-icons | Customize (`stopPropagation` — does not flip sidebar) |
| More popover → Customize… | Customize panel |

### Customize panel
- Two zones: **On activity bar** / **More menu** — drag across boundary updates `visibleCount` + order via `moveActivityBarItem`.
- Pointer drag on grip only (no HTML5 DnD — feature `012` gotcha).
- Hint when `maxFit < order.length`: how many fit at current height.
- Popover position: `useActivityBarPopoverPosition` flips upward when anchor is near viewport bottom (fixes clip when `…` sits at the foot of the bar).

### Overflow / chrome states
- `…` gets `.has-active` when any overflow icon is active.
- Git badge on `…` when `git` is in overflow and `gitChangeCount > 0`.
- Legacy `ai` id in stored order is stripped on load (`normalizeActivityBarOrder`).

### Notes / gotchas
- **GOTCHA — measure parent, not content:** Height comes from `activity-bar` minus `ws-list` + sep + padding (`useActivityBarViewHeight`), not from `.view-icons` content height (which would not shrink).
- **GOTCHA — `.view-icons` must flex:** `flex:1; min-height:0` on `.activity-section.view-icons` inside column `.activity-bar` (`min-height:0; align-self:stretch` on bar).
- **GOTCHA — no HTML5 DnD** in WKWebView; customize uses `usePointerListReorder` + `body.ab-dragging`.
- Workspace icon reorder unchanged (`useWorkspaceReorder` / feature `012`).
- Keyboard shortcuts (`Ctrl+Shift+E`, etc.) unchanged — independent of bar position.

### Related
- `012-workspace-reorder.md` — pointer drag for project icons
- `059-quack-brain-store.md` — Store / Brain tab launchers in registry
