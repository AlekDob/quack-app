# Feature Specification: Memory Leak Fix

**Feature Branch**: `003-memory-leak-fix`
**Created**: 2026-03-03
**Status**: Draft
**Input**: Quack uses 14.65 GB RAM after extended use — systematic memory leak investigation and fix

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stable RAM After Hours of Multi-Agent Use (Priority: P1)

As a developer using Quack with multiple agents for an 8-hour workday, I want the app to maintain stable memory usage (<2 GB) so that macOS doesn't show "out of memory" warnings and force-quit applications.

**Why this priority**: The app is currently unusable for long sessions. 14.65 GB RAM crashes the system and forces users to restart Quack frequently, destroying workflow.

**Independent Test**: Launch Quack with 5+ agents, run sessions for 2+ hours, monitor RAM via Activity Monitor. RAM should stay below 2 GB.

**Acceptance Scenarios**:

1. **Given** Quack running with 5 agents for 4 hours, **When** I check Activity Monitor, **Then** RAM usage stays below 2 GB
2. **Given** Quack running with 10 agents doing streaming sessions, **When** sessions complete, **Then** memory associated with completed sessions is freed within 60 seconds
3. **Given** the Office view is visible with 10 ducks animating, **When** I switch to another tab, **Then** PixiJS animation stops and no new renders occur

---

### User Story 2 - Automatic Cleanup on Agent Removal (Priority: P1)

As a user who creates and removes agents frequently, I want all associated data (chat history, tokens, buffers, terminal instances) to be cleaned up automatically when I remove an agent, so memory doesn't accumulate from stale data.

**Why this priority**: Without centralized cleanup, every agent removal leaks memory from 10+ Maps that hold agent-specific data.

**Independent Test**: Create an agent, run a session, remove the agent. Check that all Maps (chatSessions, chatTokensMap, eventBufferRef, outputBuffersRef, etc.) no longer contain entries for the removed agent.

**Acceptance Scenarios**:

1. **Given** an agent with completed sessions, **When** I remove the agent, **Then** all associated Map entries are deleted within 1 second
2. **Given** 20 agents created and removed over time, **When** I check memory, **Then** no data from removed agents persists in any Map

---

### User Story 3 - Capped Data Structures (Priority: P2)

As a power user running long sessions, I want data structures to have size limits so that even without explicit cleanup, memory cannot grow unbounded.

**Why this priority**: Even with cleanup, long-running sessions with many messages can accumulate GBs in chatSessions and usageSessions. Caps provide a safety net.

**Independent Test**: Run a session that generates 1000+ messages. Verify that chatSessions is capped at MAX_MESSAGES and older messages are evicted.

**Acceptance Scenarios**:

1. **Given** a session with 600 messages, **When** the 501st message arrives (MAX=500), **Then** the oldest messages are evicted to maintain the cap
2. **Given** 120 usage sessions recorded, **When** the 101st is added (MAX=100), **Then** the oldest sessions are removed
3. **Given** the file explorer has cached 200 directories, **When** the 101st is added (MAX=100), **Then** the least-recently-used entries are evicted

---

### User Story 4 - Efficient Office View Rendering (Priority: P2)

As a user with the Office view open, I want the PixiJS rendering to not cause excessive React re-renders and memory pressure, so the app stays smooth and lightweight.

**Why this priority**: OfficeDuck currently triggers 1200+ setState/sec with 10 agents — massive GC pressure and CPU waste.

**Independent Test**: Open Office view with 10 agents. React DevTools Profiler should show <10 renders/sec for duck components. CPU usage from office should be <5%.

**Acceptance Scenarios**:

1. **Given** Office view with 10 animated ducks, **When** animation runs for 10 minutes, **Then** React DevTools shows 0 renders from frame/bobOffset updates (uses refs, not state)
2. **Given** Office view visible, **When** duck textures are created, **Then** cleanup properly calls `texture.destroy(true)` on unmount
3. **Given** Office view was open then tab switched, **When** Office is hidden, **Then** no PixiJS tick handlers run

---

### Edge Cases

- What happens when an agent is removed while a stream is still active? → Stream must be aborted first, then cleanup runs
- What happens when chatSessions cap evicts messages from a session the user is currently viewing? → Only evict from non-active sessions
- What happens if PixiJS Application destroy fails? → Catch error, log it, still clean up JavaScript-side references
- What happens when multiple agents complete simultaneously and trigger cleanup? → Cleanup must be idempotent and safe for concurrent execution

## Clarifications

### Q1: Message eviction strategy when chatSessions cap is reached?

**Context**: When MAX_MESSAGES is exceeded, old messages need to go somewhere or be lost.
**Answer**: **Drop without persistence**. Messages evicted from the cap are simply removed from memory. No disk persistence needed. Keeps implementation simple and avoids I/O overhead.

### Q2: When should agent data cleanup trigger?

**Context**: Cleanup could happen on agent delete only, or also on session completion.
**Answer**: **Hybrid approach (Delete + session end)**. Temporary buffers (`eventBufferRef`, `outputBuffersRef`, `activeMessageKeyRef`) are cleaned up when a session finishes (result event). Persistent data (`chatSessions`, `chatTokensMap`, `chatSessionIds`) stays until the agent is explicitly deleted by the user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a centralized `cleanupAgentData(agentId)` function that removes all agent-associated data from every Map/Ref in App.tsx
- **FR-002**: System MUST call `cleanupAgentData` automatically when an agent is deleted via `onDeleteAgentChat`
- **FR-003**: System MUST cap `chatSessions` messages per session (MAX_MESSAGES = 500) with FIFO eviction of oldest messages
- **FR-004**: System MUST cap `usageSessions` array (MAX_USAGE_SESSIONS = 100) with FIFO eviction
- **FR-005**: OfficeDuck MUST use `useRef` instead of `useState` for `frame` and `bobOffset` to eliminate per-frame re-renders
- **FR-006**: `useAvatarTexture` MUST call `texture.destroy(true)` and `source.destroy()` in useEffect cleanup
- **FR-007**: `eventBufferRef` MUST be cleared for a session key on stream end, error, or abort
- **FR-008**: `outputBuffersRef` MUST be cleared for an agent on agent removal
- **FR-009**: `explorerTree` in fileSystemStore MUST have LRU eviction (MAX_CACHED_DIRS = 100)
- **FR-010**: PixiJS Application MUST not leak WebGL contexts on mount/unmount cycles
- **FR-011**: `activeListenersRef` MUST clean up Tauri listeners when the associated agent is removed
- **FR-012**: OfficeDuck `useTick` MUST stop running when the Office tab is not visible

### Key Entities

- **AgentData**: All data associated with an agent across Maps — chatSessions, chatTokensMap, eventBufferRef, outputBuffersRef, chatSessionIds, pendingQuestionIdsMap, answeredQuestionsMap, modifiedFiles, fileEditsMap, taskInputDrafts, projectOverheadCache, activeMessageKeyRef, activeListenersRef
- **SessionMessages**: Array of ChatMessage[] per session key, subject to MAX_MESSAGES cap
- **TextureLifecycle**: PixiJS Texture + ImageSource created in useAvatarTexture, must be destroyed on cleanup

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: RAM usage stays below 2 GB after 4 hours of multi-agent use (5+ agents)
- **SC-002**: Removing an agent frees 100% of its associated data from all Maps within 1 second
- **SC-003**: Office view with 10 ducks causes 0 React re-renders per frame (animation is ref-based)
- **SC-004**: No "system out of memory" warnings during normal 8-hour workday use
- **SC-005**: `chatSessions` Map size is always <= number of active agents × MAX_MESSAGES
