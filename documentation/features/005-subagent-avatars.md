---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-04
startDate: 2026-08-04
endDate:
last_verified: 2026-08-04
status: active
tags: [subagents, avatars, composer, workflow, transcript, duck]
---

## Subagent Avatars

**Purpose:** Deterministic duck avatar per subagent (same name → same duck, ported from Codetta), shown wherever a running/finished subagent is listed, without extra state or per-render cost.
**Stack:** React / TypeScript (apps/web)

### Files

| Type      | Path                                                             | Exports/Purpose                                                                                       |
| --------- | ----------------------------------------------------------------| ------------------------------------------------------------------------------------------------------ |
| Util      | `apps/web/src/lib/duckAvatars.ts`                                | `duckAvatarFor(name, explicit?) → string` — hash(name) % 35 → `/images/ducks/duckN.jpeg`               |
| Component | `apps/web/src/components/chat/SubagentAvatar.tsx`                | `SubagentAvatar({ seed, className })` — thin `<img>` wrapper around `duckAvatarFor`                    |
| Component | `apps/web/src/components/chat/ComposerSubagentStrip.tsx`         | Renders `SubagentAvatar` next to the status dot on each running-subagent row above the composer        |
| Component | `apps/web/src/components/chat/WorkflowRunCard.tsx`               | `WorkflowAgentRowView` renders `SubagentAvatar` next to the status dot on each dynamic-workflow agent row |
| Component | `apps/web/src/components/chat/TimelineWorkEntryRow.tsx`          | `subagentAvatarSeed()` swaps the generic bot icon for `SubagentAvatar` on `collab_agent_tool_call` transcript rows |
| Util      | `apps/web/src/lib/subagentPresentation.ts`                       | `resolveSubagentPresentation()` — supplies the stable `primaryLabel` used as the avatar seed           |

### Assets

| Path                                         | Role                    |
| --------------------------------------------- | ----------------------- |
| `apps/web/public/images/ducks/duck1–36.jpeg` | Subagent avatar pool (shared with paperi) |

### Data Flow

`WorkLogSubagent` / `WorkflowAgentRow` (nickname/role/title or subagentType/description) → `resolveSubagentPresentation().primaryLabel` (or raw `subagentType`/`description`) → `duckAvatarFor(seed)` → static `duckN.jpeg` path → `<SubagentAvatar>`

### Key Functions

- `duckAvatarFor(name: string, explicit?: string) → string` — pure sync hash, no state/fetch
- `subagentAvatarSeed(workEntry: WorkLogEntry) → string | null` — resolves the seed for a transcript tool-call row from its first `subagents[0]` entry

### State

None — avatar assignment is a pure function of the subagent's existing identity fields, computed inline in JSX on every render (same cost model as the papero avatar `<img>`).

### Behavior

- Same subagent name/type always renders the same duck across all three surfaces (composer strip, workflow run card, transcript tool-call row) — no coordination/state needed since the seed strings match.
- Multi-spawn transcript rows (`collab_agent_tool_call` with more than one subagent) show the first subagent's duck only.
- Related, separate feature: [003-paperi.md](003-paperi.md) — same duck asset pool and avatar pattern (`PaperoAvatar`), but for the top-level composer agent identity, not subagents.
