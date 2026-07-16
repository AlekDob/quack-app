---
type: gotcha
project: quack
created: 2026-07-16
last_verified: 2026-07-16
tags: [works, fs-watcher, cpu, echo-suppression, infinite-loop]
---
# Works FS-watch write-storm: every reload path must honor echo-suppression

**Trigger**: 100% CPU / unusable app when a workspace has a populated `works/` tree; heavy disk + `fseventsd` activity.

**Loop**: FS watcher (`worksWatch.ts`) sees a `.md` change under `works/stories/` → `reloadStoryFromPath` → `saveWorks` (persists UNCONDITIONALLY — no `changed` guard) → `persist()` rewrites ALL story+item `.md` files → each rewrite fires a watcher event → each event re-enters the reload path → N² write storm.

**Root cause**: asymmetric echo-suppression. `writeWorkItemFile` AND `writeStoryFile` both call `markWorkWrite(abs)` (adds path to `pendingWrites`), but only `reloadWorkItemFromPath` checked `isPendingWorkWrite`. `reloadStoryFromPath` never consulted the guard, so story self-writes were treated as external edits.

**Fix** (`src/worksStoryFiles.ts`, `src/worksItemFiles.ts`):
1. `reloadStoryFromPath` returns `null` early when `isPendingWorkWrite(absPath)` — mirrors the item path.
2. `markWorkWrite` TTL 600ms → 2000ms: `persist()` rewrites files in bulk and the watcher debounces 200ms, so early marks expired before their echoed events arrived.

**Rule**: any FS-watch reload handler that can write back to disk MUST honor the same self-write echo-suppression as its siblings. One unguarded sibling reopens the whole storm. See also `077-fs-watcher-git-status.md` (the git-diff variant of the same class of bug).
