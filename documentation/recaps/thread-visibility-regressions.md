---
type: recap
project: synara
created: 2026-08-05
last_verified: 2026-08-05
tags: [recap, archive, regressions, upstream, thread-visibility]
---

# Recap: Thread visibility + archive reliability

## Shipped

- Archive: already-archived invariant → success; optimistic `archivedAt`; nav errors isolated
- Shared markers: `THREAD_ALREADY_ARCHIVED_INVARIANT_MARKER` alongside existing not-archived marker
- `@synara/shared/pendingInteractions` + claimable check in `markInteractionResponding`
- Stale session settle guard: non-error snapshots older than the running turn do not complete it
- EventRouter `subscribedThreadIds` identity-stable across streaming `serverThreads` updates

## Decisions / patterns

| Pattern | Why |
| ------- | --- |
| Shared invariant markers in `@synara/shared/errorMessages` | Server wording and client race detection cannot drift |
| Treat “already applied” archive/unarchive invariants as success | Retries after timeout/dropped push are common |
| Lease array shallow-equal before reconcile | Streaming shell must not enqueue no-op subscribe work |
| Port critical upstream fixes selectively | Full `upstream/main` merge still large (fork ahead/behind) |

## Docs

| Kind | Path |
| ---- | ---- |
| Feature | `documentation/features/010-sidebar-thread-archive.md` |
| Feature | `documentation/features/011-thread-detail-subscriptions.md` |
| Feature | `documentation/features/012-pending-interaction-claim.md` |
| Bug | `documentation/bugs/2026-08-05-archive-stuck-spinner.md` |
| Bug | `documentation/bugs/2026-08-05-thread-visibility-regressions.md` |
| Diary | `documentation/diary/2026-08-05.md` |

## Residual risks

- Upstream v0.6.6/v0.6.7 notification, sidechat, terminal fixes still not fully merged
- Right-dock sidechat lease expansion from upstream `425a2d5cc` not ported yet
- Remaining gap vs `upstream/main` should be reviewed before assuming parity

## Follow-ups

- Cherry-pick or merge remaining upstream session/notification commits when conflict budget allows
- Optional: port dock sidechat detail leases if embedded ChatViews still stick on loading
