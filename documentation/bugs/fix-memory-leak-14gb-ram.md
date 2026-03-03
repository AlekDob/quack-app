---
type: bug
project: quack-app
created: 2026-03-03
last_verified: 2026-03-03
tags: [memory-leak, performance, cleanup, pixi, maps]
---

# Fix: 14.65 GB RAM Usage After Extended Use

## Symptom
Quack consumed 14.65 GB RAM after hours of multi-agent use, triggering macOS "out of memory" warnings.

## Root Causes (Multiple)

### 1. No centralized agent cleanup (CRITICAL)
`onDeleteAgentChat` only cleaned `chatSessions` and `activeListenersRef`, leaving 12+ other Maps/Refs with stale data:
- `chatLoadingMap`, `chatTokensMap`, `chatSessionIds`, `pendingQuestionIdsMap`, `answeredQuestionsMap`
- `agentChatSettings`, `taskInputDrafts`, `projectOverheadCache`, `modifiedFiles`, `fileEditsMap`
- `abortControllersRef`, `lastPromptsRef`, `agentMetadataRef`, `lastAgentResponseRef`
- `activeStreamsRef`, `eventBufferRef`, `outputBuffersRef`, `activeMessageKeyRef`
- `idleTimersRef`, `notificationTimersRef`, `visualIdleTimersRef`

### 2. OfficeDuck 60fps setState (CRITICAL)
`useTick()` called `setFrame()` + `setBobOffset()` at 60fps per duck. With 10 agents = 1200 setState/sec = massive GC pressure.

### 3. useAvatarTexture GPU leak (HIGH)
Created `Texture` + `ImageSource` but cleanup only revoked blob URL, never called `texture.destroy(true)`.

### 4. Unbounded data structures (HIGH)
- `chatSessions`: messages per session grew without limit
- `usageSessions[]`: append-only array, never trimmed
- `explorerTree`: cached all visited directories forever
- `outputBuffersRef` / `activeMessageKeyRef`: never cleaned on session end

## Fix

### `cleanupAgentData(agentId)` in App.tsx
Single function that deletes ALL agent data from every Map/Ref. Called from `onDeleteAgentChat`.
- Aborts controllers, calls unlisten(), clears timers BEFORE deleting entries
- Idempotent and safe for concurrent calls

### Session-end buffer cleanup
On `result` event: cleans `outputBuffersRef` and `activeMessageKeyRef` for the finished session.

### Data structure caps
- `chatSessions`: auto-trim useEffect, `MAX_MESSAGES_PER_SESSION = 500`
- `usageSessions`: cap at 100 entries with `slice(-100)`
- `explorerTree`: LRU eviction with `MAX_CACHED_DIRS = 100`

### OfficeDuck: useRef-based animation
- `frameRef = useRef(0)` — no React re-renders for counter
- Single throttled `setTick` every 5 frames (~12fps vs 60fps)
- `drawTypingParticles` reads `frameRef.current` directly

### useAvatarTexture: texture lifecycle
- `textureRef` tracks current texture for cleanup
- Cleanup calls `texture.destroy(true)` (destroys source too)
- Wrapped in try-catch for WebGL context loss

## Files Changed
- `src/App.tsx` — cleanupAgentData, caps, session-end cleanup
- `src/components/office/OfficeDuck.tsx` — useRef animation
- `src/components/office/useAvatarTexture.ts` — texture.destroy()
- `src/stores/fileSystemStore.ts` — LRU explorerTree

## Estimated Impact
Before: 3-14 GB after 8 hours. After: <2 GB with same usage pattern.
