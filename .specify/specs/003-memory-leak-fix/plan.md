# Implementation Plan: Memory Leak Fix

## Architecture Overview

The fix targets 4 layers of the app:

1. **App.tsx state cleanup** — centralized `cleanupAgentData()` + session-end cleanup for buffers
2. **Data structure caps** — MAX_MESSAGES, MAX_USAGE_SESSIONS, LRU explorerTree
3. **PixiJS/Office rendering** — ref-based animation, texture disposal, tick pausing
4. **Store cleanup** — fileSystemStore LRU eviction

## Design Patterns

### Pattern 1: Centralized Agent Cleanup

Create a `cleanupAgentData(agentId)` function inside App.tsx that deletes ALL agent-associated entries from every Map/Ref. This single function is called from `onDeleteAgentChat`.

**Maps to clean** (complete list):
- `chatSessions` (setChatSessions)
- `chatLoadingMap` (setChatLoadingMap)
- `agentMetadataRef`
- `lastAgentResponseRef`
- `abortControllersRef` (abort first, then delete)
- `lastPromptsRef`
- `activeStreamsRef`
- `activeListenersRef` (call unlisten first, then delete)
- `pendingListenersRef`
- `eventBufferRef`
- `activeMessageKeyRef`
- `agentChatSettings` (setAgentChatSettings)
- `chatTokensMap` (setChatTokensMap)
- `chatSessionIds` (setChatSessionIds)
- `pendingQuestionIdsMap` (setPendingQuestionIdsMap)
- `answeredQuestionsMap` (setAnsweredQuestionsMap)
- `taskInputDrafts` (setTaskInputDrafts)
- `outputBuffersRef`
- `idleTimersRef` (clearTimeout first)
- `notificationTimersRef` (clearTimeout first)
- `visualIdleTimersRef` (clearTimeout first)
- `modifiedFiles`
- `fileEditsMap`

### Pattern 2: Session-End Buffer Cleanup

On stream completion (result event) or abort, clean temporary buffers:
- `eventBufferRef.current.delete(messageKey)`
- `outputBuffersRef.current.delete(agentId)`
- `activeMessageKeyRef.current.delete(agentId)`

This is partially done already for eventBufferRef. Extend to outputBuffersRef and activeMessageKeyRef.

### Pattern 3: Capped Collections

```typescript
// Constants
const MAX_MESSAGES_PER_SESSION = 500;
const MAX_USAGE_SESSIONS = 100;
const MAX_CACHED_DIRS = 100;

// chatSessions cap - evict oldest messages
function addMessageWithCap(
  prev: Map<string, ChatMessage[]>,
  key: string,
  msg: ChatMessage,
): Map<string, ChatMessage[]> {
  const messages = prev.get(key) || [];
  const updated = [...messages, msg];
  if (updated.length > MAX_MESSAGES_PER_SESSION) {
    updated.splice(0, updated.length - MAX_MESSAGES_PER_SESSION);
  }
  const next = new Map(prev);
  next.set(key, updated);
  return next;
}

// usageSessions cap
setUsageSessions(prev => {
  const updated = [...prev, newSession];
  return updated.length > MAX_USAGE_SESSIONS
    ? updated.slice(-MAX_USAGE_SESSIONS)
    : updated;
});
```

### Pattern 4: LRU Explorer Tree

Replace `explorerTree: Record<string, DirectoryEntry[]>` with an LRU approach:
- Track access order with a `explorerTreeOrder: string[]` array
- On `addToExplorerTree`, push path to end of order array
- If order.length > MAX_CACHED_DIRS, delete the oldest entry from both tree and order

### Pattern 5: Ref-Based PixiJS Animation

Replace `useState` with `useRef` for animation values in OfficeDuck:

```typescript
const frameRef = useRef(0);
const bobRef = useRef(0);

useTick(() => {
  frameRef.current += 1;
  const f = frameRef.current;
  // Calculate bobOffset based on status
  bobRef.current = agent.status === 'busy'
    ? Math.sin(f * 0.15) * 3
    : agent.waitingForResponse
      ? Math.sin(f * 0.05) * 5
      : Math.sin(f * 0.03) * 1.5;
});
```

The `<pixiContainer>` reads `bobRef.current` directly — PixiJS updates are imperative, not React state-driven. The `pixiGraphics.draw` callbacks already receive the Graphics object imperatively.

### Pattern 6: Texture Lifecycle

```typescript
// useAvatarTexture cleanup
return () => {
  cancelled = true;
  // Destroy PixiJS texture and source to free GPU memory
  if (textureRef.current) {
    textureRef.current.destroy(true); // true = also destroy source
    textureRef.current = null;
  }
  if (blobUrlRef.current) {
    URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
  }
};
```

## Component Impact

| Component | Change Type | Risk |
|-----------|-------------|------|
| `App.tsx` | Add `cleanupAgentData()`, extend `onDeleteAgentChat`, add caps | Medium — many Maps, must not miss any |
| `OfficeDuck.tsx` | Replace useState with useRef for animation | Low — isolated component |
| `useAvatarTexture.ts` | Add texture.destroy() in cleanup | Low — isolated hook |
| `fileSystemStore.ts` | Add LRU eviction to explorerTree | Low — self-contained store |
| `OfficeView.tsx` | No change needed — Application lifecycle is managed by @pixi/react | None |

## Security Considerations

- No external data exposure
- Cleanup functions must be idempotent (safe to call multiple times)
- AbortController must be aborted before deletion to prevent orphaned network requests

## Performance Strategy

- `cleanupAgentData` is O(n) on Map size — called rarely (agent deletion), not a concern
- Message cap eviction uses `splice(0, excess)` — O(n) but only triggers when cap is exceeded
- LRU eviction is O(1) amortized with array shift
- Ref-based animation eliminates ~1200 setState/sec with 10 agents → massive CPU savings

## Error Handling

- `texture.destroy()` wrapped in try-catch (can throw if WebGL context is lost)
- `unlisten()` calls wrapped in try-catch (can throw if Tauri event system is in bad state)
- `abortController.abort()` is always safe to call (no-op if already aborted)
