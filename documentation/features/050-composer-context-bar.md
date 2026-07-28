---
type: feature
project: quack-desktop
created: 2026-07-10
last_verified: 2026-07-27
---

# 050 — Composer context bar (path + branch)

**Purpose:** Cursor-style workspace **project** and git **branch** selectors at the
**top inside** the composer pill — operational context visible while typing, without
opening Source Control or the status bar. The project chip is the primary way to
**start a new chat in another project** (default = current workspace).

Parent composer doc: **`022-chat-composer.md`**. Session ownership: **`001-ai-session-library.md`**
(chats live under `wsId`, not on `ChatSession`). No **Run on** target in v1.

## User story (2026-07-22)

When Alek hits **New chat** (hub) or the composer project chip:

1. Popover lists **Recents** (MRU) — scrollable.
2. **Open folder…** stays **fixed at the bottom** of the menu (does not scroll away).
3. Pick a project → Quack switches/opens that workspace and **creates a new chat there**.
4. Hub **New chat** always creates (including current project). Composer chip picking the *current* project is still a no-op (already in that session).

Out of scope (keep light): Cloud / No Repo / environment “This Mac” / New Folder.

## Components

| File | Role |
|---|---|
| `src/components/ComposerContextBar.tsx` | Wrapper row: path segment + branch segment |
| `src/components/WorkspacePathPicker.tsx` | Project-name chip + shared project menu |
| `src/components/WorkspaceProjectMenu.tsx` | Shared Recents body + fixed Open folder…; `createChatInProject` |
| `src/components/AIChatsRail.tsx` | Hub **New chat** opens the same project menu |
| `src/components/GitBranchPicker.tsx` | Shared branch dropdown (`panel` \| `composer` variants) |
| `src/composerCtxMenu.tsx` | Portaled fixed-position menu (escapes `.ai-panel overflow:hidden`) |
| `src/components/AIChatPanel.tsx` | Mounts `<ComposerContextBar wsId root />` inside `.ai-composer-shell` |
| `src/components/SourceControlPanel.tsx` | Uses `GitBranchPicker variant="panel"` (branch UI extracted) |
| `src/pathUtils.ts` | `displayTildePath(path, home)` → `~/…` labels; `basename` for chip fallback |
| `src/addNewAIChat.ts` | `addNewAIChat` + `anchorFromElement` on project switch |
| `src/store.ts` | `recent`, `openIds`, `openWorkspace`, `setActiveWorkspace` |
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

### Chip (trigger)

| UI | Source |
|---|---|
| Label | `WorkspaceMeta.name` for `wsId`, else `basename(root)` |
| Tooltip | `displayTildePath(root, homeDir())` — full `~/…` path |
| Caret | `chevron-down` — opens portaled menu |

### Menu

| Section | Content |
|---|---|
| **Recents** | `useStore().recent.slice(0, 10)` — MRU from `workspaces.json`, **not** filtered to open-only |
| Row | Folder icon + ellipsized `~/…` path; `title` = absolute `root` |
| Active row | `.active` + check icon (current panel `wsId`) |
| separator | |
| **Open folder…** | Tauri `open({ directory: true })` — Cursor “Use Existing…” equivalent |

### Pick behaviour

```
pick(id, root):
  if id === wsId → close menu (no-op)
  if id ∈ openIds → setActiveWorkspace(id) → addNewAIChat(id)
  else → openWorkspace(root) → addNewAIChat(activeId)

pickFolder():
  dialog → openWorkspace(sel) → addNewAIChat(activeId)
```

`addNewAIChat` is always called with `location: "editor"` and anchor from the path chip
(`anchorFromElement(btnRef)`) so the name-prompt positions correctly.

### Why always a new chat (not rebind)

`ChatSession` has **no** `workspaceId` field. Transcripts persist under
`~/Library/Application Support/codetta/chats/{wsId}/`. Retargeting an existing
`aiChatId` to another project would orphan or corrupt disk paths — see **`001`** /
**`043`**. Composer project switch intentionally mirrors Cursor: new session in the
target project.

### Data sources

| Store field | Role |
|---|---|
| `recent` | Durable MRU (`workspaces.json` via `workspaces_load`) |
| `openIds` | Currently mounted projects (activity bar) |
| `activeId` | Global foreground workspace after switch/open |

### Before → after (2026-07-22)

| Before | After |
|---|---|
| Chip showed full `~/Desktop/…/codetta` path | Chip shows **codetta** (project name) |
| Menu listed **open** workspaces only | **Recents** MRU (open + closed), cap 10 |
| No section title | “Recents” section header |
| Check via `.active` on row | Explicit check icon on current project |

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

**Recents paths:** `.ai-composer-ctx-path` ellipsizes long `~/…` rows; checkmark uses
`.ai-composer-ctx-check` (no accel truncation). Menu `max-width` bumped to 420px /
`max-height` 320px for longer paths.

## Shared branch picker extraction

`SourceControlPanel` previously inlined ~80 lines of branch menu logic. Both surfaces
now share `GitBranchPicker`:

- `variant="panel"` — `.git-branch-menu` opens downward (in-panel overlay)
- `variant="composer"` — `ComposerCtxMenu` portal

## Related surfaces (do not duplicate)

| Surface | Difference |
|---|---|
| ActivityBar `+` | Open Folder + **recent not open** + remove-from-recent; does **not** auto new-chat |
| `WorkspacePicker` | First-run welcome; full clone/palette — not in-composer |
| Agent Mode rail `+` | Same as ActivityBar `+` |
| Command palette | Text “Open recent: …” rows |

Composer path picker is the **only** surface that combines project pick + **new chat**.

## Related docs

| Doc | Link |
|---|---|
| Composer shell / docks | `022-chat-composer.md` |
| New chat perf (empty seed) | `087-new-chat-perf.md` |
| Session / workspace model | `001-ai-session-library.md` |
| Git backend | `git.rs`, `gitStatusStore.ts` |
| New chat + name prompt | `addNewAIChat.ts` |
| Project switch perf | `058-workspace-switch-performance.md` |

## Verify

1. **New chat** in project A → chip shows A’s name; tooltip = full path.
2. Open menu → **Recents** lists last folders (including closed); checkmark on A.
3. Pick open project B → switches to B + **new** chat tab + name prompt.
4. Pick closed recent C → opens C + new chat (cold hydrate per `058`).
5. **Open folder…** → dialog → open + new chat.
6. Branch menu unchanged; not clipped.
7. Agent Mode compact: bar still visible.

## Gotchas

- Menus must stay **portaled** — do not revert to absolute positioning inside `.ai-composer-shell`.
- `WorkspacePathPicker` runs in the **current** chat panel's `wsId`; switching workspace changes global `activeId` and opens a chat in the **target** project (does not retarget the current tab's `aiChatId`).
- Picking the **same** project closes the menu only — does not spawn a duplicate chat (use **New chat** for that).
- Port **5180** must be free for `tauri dev` (unrelated but common when a stray Vite process is left running).
