---
type: bug_fix
created: 2026-02-11
tags: [tauri, performance, event-listeners, race-condition, crash]
---

# Fix: Startup listener crashes and performance issues

## Summary

Fixed three critical bugs in the Tauri event listener system that caused console spam, performance degradation, and hard crashes at startup. The root causes were: excessive listener registrations for invalid session IDs, race conditions between concurrent listener setup calls, and unhandled Promise rejections from Tauri's internal cleanup.

## Bug 1: Excessive Multi-Listener Registrations (Performance)

### Problem

**File**: `src/App.tsx` line ~1781

The `activeAgentIdsKey` was derived from `chatSessions.keys()` which includes:
- Agent IDs: `agent-xxx` (valid)
- Session IDs: `session-xxx` (invalid for listeners)

The Multi-Listener useEffect tried to create a Tauri event listener for EVERY key, but the Rust backend only emits events on `claude-event:{agentId}` where agentId = terminal ID.

Listeners for session keys were completely useless and flooded the console with:
```
[Multi-Listener] Listener already exists for agent: session-xxx
```

### Solution

Changed `activeAgentIdsKey` from:
```tsx
Array.from(chatSessions.keys()).sort().join(',')
```

To:
```tsx
terminals.map(t => t.id).sort().join(',')
```

Now only real agent IDs (terminal IDs) get listeners. Tasks/sessions are handled by `ensureListenerReady()` on-demand.

### Impact

- Eliminated console spam
- Reduced unnecessary listener registrations by ~50%
- Improved startup performance

---

## Bug 2: Tauri Listener Race Condition Crash

### Problem

**File**: `src/App.tsx` - Multiple locations

Three different code paths could call `listen()` for the same agentId simultaneously:
1. Multi-Listener useEffect
2. Pre-warm useEffect
3. `ensureListenerReady` callback

Since `listen()` is async, all three could pass the `activeListenersRef.current.has(agentId)` check before any resolved, causing duplicate registrations.

### Symptom

```
[CrashGuard] Unhandled Promise rejection: TypeError: undefined is not an object
(evaluating 'listeners[eventId].handlerId')
```

### Solution (3 Parts)

#### Part A: Pending Listeners Tracking

Added `pendingListenersRef` (Set) to track in-flight listener registrations:

```tsx
const pendingListenersRef = useRef(new Set<string>());
```

All 3 registration points now check:
- `activeListenersRef` (registered)
- `pendingListenersRef` (in progress)

Example pattern:
```tsx
if (activeListenersRef.current.has(agentId) || pendingListenersRef.current.has(agentId)) {
  return;
}
pendingListenersRef.current.add(agentId);

const unlisten = await listen(`claude-event:${agentId}`, handler);

pendingListenersRef.current.delete(agentId);
activeListenersRef.current.set(agentId, unlisten);
```

#### Part B: Fix pip-agent-clicked Dependency

The `pip-agent-clicked` listener had `terminals` as a dependency, causing teardown/setup on every terminals change.

Replaced with `terminalsRef` (existing ref at line 845) to avoid unnecessary re-registration.

#### Part C: Graceful unlisten() Handling

ALL `unlisten()` calls throughout the codebase now have `.catch(() => undefined)` to gracefully handle Tauri's internal crash when deregistering a listener that no longer exists.

Patterns updated:
- 14 cleanup patterns: `.then(fn => fn()).catch(() => undefined)`
- 5 direct calls: `void unlisten().catch(() => undefined)`

### Impact

- Eliminated race condition crashes
- Prevented duplicate listener registrations
- Made cleanup resilient to React StrictMode double-mounting

---

## Bug 3: chatKey="null" Console Noise

### Problem

**File**: `src/App.tsx` line ~4035

`chatKey = activeSessionId` is `null` at startup (no session selected). The `useMemo` logged this as if it were an error.

### Solution

Removed the verbose `console.log` — null chatKey is a legitimate state at boot, already handled correctly by returning empty array.

---

## Key Insight

The `unlisten()` function returned by Tauri's `listen()` is async:
1. Calls `window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(event, eventId)` synchronously
2. Calls `invoke('plugin:event|unlisten', ...)` asynchronously

If the listener doesn't exist in Tauri's internal registry anymore, `unregisterListener` crashes. Without `.catch()` on the returned Promise, this becomes an "Unhandled Promise rejection".

**Critical Pattern**: Always wrap `unlisten()` calls:
```tsx
// Cleanup pattern
.then(fn => fn()).catch(() => undefined)

// Direct call pattern
void unlisten().catch(() => undefined)
```

---

## Trigger Conditions

1. **Bug 1**: Any startup with existing chat sessions
2. **Bug 2**: Fast user interactions during app initialization, React StrictMode (dev), component hot-reload
3. **Bug 3**: Every cold start (no active session)

---

## Verification

All three bugs verified fixed:
- No more duplicate listener warnings
- No more race condition crashes
- Clean console output at startup
- App feels noticeably snappier on launch
