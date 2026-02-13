# Team System Fixes - 2026-02-12

**Date**: February 12, 2026
**Session Type**: Bug fixes and improvements
**Components**: TeammateWidget, Team persistence, IDEOnboarding, Git configuration, Team avatar enrichment

---

## Executive Summary

This session addressed five critical issues in the team management system that prevented proper interaction with completed teammates, caused avatar/color loss on startup, infinite render loops, and unintended git sharing of team configurations. All fixes maintain backward compatibility and enhance stability.

---

## Issues Fixed

### 1. TeammateWidget Drill-Down Unclickable After Task Completion

**File**: `src/components/TeammateWidget.tsx`

**Problem**
The TeammateWidget was only clickable while a task was running. Once the task completed or stopped, the widget became non-clickable despite having a valid `sessionId`, preventing users from drilling down to view completed teammate sessions.

**Root Cause**
The `isClickable` condition included a gate on `isStarting`:
```typescript
const isClickable = !!sessionId && isStarting && !!onDrillDown;
```
This meant the widget was only interactive during active execution.

**Solution**
- Removed the `isStarting` dependency from the clickable condition
- Updated `isClickable` to: `!!sessionId && !!onDrillDown`
- Added "(click to view)" hint text to the completed state to guide users that the widget is still interactive

**Impact**
Users can now click on completed teammate widgets to view session history and chat, improving visibility into finished work.

---

### 2. Session ID Lost When Teammate Stops

**File**: `src/App.tsx` (line ~1228)

**Problem**
When a teammate's action was 'stop', the session ID was being overwritten with `undefined`. The `updateTeammateStatus` function was called without passing the `sessionId` from the event, causing the session reference to be lost.

**Root Cause**
```typescript
// Before - missing sessionId on stop events
case 'stop':
  updateTeammateStatus(agentId, 'stop');
```

**Solution**
Pass the `session_id` from the Tauri event to `updateTeammateStatus` on all action types:
```typescript
case 'stop':
  updateTeammateStatus(agentId, 'stop', agentEvt.session_id);
```

**Impact**
Session IDs are now preserved when teammates stop, allowing users to retrieve session history after completion (works in conjunction with Fix #1).

---

### 3. IDEOnboarding Infinite Render Loop

**File**: `src/components/settings/IDEOnboarding.tsx`

**Problem**
The component created an infinite render loop that manifested as "Maximum update depth exceeded" error, crashing the ErrorBoundary. This blocked the entire sidebar rendering, including team badges, making the UI non-functional.

**Root Cause**
Three compounding issues:
1. Bare `useIDEStore()` without selectors caused component to re-render on every store change
2. Component called `loadInstalledApps()` inside `useEffect` without dependencies
3. `loadInstalledApps()` updated the store, which triggered a re-render, which called the effect again

**Solution**
- **Selector Specificity**: Replaced bare destructuring with individual selectors:
  ```typescript
  const isLoadingApps = useIDEStore((s) => s.isLoadingApps);
  const installedApps = useIDEStore((s) => s.installedApps);
  ```
- **One-Time Loading**: Added `hasLoadedRef` to ensure `loadInstalledApps` is called only once on mount
- **Memoization**: Wrapped `ideApps` computation in `useMemo` to prevent new array references on each render

**Impact**
The sidebar now renders correctly, ErrorBoundary no longer catches IDEOnboarding crashes, and team badges display properly.

---

### 4. Team Files Shared via Git

**File**: `.gitignore`

**Problem**
The `.quack/teams/` directory was not in `.gitignore`. Team configuration JSON files were tracked and committed to git, meaning all collaborators pulling the repo would automatically inherit team configurations. When Rust loaded these files, it would treat them as if they belonged to the current user, displaying team badges and sessions without the user having created or joined a team.

**Root Cause**
Team JSON files in `.quack/teams/{uuid}.json` are user-specific and ephemeral. They should be similar to other local-only files like `.env` or editor settings.

**Solution**
- Added `.quack/teams/` to `.gitignore`
- Ran `git rm --cached` to remove 5 existing team JSON files from git history
- Files are now properly excluded from version control

**Impact**
Team configurations are now local-only. Collaborators no longer see ghost team badges or sessions from other users' team files.

---

### 5. Team Avatar Enrichment Race Condition on Startup

**File**: `src/components/RepositoryGroup.tsx`

**Problem**
On application startup, team avatars and colors were not displaying despite the team loading correctly from Rust. The team data was persisted correctly to `.quack/teams/{uuid}.json`, but the avatar map was empty.

**Root Cause**
The `useEffect` that called `loadActiveTeam()` only watched `[repoPath]` as a dependency. On startup:
1. Component mounted with empty agents (avatar map not populated)
2. `loadActiveTeam()` was called with `buildAgentAvatarMap()` returning an empty map
3. Agents eventually loaded in the background, but the effect never re-ran
4. Team was displayed without avatar/color enrichment

**Solution**
- Added a second `useEffect` that watches `agentCount` as a dependency
- When `agentCount` changes (agents load), the second effect calls `loadActiveTeam()` again with the now-populated avatar map
- Used `hasEnrichedRef` to prevent repeated enrichment calls
- First effect still runs on `repoPath` change for robustness

**Impact**
Team avatars and colors now display correctly on startup. The enrichment happens as soon as agents become available, providing consistent UI state.

---

## Technical Details

### Dependency Order and Startup Sequence

The fixes depend on proper startup ordering:
1. Tauri backend initializes team storage
2. React component mounts
3. Agents load asynchronously
4. Avatar enrichment happens after agents are available
5. Team UI fully renders with all visual data

### Testing Notes

- `npm run dev` (Vite only) cannot load teams because the Tauri/Rust backend is not running. Use `npm run tauri dev` for full functionality testing.
- Team JSON is correctly persisted by Rust to `.quack/teams/{uuid}.json` - the persistence layer is stable.
- All fixes maintain the existing Rust-backed team storage; no changes to the persistence layer were necessary.

---

## Files Modified

| File | Type | Changes |
|------|------|---------|
| `src/components/TeammateWidget.tsx` | Component | Updated `isClickable` condition, added hint text |
| `src/App.tsx` | App logic | Pass `sessionId` to `updateTeammateStatus` on stop events |
| `src/components/settings/IDEOnboarding.tsx` | Component | Selector specificity, one-time loading guard, memoization |
| `.gitignore` | Config | Added `.quack/teams/` to exclusions |
| `src/components/RepositoryGroup.tsx` | Component | Added second `useEffect` watching `agentCount` for avatar enrichment |

---

## Regression Testing

All fixes have been verified to:
- Not break existing team loading functionality
- Preserve session IDs through the complete lifecycle (start → stop → view)
- Prevent infinite render loops while maintaining reactive updates
- Correctly load and enrich team data on startup with populated agents

No new test files added—these are tactical bug fixes to existing functionality. Consider adding tests for avatar enrichment race condition in future refactoring.

---

## Related Issues

These fixes resolve interconnected issues in the team subsystem:
- Team UI was non-functional (IDEOnboarding crash) preventing sidebar rendering
- Teams were unintentionally shared (git tracking issue)
- Completed teammates couldn't be viewed (widget interactivity + session ID loss)
- Visual team data was missing on startup (avatar enrichment race condition)

The fixes work together to restore full team functionality across the lifecycle: creation, execution, completion, and viewing.
