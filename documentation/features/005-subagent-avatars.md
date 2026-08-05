---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-04
startDate: 2026-08-04
endDate:
last_verified: 2026-08-05
status: active
tags: [subagents, avatars, composer, workflow, transcript, duck, sticky-scroll]
---

## Subagent Avatars

**Purpose:** Deterministic duck avatar per subagent (same name → same duck, ported from Codetta), shown wherever a running/finished subagent is listed, without extra state or per-render cost.
**Stack:** React / TypeScript (apps/web)

### Files

| Type      | Path                                                     | Exports/Purpose                                                                                                                                                                                              |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Util      | `apps/web/src/lib/duckAvatars.ts`                        | `duckAvatarFor(name, explicit?) → string` — hash(name) % 35 → `/images/ducks/duckN.jpeg`                                                                                                                     |
| Component | `apps/web/src/components/chat/SubagentAvatar.tsx`        | `SubagentAvatar({ seed, className })` — thin `<img>` wrapper around `duckAvatarFor`                                                                                                                          |
| Component | `apps/web/src/components/chat/ComposerActivityStrip.tsx` | Renders `SubagentAvatar` next to the status dot on each running-subagent row above the composer (renamed from `ComposerSubagentStrip`, see [015-composer-activity-strip.md](015-composer-activity-strip.md)) |
| Component | `apps/web/src/components/chat/WorkflowRunCard.tsx`       | `WorkflowAgentRowView` renders `SubagentAvatar` next to the status dot on each dynamic-workflow agent row                                                                                                    |
| Component | `apps/web/src/components/chat/TimelineWorkEntryRow.tsx`  | `subagentAvatarSeed()` swaps the generic bot icon for `SubagentAvatar` on `collab_agent_tool_call` transcript rows                                                                                           |
| Util      | `apps/web/src/lib/subagentPresentation.ts`               | `resolveSubagentPresentation()` — supplies `avatarSeed`, the single seed for the duck and the accent color                                                                                                   |
| Component | `apps/web/src/components/chat/ChatStreamIdentity.tsx`    | `ChatStreamAvatarSlot` / `ChatStreamMetaRow` — a subagent thread's own transcript wears its duck + label; slot is `self-stretch` + sticky-tracks the viewport for the turn's duration (shared with papero, [003-paperi.md](003-paperi.md)) |
| Util      | `apps/web/src/lib/pdf/useContainerSize.ts`               | Reused (not PDF-specific) to measure the slot's rendered turn height for the sticky threshold                                                                                                                |

### Assets

| Path                                         | Role                                      |
| -------------------------------------------- | ----------------------------------------- |
| `apps/web/public/images/ducks/duck1–36.jpeg` | Subagent avatar pool (shared with paperi) |

### Data Flow

`WorkLogSubagent` / `WorkflowAgentRow` (nickname/role/title or subagentType/description) → `resolveSubagentPresentation().avatarSeed` (`nickname ?? primaryLabel`; or raw `subagentType`/`description` on workflow rows) → `duckAvatarFor(seed)` → static `duckN.jpeg` path → `<SubagentAvatar>`

### Key Functions

- `duckAvatarFor(name: string, explicit?: string) → string` — pure sync hash, no state/fetch
- `subagentAvatarSeed(workEntry: WorkLogEntry) → string | null` — resolves the seed for a transcript tool-call row from its first `subagents[0]` entry

### State

None — avatar assignment is a pure function of the subagent's existing identity fields, computed inline in JSX on every render (same cost model as the papero avatar `<img>`).

### Behavior

- Same subagent name/type always renders the same duck across all surfaces (composer strip, workflow run card, transcript tool-call row, and the subagent thread's own stream) because they all read the one `avatarSeed`. Before 2026-08-05 the strip seeded on `nickname ?? primaryLabel` while the transcript row seeded on `primaryLabel`, so a nicknamed subagent showed two different ducks.
- Inside a subagent thread the transcript shows that subagent's duck + label instead of falling back to the default papero (a subagent thread has no papero of its own).
- Multi-spawn transcript rows (`collab_agent_tool_call` with more than one subagent) show the first subagent's duck only.
- **Sticky scroll-tracking (shared with papero avatars):** `ChatStreamAvatarSlot` is `self-stretch` with `pb-7`, so its outer span spans the full turn height minus the footer (copy/meta row). The inner avatar image is `sticky top-3`, so it tracks the top of the scroll viewport while the turn is on screen, then scrolls away with the turn instead of staying pinned past it. `useContainerSize` (`apps/web/src/lib/pdf/useContainerSize.ts`, reused from PDF work) measures the slot's rendered height; below `STICKY_MIN_TURN_HEIGHT_PX` (240px) stickiness is disabled so a short turn's avatar doesn't drift away from its name label for no visual gain. This is layout behavior on the shared `ChatStreamAvatarSlot`, so it applies identically to papero turns and subagent-thread turns — see [003-paperi.md](003-paperi.md).
- Related, separate feature: [003-paperi.md](003-paperi.md) — same duck asset pool and avatar pattern (`PaperoAvatar`), but for the top-level composer agent identity, not subagents.
