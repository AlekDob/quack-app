---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-16
last_verified: 2026-07-16
tags: [fs-watcher, git-status, performance, composer-git, fsevents, numstat]
---

## Workspace FS watcher + shared git status

**Purpose:** One recursive filesystem watch per open workspace, debounced into
`fs:event`, feeding a **shared** git status (+ `diffStat`) cache so the file
tree, Source Control, status bar, and composer Changes pill stay live without
spawning N× `git status` / `git diff --numstat` per save burst.

**Stack:** Rust `notify` + `notify_debouncer_mini`, Tauri emit, `fsBus`, Zustand consumers via `gitStatusStore`

### Files

| Type | Path | Role |
|---|---|---|
| Rust watcher | `src-tauri/src/watcher.rs` | `fs_watch_start` / `fs_watch_stop`; debounce 200ms; **ignore filter** |
| IPC | `src/ipc.ts` | `git.status`, `git.diffStat` |
| Store | `src/gitStatusStore.ts` | Refcounted watch; one status + one numstat per refresh; subscribe/notify |
| Bus | `src/fsBus.ts` | Fan-out `ws` + per-dir `dir` CustomEvents |
| Composer pill | `src/components/ComposerGitActions.tsx` | Reads `snapshot.diffStat` (no private numstat) |
| Status bar | `src/components/StatusBar.tsx` | Shared store (no 15s poll) |
| Commit dock | `src/components/AgentCommitDock.tsx` | Shared store; force-refresh only every 30s while unpushed |
| Tree / SC | `FileTree.tsx`, `SourceControlPanel.tsx`, `ActivityBar.tsx` | `startGitStatusWatch` + subscribe |

Related product UI: **`053-composer-git-actions.md`** (Changes +N −M pill).

### Data flow

```
disk write
  → notify (RecursiveMode::Recursive on workspace root)
  → debounce 200ms
  → drop paths under ignored segments (.git, node_modules, target, …)
  → emit "fs:event" { ws_id, dirs[] }
  → fsBus
       ├─ "ws" → gitStatusStore (400ms debounce)
       │         → git status --porcelain
       │         → git diff HEAD --numstat  (once, if dirty)
       │         → notify subscribers
       └─ "dir" → FileTree / EditorPane / worksWatch
```

### Ignore filter (`watcher.rs`)

Any path whose components include one of these is **not** emitted (stops
`fseventsd` + git refresh storms during builds, installs, and git object writes):

`.git`, `node_modules`, `target`, `dist`, `build`, `.next`, `.nuxt`, `.turbo`,
`.cache`, `coverage`, `graphify-out`, `__pycache__`, `.venv`, `venv`,
`.pnpm-store`, `Pods`, `.parcel-cache`, `.svelte-kit`

Branch/index updates that only touch `.git/**` no longer auto-refresh status;
saves, composer commit/push (`forceGitStatusRefresh`), and the Agent Commit
dock’s 30s poll while unpushed still update the UI.

### Shared `diffStat` (gotcha)

**Before:** every mounted `ComposerGitActions` (one per sticky live chat host)
subscribed to status and called `git.diffStat(root)` on **every** notify →
N parallel `git diff HEAD --numstat` on huge dirty trees (e.g. Changes
+3883 −724) → WebKit 100%+ CPU / GB RAM + Quack git subprocess CPU.

**After:** `gitStatusStore.fetchNow` loads status then **one** `diffStat` into
`snapshot.diffStat`. Composer (and anyone else) only reads the snapshot.

Idle repos with `files.length === 0` skip numstat entirely.

### Key functions

| Fn | Role |
|---|---|
| `fs_watch_start(ws_id, root)` | Idempotent watch registration |
| `path_ignored` / `ignored_segment` | Filter before emit |
| `startGitStatusWatch(wsId, root)` | Refcounted interest |
| `subscribeGitStatus` / `getGitStatus` | Snapshot + listen |
| `forceGitStatusRefresh(wsId)` | Bypass debounce (after commit/push / Refresh) |
| `loadDiffStat(root, status)` | Shared numstat helper |

### Verify

1. Save a source file → tree git badge + composer Changes update within ~1s; Activity Monitor should **not** spike `fseventsd` from `target/` / `node_modules` writes.
2. With several sticky AI chats open and a large dirty tree, only **one** `git diff --numstat` per refresh (not one per chat host).
3. Composer **Commit & Push** still refreshes counts via `forceGitStatusRefresh`.
4. Status bar branch chip tracks the shared store (no independent 15s poll).

### Related

| Doc | Link |
|---|---|
| Composer Changes pill | `053-composer-git-actions.md` |
| Agent commit dock | `051-agent-commit-dock.md` |
| Explorer git decorations | `034-explorer-tree.md` |
| Works disk sync (same `dir` events, self-write echo guard) | `078-works-disk-sync.md` |
| Diary (CPU storm) | `documentation/diary/2026-07-16.md` |
