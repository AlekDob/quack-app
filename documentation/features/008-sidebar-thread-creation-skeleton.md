---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-05
startDate: 2026-08-05
endDate:
last_verified: 2026-08-05
status: active
tags: [sidebar, threads, drafts, loading, codex, skeleton]
---

## Sidebar thread creation placeholder

**Purpose:** Keep a newly opened conversation visible in the sidebar while its local draft is waiting for the provider and orchestration layer to create the durable server-side thread.
**Stack:** React / TypeScript (`apps/web`)

### Problem

New conversations are intentionally staged as local composer drafts before the provider acknowledges `thread.create`. The sidebar is primarily built from persisted `SidebarThreadSummary` rows, so this short asynchronous gap was previously rendered as if the conversation had not been created. Codex startup and session setup make the gap particularly noticeable.

### Files

| Type      | Path                                      | Exports/Purpose                                                       |
| --------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Component | `apps/web/src/components/Sidebar.tsx`     | Detects the active unpersisted draft and renders the loading row      |
| Logic     | `apps/web/src/components/Sidebar.logic.ts` | `resolvePendingSidebarThreadPlaceholder` — when the row may show      |
| Store     | `apps/web/src/pendingSendStore.ts`        | Signals that a send was submitted and creation is in flight          |
| Component | `apps/web/src/components/ui/skeleton.tsx` | Shared shimmer primitive used by the placeholder                      |
| Store     | `apps/web/src/composerDraftStore.ts`      | Source of `draftThreadsByThreadId` for fresh local conversations      |
| Store     | `apps/web/src/store.ts`                   | Expands the destination project so the placeholder is visible         |
| Logic     | `apps/web/src/storeProjection.ts`         | Produces the persisted sidebar summaries that replace the placeholder |

### Data flow

`useHandleNewThread` registers a draft → the active route identifies the draft thread → `Sidebar` checks that no server summary exists yet → `PendingSidebarThreadSkeleton` renders in the project (or Chats) section → the server summary arrives → the normal thread row replaces the skeleton.

### Behavior

- The placeholder is shown only while a creation is really in flight: the send was submitted (`pendingSendStore`) or `thread.create` already went out (`promotedTo`) and only the server summary is missing. An open draft the user has not sent yet renders nothing — otherwise an empty shimmer row hangs under the project for as long as the draft stays open.
- It is scoped to the active route's draft; stale drafts in local storage do not create phantom loading rows across the sidebar.
- It uses the shared `Skeleton` primitive and the existing sidebar row geometry, so it does not shift neighboring rows when the real thread arrives.
- The destination project is expanded automatically while the draft is pending, including when creation started from a collapsed project.
- Home Chats receives the same treatment as project-nested conversations.
- Once `sidebarThreadSummaryById` contains the thread, the placeholder disappears without a timer or polling loop.
- The row exposes `role="status"`, `aria-live="polite"`, and an accessible creation label while remaining non-interactive.

### Verification

- `bun run test -- src/components/Sidebar.logic.test.ts` from `apps/web`
- Result: 1 file passed, 108 tests passed.
