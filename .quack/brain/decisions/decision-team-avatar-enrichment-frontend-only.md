---
type: decision
project: quack-app
created: 2026-02-06
tags: [agent-teams, avatar, architecture, frontend-enrichment]
---

# Decision: Team Avatar/Color Enrichment — Frontend Only

## Context

TeamMember data comes from Rust (`teams.rs`) where it stores `agentId`, `name`, `role`, `communicationStyle`, `isLead`. But agent avatars and colors live in the frontend (`quack-agents.json` → `TerminalInfo`).

We needed avatars and colors in TeamMember for visual feedback (TeamModeBadge, TeammateWidget).

## Options Considered

### Option A: Modify Rust TeamMember struct
- Add `avatar` and `color` fields to Rust `TeamMember`
- Pass avatar/color during `create_team` Tauri command
- Store in `.quack/teams/{id}.json`

**Pros**: Data complete at source, no frontend enrichment needed
**Cons**:
- Rust struct change → serialization/deserialization changes
- Stored avatar paths may become stale if user changes agent avatar
- Rust doesn't need avatar data (it's purely visual)
- More Tauri IPC surface to maintain

### Option B: Frontend enrichment at load/create time (CHOSEN)
- Keep Rust TeamMember lean (no avatar/color)
- Add optional `avatar?` and `color?` to TypeScript TeamMember
- Enrich in `teamStore.ts` after Rust returns data
- Pass `agentAvatars: Map<string, { avatar?, color? }>` from caller

**Pros**:
- Zero Rust changes
- Always fresh avatar data (reads from current agent state)
- Clean separation: Rust = persistence, Frontend = presentation
- Backward compatible (existing team JSON files work unchanged)

**Cons**:
- Caller must build and pass avatar map
- If store loads without avatar map, members have no visual data

### Option C: Separate Tauri command for avatar resolution
- Keep Rust lean, add `resolve_team_avatars` command
- Frontend calls it separately

**Rejected**: Over-engineered for a simple enrichment need.

## Decision

**Option B** — Frontend enrichment at load/create time.

## Implementation

```typescript
// types.ts
export interface TeamMember {
  agentId: string;
  name: string;
  role: string;
  communicationStyle: string;
  isLead: boolean;
  avatar?: string;   // Frontend-enriched
  color?: string;    // Frontend-enriched
}

// teamStore.ts — both createTeam and loadActiveTeam
if (agentAvatars) {
  for (const member of team.members) {
    const data = agentAvatars.get(member.agentId);
    if (data) {
      member.avatar = data.avatar;
      member.color = data.color;
    }
  }
}

// RepositoryGroup.tsx — builds the map from TerminalInfo[]
const buildAgentAvatarMap = useCallback(() => {
  const map = new Map<string, { avatar?: string; color?: string }>();
  for (const agent of [...mainAgents, ...worktreeAgents]) {
    map.set(agent.id, { avatar: agent.avatar, color: agent.color });
  }
  return map;
}, [mainAgents, worktreeAgents]);
```

## Callers Updated

| Component | Method | Passes avatarMap |
|-----------|--------|-----------------|
| RepositoryGroup | `loadActiveTeam` (3 calls) | `buildAgentAvatarMap()` |
| TeamCreationModal | `createTeam` | Built from `agents` prop |

## Key Principle

**Rust handles persistence, Frontend handles presentation.** Avatar/color is purely presentational, so it belongs in the frontend layer. This follows the same pattern used for other visual-only data in Quack (e.g., agent color in sidebar is never stored in Rust).

## Related

- `patterns/agent-teams-visual-feedback.md` — Visual feedback components
- `patterns/agent-system.md` — Agent architecture (TerminalInfo vs SavedAgent)
