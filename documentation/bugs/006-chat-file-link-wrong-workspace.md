---
type: bug-doc
project: quack-desktop
created: 2026-07-21
fixed: 2026-07-21
status: fixed
tags: [agent-mode, chat-links, workspace, path-utils, isUnderRoot]
related:
  - documentation/features/070-workspace-doc-open.md
  - documentation/features/037-project-context-dock.md
  - documentation/features/045-html-preview.md
---

# Bug — Chat file link opens wrong workspace (Agent Mode)

## Symptoms

In Agent Mode, with two (or more) projects open, clicking a file link in the
chat transcript (e.g. bare `firma.html` in an assistant message) opens the
preview / editor drawer but **switches the active project** to another open
workspace — often the first id in `openIds` (e.g. codetta) — instead of
keeping the chat's project (e.g. alekdob).

Composer cwd still showed the correct project; the rail / shell flipped.

## Reproduction

1. Open project A (e.g. codetta) and project B (e.g. alekdob) in Agent Mode.
2. In a B chat, have the agent create/edit a root file (`firma.html`).
3. Click the `firma.html` link in the assistant markdown (or the auto-open
   HTML edit path).
4. **Before fix:** active workspace becomes A; drawer opens under A's shell.
5. **After fix:** stays on B; drawer shows B's file.

## Root cause

Chat file opens go through `openWorkspaceDocPath` →
`resolveWorkspaceDocTarget` → `workspaceForAbs(abs)`.

`workspaceForAbs` walked every open workspace and used `isUnderRoot(abs, root)`.
That helper had a false positive for **absolute paths outside** `root`:

```ts
// path = /…/alekdob/firma.html, root = /…/codetta
joinPath(root, path)
// → "/…/codetta//…/alekdob/firma.html"
// still startsWith(root + "/") → true  ❌
```

So the first open workspace in `openIds` "owned" every absolute path. Then
`activateWorkspace` + `openFileInDrawer` ran on the wrong `wsId`.

Same bug affected `resolveUnderRoot` and `smartFileOpen.findWorkspaceForPath`.

## Fix (2026-07-21)

| Change | Where |
|---|---|
| Absolute paths not already under `root` → `false` / `null` (do not join) | `pathUtils.ts` — `isUnderRoot`, `resolveUnderRoot` |
| Longest matching root wins (nested workspaces) | `workspaceDocOpen.workspaceForAbs`, `smartFileOpen.findWorkspaceForPath` |
| Regression tests (sibling absolute paths, relative join, Windows) | `pathUtils.test.ts` |

## Verify

```bash
npm test -- src/pathUtils.test.ts
```

Manual: two projects open → click chat file link in project B → shell stays on B.

## Related

- Feature `070` — ownership step + gotcha
- Feature `037` — `isUnderRoot` contract for context dock / send guards
- Feature `045` — HTML preview drawer (common click target for `.html` links)
