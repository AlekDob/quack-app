---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-16
last_verified: 2026-07-16
tags: [works, disk-sync, fs-watcher, persistence, echo-suppression, performance]
---

## Works disk sync + FS-watch engine

**Purpose:** Keep the in-memory Works snapshot (stories `S-NNN.md`, items
`W-NNN.md`, slim `snapshot.json`) and the on-disk `works/` tree in sync, in both
directions — Quack edits → disk, and external/agent edits → Quack — without
write-storms, echo loops, or O(N) I/O per change. This is the persistence layer
under the Works UI (`054`); analogous to `043` for chat transcripts.

> **2026-07-17:** `startWorksWatchOnce()` is **not** called at app boot. It runs
> when the Works pane becomes visible or a Work/Story drawer opens — chat and
> editor paths no longer pay for `works/` `dir` refresh fanout.

**Stack:** module-level per-root cache (not Zustand), Tauri `works_*` IPC for the
slim JSON, `fs.readFile`/`writeFile` for the `.md` bodies, `fsBus` `dir` events
from the recursive watcher (`077`).

### Files

| Type | Path | Role |
|---|---|---|
| Cache + orchestration | `src/worksCache.ts` | Per-root snapshot cache, `hydrateWorks`, `refreshWorksFromDisk`, `saveWorks`, `persist`, self-write guard |
| Item disk sync | `src/worksItemFiles.ts` | `writeWorkItemFile`, `hydrateItemFromFile`, `importOrphanMdFiles`, echo-suppression + changed-only write helpers, dir-ensure memo |
| Story disk sync | `src/worksStoryFiles.ts` | `writeStoryFile`, `hydrateStoryFromFile`, `importOrphanStoryFiles`, `reloadStoryFromPath` |
| Watch bridge | `src/worksWatch.ts` | Subscribes `fsBus` `dir`, debounced `refreshWorksFromDisk`, self-write skip |
| Serialize/parse | `src/workItemMd.ts`, `src/storyMd.ts` | Markdown ↔ struct (frontmatter + body) |
| Slim JSON | `slimSnapshot` (in `worksItemFiles.ts`) | Strips `bodyMd` for `works_save`; bodies live only in `.md` |
| FS events | `src/fsBus.ts` | Backend emits **only** `dir` (never `file`); fans out `ws` + `dir` |
| Watcher | `src-tauri/src/watcher.rs` | Recursive watch, 200ms debounce, ignore filter (`077`) |

Product UI on top: **`054-works-layer.md`**, cycles/stories **`066`**, agent
auto-tracking **`074`**.

### Data flow

```
Quack edit (drawer / agent directive / createStory…)
  → saveWorks(root, snap)
      → persist(): beginSelfWrite(root)
          → writeWorkItemFile / writeStoryFile  (ONLY files whose content changed)
          → works_save (slim snapshot.json)
          → endSelfWrite(root) after 500ms cooldown
      → notify() + refreshAllWorkProgress + afterWorksSaved (chat auto-link)

External / agent edit under works/items|stories
  → watcher → fs:event → fsBus "dir"
  → worksWatch: isWorksSelfWriting(root)? → skip (our own echo)
                else scheduleWorksRefresh(root)  (250ms debounce)
  → refreshWorksFromDisk: reload bodies + import orphans + dedupe
      → if changed: persist() (→ self-write window suppresses its echo)
```

### Why the machinery exists (three failure modes it prevents)

| Mechanism | File | Prevents |
|---|---|---|
| **Self-write echo suppression** — `persist()` marks the root `selfWriting` (500ms cooldown > 200ms watcher debounce); `worksWatch` `dir` handler skips refresh while set | `worksCache.ts`, `worksWatch.ts` | Infinite `dir` → refresh → persist → `dir` loop (CPU pegged), esp. when a duplicate/mis-named `S-NNN` file keeps getting re-imported by orphan import while dedupe strips it |
| **Changed-only writes** — `writeWorkItemFile`/`writeStoryFile` skip `fs.writeFile` when serialized content matches our last write (`contentChangedSinceWrite`; `forgetWriteSignature` on delete) | `worksItemFiles.ts`, `worksStoryFiles.ts` | `persist()` rewriting ALL N files on every save → O(N) disk writes + N echo events per edit; a no-op save now writes 0 files |
| **Debounced refresh + memoized dir-ensure** — `refreshWorksFromDisk` collapsed to one trailing run per 250ms; `ensureWorksDirs`/`ensureStoriesDir` run migrate+createDir once per root, not per file | `worksWatch.ts`, `worksItemFiles.ts`, `worksStoryFiles.ts` | Burst of `dir` events each doing a full re-read; ≈2N `createDir`/migrate IPC per persist |

### Gotcha: the FS watcher only emits `dir` events

`watcher.rs` → `fsBus.ts` dispatch **`ws`** and **`dir`** only — never `file`.
So `worksWatch`'s `file` handler (`reloadStoryFromPath`/`reloadWorkItemFromPath`
→ `saveWorks`) is **dead code that never runs**; every live refresh goes through
the `dir` handler → `refreshWorksFromDisk`. The `markWorkWrite`/`isPendingWorkWrite`
path-level guard lives on that dead path and does not protect the real loop — the
`isWorksSelfWriting` root-level guard does. (Both kept as defense if file-level
events are ever wired.)

### Bodies stay in RAM (by design)

The cached snapshot holds `bodyMd` for every story + item. This is **required**,
not an oversight: `workProgressStore` derives acceptance counts and
`worksTurnContext` builds agent context from the bodies. They are small (KB), so
the weight was disk I/O, not memory — hence the changed-only / debounce fixes
rather than body eviction.

### Key functions

| Fn | Role |
|---|---|
| `hydrateWorks(root)` | Load once per root: JSON + all bodies + orphan import + dedupe; guarded by `hydrated`/`hydrating` |
| `refreshWorksFromDisk(root)` | Re-read bodies, import orphans, dedupe; persist only if changed |
| `saveWorks(root, snap)` | Set snapshot + persist + notify + progress + chat auto-link |
| `persist(root, snap)` | `beginSelfWrite` → write changed files + slim JSON → `endSelfWrite` |
| `isWorksSelfWriting` / `beginSelfWrite` / `endSelfWrite` | Root-level echo suppression window |
| `contentChangedSinceWrite(abs, content)` | Signature compare; false ⇒ skip write |
| `scheduleWorksRefresh(root)` | 250ms trailing debounce, re-checks self-write at fire time |

### Verify

1. Edit a ticket body in the drawer → its `W-NNN.md` updates; **no other** works
   files rewrite (watch `works/` mtimes).
2. Trigger an agent that writes several works files → CPU stays flat; one refresh
   per burst, no `dir`→persist→`dir` loop.
3. A workspace containing a duplicate/mis-named `S-NNN` file no longer pegs CPU.
4. External edit to a `W-NNN.md` (outside Quack) is reflected after ~250ms.

### Related

| Doc | Link |
|---|---|
| Works UI / data model | `054-works-layer.md` |
| Cycles & stories | `066-works-cycles-stories.md` |
| Agent auto-tracking | `074-works-auto-tracking.md` |
| FS watcher + git status | `077-fs-watcher-git-status.md` |
| Chat persistence (analogue) | `043-chat-transcript-persistence.md` |
| Diary (loop + I/O fixes) | `documentation/diary/2026-07-16.md` |
| Gotcha (write-storm) | `documentation/gotcha-works-watcher-write-storm.md` |
