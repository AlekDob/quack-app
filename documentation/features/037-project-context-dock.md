---
type: feature
project: quack-desktop
created: 2026-07-05
last_verified: 2026-07-21
tags: [chat, composer, context, workspace, editor, ux]
related: [022-chat-composer.md, 006-chat-tool-render.md, 070-workspace-doc-open.md, 006-chat-file-link-wrong-workspace.md]
---

# 037 — Per-project context dock

**Purpose:** Surface which files are **shared with the model** for the
**currently open project** — active editor attach + `@`-mentioned files
queued for the next message. Lives in the composer status row (right side),
not in the scrollable transcript or as a separate strip above the composer
pill.

## Problem solved

Before this pass:

- Editor attach showed as a lone ON/OFF chip (`ai-context-dock`) directly
  above `.ai-composer-shell`.
- `@`-attached files rendered as a full-width `ai-context-indicator` bar in
  the message area (`Files: foo, bar · clear`).
- `attachContext` and `attachedFiles` were **per `AIChatPanel` React state**
  — switching chats in the same workspace was fine, but the **global**
  `editorState` singleton could point at a file from another project while
  the chat belonged to a different workspace root (cross-project bleed).

## Components & modules

| File | Role |
|---|---|
| `src/components/ContextFilesDock.tsx` | Trigger pill + hover popover (file list, editor ON/OFF, remove `@` files) |
| `src/workspaceChatContext.ts` | Per-`wsId` store: `attachContext` (persisted) + `attachedFiles` (in-memory) |
| `src/pathUtils.ts` | `isUnderRoot`, `resolveUnderRoot` — workspace path guards |
| `src/components/AIChatPanel.tsx` | Wires dock into `.ai-status-dock-row`; send path filters by root |
| `src/App.css` | `.ai-context-dock*`, `.ai-context-popover*`, `.ai-status-dock-row` |

## Layout

```
.ai-status-dock
  └── .ai-status-dock-row          (flex, space-between)
        ├── .ai-inline-status      (left — live turn StatusPill, when active)
        └── .ai-context-dock       (right — ContextFilesDock)
```

The dock row renders when **any** of:

- a turn is in flight (`turnActive`),
- the active editor file resolves under this workspace `root`,
- this workspace has `@`-attached files under `root`.

Turn status and context share one horizontal band so the user sees progress
and context at a glance without scrolling.

## Trigger pill

- Class: `.ai-context-dock-btn` (`--radius-full` pill, matches composer chips).
- Label:
  - `1 file in context` / `N files in context` when at least one file is
    actively attached.
  - `No files in context` when the editor file exists in the workspace but
    attach is OFF and no `@` files are queued.
- Hidden entirely when there is nothing workspace-local to show (no in-root
  editor file and no in-root attached files). **Implementation note:** the
  `return null` guard must run **after** all React hooks (`useLayoutEffect`,
  `useEffect`, etc.) — opening/closing editor tabs toggles `showDock`, and an
  early return before hooks causes `Rendered fewer hooks than expected` and a
  black screen until reload.

## Hover popover

- Portaled to `document.body` (`.ai-context-popover.liquid-glass`), opens
  above the trigger on hover/focus; 120 ms close delay so the cursor can
  move into the panel.
- **Radius:** `--radius-md` on the shell; row controls use `--radius-sm`
  (never use bare `var(--radius)` — that token does not exist).
- Header: `Shared with the model`.
- Rows:
  - **Active editor** — basename + `Active editor` meta; ON/OFF toggle
    (`attachContext`, persisted per workspace).
  - **@-queued files** — basename + workspace-relative path; `×` removes
    from the next message only.
- Clicking a file row calls `openFile(wsId, path)`.
- Empty state copy when attach is OFF and no `@` files: *"No files attached
  — turn the editor ON or @-mention a file."*

## Per-workspace store (`workspaceChatContext.ts`)

| Key | Scope | Persistence |
|---|---|---|
| `attachContext` | per `wsId` | `localStorage` `lcp.chatContext.attach.<wsId>` (default `true`) |
| `attachedFiles` | per `wsId` | in-memory only; cleared after each sent message |

Pub/sub + `useWorkspaceChatContext(wsId)` hook — multiple `AIChatPanel`
instances for the same workspace share one attach toggle and one `@` queue
(intentional: context is project-scoped, not chat-scoped).

`addAttachedFile(wsId, root, path)` normalizes relative paths via
`resolveUnderRoot`; paths outside the workspace are ignored.

## Send-path guards (`AIChatPanel.sendUserText`)

All context injection respects `isUnderRoot(path, root)`:

- **Claude Code** `ccTurnContext` hints (active file, `@` list) — only when
  `attachContext` is ON for the editor file.
- **API / Ollama** `sysParts` editor inline + `/file` attachments — same root
  filter; privacy exclusions unchanged.

**`isUnderRoot` contract (bug `006`, 2026-07-21):** Absolute paths in a
**sibling** workspace must return `false`. Do not `joinPath(root, absPath)` —
the joined string still starts with `root/` and falsely matches. Relative
paths still join under `root`. Shared with chat file-open ownership (`070`).

After a message is sent, `clearAttachedFiles(wsId)` runs (`@` queue is
one-shot). `attachContext` survives across turns.

## Related

- Composer shell + status dock slot: `022-chat-composer.md`
- Live turn `StatusPill` (left side of the same row): `006-chat-tool-render.md`
- `@`-mention file attach: `004-subagent-mentions.md`
- Editor state singleton: `src/editorState.ts` (dock filters by workspace root)
- Chat / doc open ownership: `070-workspace-doc-open.md`
- Incident: `documentation/bugs/006-chat-file-link-wrong-workspace.md`