---
type: bug
project: synara
created: 2026-08-05
last_verified: 2026-08-05
status: fixed
tags: [archive, sidebar, toast, race]
---

## Archive stuck spinner / “Could not archive thread”

### Symptom

- Archive click leaves the row in the sidebar with a spinner
- Toast: “Could not archive thread”
- Restart may hide the thread (server already archived)

### Root causes

| # | Cause |
| - | ----- |
| 1 | Client treated already-archived invariant as hard failure |
| 2 | No optimistic local `archivedAt` when shell push dropped/late |
| 3 | Post-archive navigation errors bubbled as archive failure |

### Fix

- Shared `THREAD_ALREADY_ARCHIVED_INVARIANT_MARKER` + `isThreadAlreadyArchivedError`
- `markThreadArchivedInClientState` after accepted/already-archived
- Navigation wrapped separately from archive acceptance

### Docs

- Feature: `documentation/features/010-sidebar-thread-archive.md`
- Diary: `documentation/diary/2026-08-05.md`
