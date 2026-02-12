---
type: gotcha
project: quack-app
created: 2026-02-12
tags: [team, race-condition, agents, ui-state, useEffect]
---

# Team Persistence Race Condition - Agent Loading Order

## Problem

Teams fail to appear in the UI after app restart, even though:
- Team JSON files exist in `.quack/teams/` (successfully loaded from Rust backend)
- CLAUDE.md roster is properly injected
- No errors visible to user

**Root cause**: `loadActiveTeam()` executes before agents have loaded, causing avatar/color enrichment to fail silently.

## Location

`src/components/RepositoryGroup.tsx:1180-1183`

```typescript
useEffect(() => {
  if (repoPath && isQuackProject) {
    loadActiveTeam(repoPath, buildAgentAvatarMap())
  }
}, [repoPath])
```

## What Happens

1. **App starts** → `RepositoryGroup` mounts
2. **useEffect fires** → `loadActiveTeam(repoPath, buildAgentAvatarMap())` called
3. **Agents haven't loaded yet** → `buildAgentAvatarMap()` returns empty `Map<string, {avatar, color}>`
4. **Team loads from Rust** → Team data retrieved successfully (JSON files exist)
5. **Avatar/color enrichment fails** → Members have no avatar/color data
6. **UI can't display team** → Team appears "gone" because members lack required display properties
7. **Effect won't re-run** → When agents finish loading, `useEffect` doesn't re-trigger (only `repoPath` dependency)

## Evidence

- Two team JSON files found: `.quack/teams/8b1ad6bf-...json`, `.quack/teams/9ac059d8-...json`
- CLAUDE.md roster correctly shows team members
- `teamStore.ts:52` catches error silently (only `console.error`, no UI feedback)
- No localStorage cache as fallback for team state

## Why This Is Silent

From `src/stores/teamStore.ts:37-56`:

```typescript
loadActiveTeam: async (projectPath: string, agentAvatarMap: Map<string, { avatar: string; color: string }>) => {
  try {
    const team = await loadActiveTeam(projectPath, agentAvatarMap)
    // ... sets state ...
  } catch (error) {
    console.error('[TeamStore] Failed to load active team:', error)
    set({ activeTeam: null, isLoading: false })
  }
}
```

Error is logged but not surfaced to UI. Team state becomes `null`, so UI shows no team.

## Solution Options

### Option 1: Add agents dependency (risky)
```typescript
useEffect(() => {
  if (repoPath && isQuackProject) {
    loadActiveTeam(repoPath, buildAgentAvatarMap())
  }
}, [repoPath, agents]) // ⚠️ Risk: agents object identity might cause infinite loop
```

### Option 2: Re-trigger on agents loaded event
```typescript
useEffect(() => {
  if (repoPath && isQuackProject && agents.length > 0) {
    loadActiveTeam(repoPath, buildAgentAvatarMap())
  }
}, [repoPath, agents.length]) // Safer: only re-runs when count changes
```

### Option 3: Add localStorage cache fallback
Cache enriched team data in localStorage as backup when Rust + agents fail to sync timing.

### Option 4: Lazy enrichment
Load team structure first (no avatars/colors), then enrich display properties when agents become available.

## Related Knowledge

- **Decision**: `decision-team-avatar-enrichment-frontend-only.md` - Explains why avatar/color must be enriched at runtime (not stored in Rust)
- **Files involved**:
  - `src/components/RepositoryGroup.tsx` (line 1170-1183)
  - `src/stores/teamStore.ts` (line 37-56)
  - `src/services/teamAgentService.ts` (avatar enrichment logic)

## Tags for Future Search

When hitting "team disappeared after restart", "agents not showing", "empty team state", this is likely the culprit.
