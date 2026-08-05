---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-05
startDate: 2026-08-05
endDate:
last_verified: 2026-08-05
status: active
tags: [sidebar, threads, archive, optimistic-ui, invariants]
---

## Sidebar thread archive

**Purpose:** Hide a conversation from the live sidebar after `thread.archive`, including races where the server already archived but the client never applied the shell push.
**Stack:** React / TypeScript (`apps/web` + shared invariant markers)

### Files

| Type    | Path                                                 | Exports/Purpose                                                               |
| ------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| Service | `apps/web/src/hooks/useSidebarThreadActions.ts`      | Archive/undo UI; optimistic `archivedAt`; navigation isolated from archive OK |
| Util    | `apps/web/src/lib/threadArchive.ts`                  | `archiveThreadFromClient`, `isThreadAlreadyArchivedError`                     |
| Util    | `packages/shared/src/errorMessages.ts`               | `THREAD_ALREADY_ARCHIVED_INVARIANT_MARKER`                                    |
| Service | `apps/server/src/orchestration/commandInvariants.ts` | `requireThreadNotArchived` embeds the shared marker                           |
| Test    | `apps/web/src/hooks/useSidebarThreadActions.test.ts` | Already-archived race + nav failure after archive                             |
| Test    | `apps/web/src/lib/threadArchive.test.ts`             | Marker-scoped already-archived detection                                      |

### Data Flow

Sidebar archive click → `archiveThreadFromClient` (`thread.archive`) → success **or** `isThreadAlreadyArchivedError` → `markThreadArchivedInClientState` → optional route fallback (errors logged, not toasted as archive failure)

### Key Functions

- `markThreadArchivedInClientState(threadId) → void` — set local `archivedAt` when server accepted or already archived
- `archiveThreadIgnoringAlreadyArchived(threadId) → Promise<void>` — treat already-archived invariant as success
- `isThreadAlreadyArchivedError(error, threadId) → boolean` — match `thread.archive` + shared marker + thread id
- `requireThreadNotArchived(...) → Effect` — server invariant using `THREAD_ALREADY_ARCHIVED_INVARIANT_MARKER`

### State

- `archivedAt`: `string \| null` — client thread row; non-null hides from live sidebar (global store)
- `archivePendingThreadIdsRef`: `Set<ThreadId>` — in-flight archive dedupe (hook)

### Behavior

- Already-archived server race is success (same pattern as already-unarchived for Undo)
- Post-archive navigation failure must not surface “Could not archive thread”
- Optimistic local `archivedAt` covers dropped/late `thread.archived` shell pushes
