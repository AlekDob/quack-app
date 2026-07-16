---
type: gotcha
project: quack
created: 2026-07-16
last_verified: 2026-07-16
tags: [works, fs-watcher, cpu, echo-suppression, infinite-loop]
---
# Works FS-watch write-storm: suppress the echo of our own persist()

**Trigger**: 100% CPU / unusable app when a workspace has a populated `works/`
tree (especially one with duplicate or mis-named `S-NNN`/`W-NNN` files); heavy
disk + `fseventsd` activity.

**Key fact that makes this subtle**: the Rust watcher (`watcher.rs`) and the
frontend `fsBus.ts` only ever emit **`dir`** events — never `file` events. So
the `fsBus.addEventListener("file", …)` branch in `worksWatch.ts` (the one that
calls `reloadStoryFromPath` / `reloadWorkItemFromPath`) is **dead code that
never fires**. Every live works refresh goes through the **`dir`** handler →
`refreshWorksFromDisk`.

**The real loop**:
1. Something writes under `works/items` or `works/stories` → `dir` event →
   `worksWatch` → `refreshWorksFromDisk`.
2. `refreshWorksFromDisk` re-reads all files, imports orphans, dedupes, and if
   anything reads as `changed` → calls `persist()`.
3. `persist()` rewrites **every** item + story `.md` (`worksCache.ts`), which
   fires fresh `dir` events → back to step 1.
4. It only terminates if the next refresh finds `changed === false`. With a
   **duplicate / mis-named story file on disk** (filename shortId ≠ internal
   shortId), `importOrphanStoryFiles` keeps re-importing the orphan, dedupe
   keeps removing it from the snapshot but the file stays on disk → `changed`
   is true forever → infinite persist storm.

**Fix** (`src/worksCache.ts`, `src/worksWatch.ts`): echo-suppress the `dir`
events caused by our own writes. `persist()` marks the root as self-writing
(`beginSelfWrite`) for its whole duration plus a 500ms cooldown (covers the
200ms watcher debounce); the `worksWatch` `dir` handler returns early when
`isWorksSelfWriting(root)`. Genuine external edits still refresh — only the echo
of our own persist is dropped.

**Do NOT rely on** the earlier `markWorkWrite`/`isPendingWorkWrite` +
`reloadStoryFromPath` guard for this: those live on the dead `file` path and
never run for the real loop. (They stay as correct defense if file-level events
are ever wired.)

**Rule**: when a component both watches a directory AND writes into it, suppress
the watcher events its own writes produce — at whatever granularity the events
arrive (here dir-level, via a short self-write window). See also
`077-fs-watcher-git-status.md` (the git-diff variant of the same class of bug).
