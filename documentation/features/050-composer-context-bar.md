---
type: feature
project: quack-desktop
created: 2026-07-10
last_verified: 2026-07-10
---

# 050 — Composer context bar (path + branch)

**Purpose:** Cursor-style workspace path and git branch selectors at the **top inside**
the composer pill — operational context visible while typing, without opening Source
Control or the status bar.

Parent composer doc: **`022-chat-composer.md`**. No **Run on** target in v1.

## Components

| File | Role |
|---|---|
| `src/components/ComposerContextBar.tsx` | Wrapper row: path segment + branch segment |
| `src/components/WorkspacePathPicker.tsx` | Path label + menu (open workspaces, Open folder…) |
| `src/components/GitBranchPicker.tsx` | Shared branch dropdown (`panel` \| `composer` variants) |
| `src/composerCtxMenu.tsx` | Portaled fixed-position menu (escapes `.ai-panel overflow:hidden`) |
| `src/components/AIChatPanel.tsx` | Mounts `<ComposerContextBar wsId root />` inside `.ai-composer-shell` |
| `src/components/SourceControlPanel.tsx` | Uses `GitBranchPicker variant="panel"` (branch UI extracted) |
| `src/pathUtils.ts` | `displayTildePath(path, home)` → `~/…` labels |
| `src/App.css` | `.ai-composer-context-bar`, `.ai-composer-ctx-*` |

## Layout

```
.ai-composer-shell
  .ai-composer-context-bar     ← order -1 (top of pill)
    WorkspacePathPicker
    GitBranchPicker (composer)
  .ai-queue-stack / perm / attach
  .ai-input-row
  .ai-composer-meta
```

Always visible (not gated by `showComposerDock`). Shown in docked chat **and** Agent Mode
compact layout.

## Path segment (`WorkspacePathPicker`)

| UI | Behaviour |
|---|---|
| Label | `displayTildePath(root, homeDir())` e.g. `~/Desktop/Dev/Personal/codetta` |
| Menu rows | Open workspaces (`openIds` → `recent` meta); checkmark on active |
| **Open folder…** | Native folder dialog → `openWorkspace` → **new chat** in that project |
| Switch project | `setActiveWorkspace(id)` → **`addNewAIChat`** with name prompt (anchored on path button) |

## Branch segment (`GitBranchPicker`)

| UI | Behaviour |
|---|---|
| Label | Current branch + optional `↑ahead` / `↓behind` |
| Menu | List branches, checkout, create, delete (same ops as Source Control) |
| Non-repo | Hidden in composer (`return null`); panel variant shows disabled chip |

## Menus — portaled (`ComposerCtxMenu`)

`.ai-panel` uses `overflow: hidden`. Inline absolute menus were clipped — only the
bottom row (“Open folder…”) peeked through.

**Fix:** `createPortal` to `document.body` with `position: fixed` coords from
`clampComposerCtxPos` (prefer opening **below** the anchor; flip above if no room).
Overlay: `.ai-flag-menu-overlay` (same family as `EffortPopover`).

CSS: `.ai-composer-ctx-menu--portaled` + inline `left`/`top`.

**Open folder row:** `.ai-composer-ctx-open .menu-item-label` is `inline-flex` so the
folder icon and label stay on **one line** (SVG is `display: block` by default).

## Shared branch picker extraction

`SourceControlPanel` previously inlined ~80 lines of branch menu logic. Both surfaces
now share `GitBranchPicker`:

- `variant="panel"` — `.git-branch-menu` opens downward (in-panel overlay)
- `variant="composer"` — `ComposerCtxMenu` portal

## Related

| Doc | Link |
|---|---|
| Composer shell / docks | `022-chat-composer.md` |
| Git backend | `git.rs`, `gitStatusStore.ts` |
| New chat + name prompt | `addNewAIChat.ts` (used on project switch) |
| Dev beside production | `047-dev-build-indicator.md` (single-instance release-only) |

## Verify

1. Composer top row shows `~/…` path + branch (when git repo).
2. Path menu: full project list + **Open folder…** on one line; switch project → new chat tab + name prompt.
3. Branch menu: checkout / create / delete; list not clipped.
4. Source Control branch picker unchanged.
5. Agent Mode compact: bar still visible.

## Gotchas

- Menus must stay **portaled** — do not revert to absolute positioning inside `.ai-composer-shell`.
- `WorkspacePathPicker` runs in the **current** chat panel's `wsId`; switching workspace changes global `activeId` and opens a chat in the **target** project (does not retarget the current tab's `aiChatId`).
- Port **5180** must be free for `tauri dev` (unrelated but common when a stray Vite process is left running).
