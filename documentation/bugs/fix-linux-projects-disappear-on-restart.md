---
type: bug_fix
project: quack-app
created: 2026-04-11
last_verified: 2026-04-11
tags: [tauri-store, linux, persistence, race-condition, webkitgtk]
---
# Fix: Linux Projects Disappear from Sidebar on Restart

## Problem

On Linux, projects added to the sidebar disappear after closing and reopening Quack. Mac and Windows work correctly. Every restart requires reconfiguring all projects.

## Root Cause

`quack-agents.json` stores both `agents` (project/terminal metadata) and `sessions` in the same Tauri Store file. The Tauri Store plugin uses a **single in-memory map** per file. `store.save()` writes ALL in-memory keys to disk. `store.reload()` replaces the ENTIRE in-memory state with disk contents.

### The race condition

Sessions are saved **immediately** on creation. Agents are saved via a **2-second debounced** `useEffect`. During the debounce window:

1. User creates a project → terminal added to state → 2s debounce timer starts
2. Session created immediately → `saveAgentSessions()` → `store.set('sessions', [...])` → `store.save()`
3. At step 2, **agents were never `store.set()` in this app session** (debounce hasn't fired). The in-memory store has only `sessions`. `store.save()` writes `{"sessions": [...]}` — **no agents key**.
4. 2s debounce fires → `saveAgents([agent])` → writes both keys. File is now correct.
5. But if `store.reload()` fires between steps 2–4 (from an event listener, component mount, etc.), it loads the file from step 3 (no agents) → wipes agents from memory → subsequent saves perpetuate the loss.

### The self-perpetuating corruption cycle

Once agents are missing from the file, the cycle never breaks:
1. Boot → `loadAgents()` → file has no `agents` key → returns `[]`
2. Eager re-save skipped (`savedAgents.length === 0`)
3. Session save writes file without agents → file stays corrupted → next restart → repeat

### Why Linux only?

The race condition exists on **all platforms** but Linux/WebKitGTK makes it deterministic:

| Platform | WebView | Why it "works" |
|----------|---------|-----------------|
| macOS | WebKit native | Fast IPC, event loop rarely yields between `set()` and `save()` |
| Windows | WebView2 (Chromium) | Same — tight async scheduling masks the race |
| **Linux** | **WebKitGTK** | Slower IPC, event loop yields between `await` calls, `store.reload()` can fire between `set()` and `save()` |

Additional Linux factors:
- **WebKitGTK async scheduling**: every `await store.save()` (IPC to Rust backend) yields the JS thread, allowing queued tasks like `loadAgentSessions()` → `store.reload()` to execute mid-flight
- **Terminal creation latency**: higher on WebKitGTK, each Rust response updates terminal state and resets the 2s debounce timer, widening the corruption window
- **Once corrupted, permanent**: the cycle in section above means the bug never self-heals

## Solution

### Fix 1: Shadow cache (definitive fix)

Module-level copies `_cachedAgents` / `_cachedSessions` in `unifiedAgentStorage.ts`, updated on **every load and save**. Before any `store.save()`, the save function checks if the sibling key exists in the in-memory store — if missing, restores it from the shadow cache.

```typescript
// In saveAgentSessions():
const agentsInStore = await store.get<UnifiedAgent[]>(AGENTS_KEY);
if (!agentsInStore && _cachedAgents !== null) {
  await store.set(AGENTS_KEY, _cachedAgents);
}
await store.save(); // Both keys always present
```

**Critical detail**: ALL early-return paths in `loadAgents()` and `loadAgentSessions()` must set the cache to `[]`, not leave it as `null`. If the cache is `null`, the `!== null` check fails and agents aren't restored — this was the bug in the first fix attempt.

### Fix 2: Immediate save on terminal count change

New `useEffect` in `App.tsx` that saves agents **immediately** (no debounce) when `terminals.length` changes. This ensures agents hit disk before any concurrent session save.

```typescript
const savedTerminalCount = useRef(-1);
useEffect(() => {
  if (!tauriAvailable || !hasBootstrapped || terminals.length === 0) return;
  if (terminals.length !== savedTerminalCount.current) {
    savedTerminalCount.current = terminals.length;
    const agents = terminals.map(terminalToUnifiedAgent);
    void saveUnifiedAgents(agents);
  }
}, [hasBootstrapped, tauriAvailable, terminals]);
```

The existing 2s debounced effect remains for property updates (cwd, label, personality).

### Fix 3: Store-wide write lock (defense-in-depth)

`storeWriteLock` prevents `store.reload()` from firing within 1 second of any write. Not sufficient alone but reduces the race window.

### Fix 4: Eager re-save at bootstrap

After loading agents during bootstrap, immediately call `saveUnifiedAgents(savedAgents)` to ensure the `agents` key is present in the store file.

## Key Insight

The Tauri Store plugin (`@tauri-apps/plugin-store`) uses a single in-memory map per file. `store.reload()` is a **destructive operation** that replaces ALL keys, not just the one you're about to read. When multiple logical "tables" (agents, sessions) share one store file, any reload between a `set()` and `save()` of a different table causes data loss. The shadow cache breaks this by ensuring both keys are always re-set before any `store.save()`.

## Related Files

- `src/services/unifiedAgentStorage.ts` — shadow cache, load/save functions, write lock
- `src/App.tsx` — immediate save effect, debounced auto-save, bootstrap eager re-save
- `src/stores/sessionWriteLock.ts` — session-specific write lock pattern

## Key Files

| File | Key | Purpose |
|------|-----|---------|
| `quack-agents.json` | `agents` | Array of UnifiedAgent objects |
| `quack-agents.json` | `sessions` | Array of AgentSession objects |
| `quack-agents.json` | `version` | Storage format version |
