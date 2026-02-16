# Memory Leak Prevention Guide

> A practical guide for Quack developers to prevent WebView memory leaks.

## Why This Matters

Quack runs inside a Tauri WebView (`WKWebView` on macOS, `WebView2` on Windows). All React state, event listeners, timers, and DOM nodes share the same process: `com.apple.WebKit.WebContent`. Memory leaks compound and eventually cause:

- **High CPU** (30-50%) from GC pressure
- **High RAM** (1+ GB) from accumulated data
- **White screen** if the user force-kills the WebView process

## The 5 Rules

### 1. Cap All Growing Collections

Every `Map`, `Set`, or array that grows during app lifetime MUST have a maximum size.

```typescript
// BAD - grows forever
const cache = new Map<string, Data>();
cache.set(key, value);

// GOOD - bounded
const MAX_CACHE = 1000;
cache.set(key, value);
if (cache.size > MAX_CACHE) {
  const oldest = cache.keys().next().value;
  cache.delete(oldest);
}
```

**Current constants:**
- `MAX_EVENTS_PER_STREAM = 500` (useClaudeChat.ts)
- `taskToolToKanbanMap` safety valve at 100 entries
- Rust stderr buffer: 200 lines max

### 2. Clean Up on Both Success AND Failure

Global Maps that track in-flight operations must delete entries on error/abort, not just on success.

```typescript
// BAD - only cleans on success
try {
  const result = await doWork();
  trackingMap.delete(id); // Only here!
} catch (err) {
  // id stays in map forever
}

// GOOD - clean in finally
try {
  const result = await doWork();
} finally {
  trackingMap.delete(id); // Always cleans up
}
```

### 3. Track Nested Timers

Never create `setTimeout` inside `setInterval` without tracking the inner timeout for cleanup.

```typescript
// BAD - inner timeout fires after cleanup
const interval = setInterval(() => {
  setState(true);
  setTimeout(() => setState(false), 2000); // LEAK: not tracked
}, 5000);
return () => clearInterval(interval); // Doesn't cancel setTimeout!

// GOOD - track everything
let hideTimeout: ReturnType<typeof setTimeout>;
const interval = setInterval(() => {
  setState(true);
  hideTimeout = setTimeout(() => setState(false), 2000);
}, 5000);
return () => {
  clearInterval(interval);
  clearTimeout(hideTimeout); // Now cancelled!
};
```

### 4. Immediate Cleanup in Finally Blocks

Don't use `setTimeout` for cleanup after async operations. Clean up immediately.

```typescript
// BAD - delayed cleanup creates race window
finally {
  setTimeout(() => resources.delete(key), 5000);
}

// GOOD - immediate cleanup
finally {
  resources.delete(key);
}
```

### 5. Cap Rust Buffers for Long I/O

Any Rust `Vec` that collects output from a long-running process must be bounded.

```rust
// BAD - unbounded
let mut lines = Vec::new();
while let Ok(Some(line)) = reader.next_line().await {
    lines.push(line); // Grows forever
}

// GOOD - circular buffer
let mut lines: Vec<String> = Vec::with_capacity(200);
while let Ok(Some(line)) = reader.next_line().await {
    lines.push(line);
    if lines.len() > 200 {
        lines.remove(0); // Keep last 200 only
    }
}
```

## How to Spot Leaks

1. **Activity Monitor** — Watch `com.apple.WebKit.WebContent` RAM over time. Should stabilize, not grow linearly.
2. **Console.warn** — We log warnings when maps exceed thresholds (e.g., `taskToolToKanbanMap has X entries`).
3. **React DevTools Profiler** — Look for components re-rendering on every streaming event.

## Known Bounded Collections

| Collection | File | Max Size | Type |
|-----------|------|----------|------|
| `events[]` per stream | useClaudeChat.ts | 500 | Array splice |
| `taskToolToKanbanMap` | useClaudeChat.ts | 100 (safety valve) | Map clear |
| `seenEventIds` per stream | claudeSDK.ts | Immediate delete | Map delete |
| `stderr_lines` | claude_cli.rs | 200 | Vec circular |
| `activity_log` | activityLogService.ts | 1MB rotation | File |
| `background agent logs` | backgroundAgentStore.ts | 500 per task | Array |

## Remaining Watch Items

These are NOT yet bounded — monitor in future sessions:
- `usageSessions[]` in ChatContext
- `tabsByTerminal` Map in uiStore
- `explorerTree` cache in fileSystemStore
- `teammateStatus` Map in teamStore

## Date
2026-02-14
