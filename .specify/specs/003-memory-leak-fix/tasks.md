# Implementation Tasks: Memory Leak Fix

## Phase 1: PixiJS / Office Rendering (Quick Wins)

- [x] 1.1 OfficeDuck: Replace useState with useRef for animation ✓ Complete
- [x] 1.2 [P] useAvatarTexture: Add texture.destroy() in cleanup ✓ Complete

## Phase 2: Centralized Agent Cleanup

- [x] 2.1 Create `cleanupAgentData(agentId)` function in App.tsx ✓ Complete
- [x] 2.2 Wire `cleanupAgentData` into `onDeleteAgentChat` ✓ Complete
- [x] 2.3 [P] Add session-end buffer cleanup ✓ Complete

## Phase 3: Data Structure Caps

- [x] 3.1 Add MAX_MESSAGES_PER_SESSION cap to chatSessions ✓ Complete (useEffect auto-trim)
- [x] 3.2 [P] Add MAX_USAGE_SESSIONS cap to usageSessions ✓ Complete (slice(-100))
- [x] 3.3 [P] Add LRU eviction to fileSystemStore explorerTree ✓ Complete

## Phase 4: Validation & Documentation

- [ ] 4.1 Manual verification (requires user testing)
- [x] 4.2 [P] Documentation ✓ Complete
