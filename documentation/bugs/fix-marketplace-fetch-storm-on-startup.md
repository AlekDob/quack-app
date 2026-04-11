---
type: bug_fix
project: quack-app
created: 2026-04-11
last_verified: 2026-04-11
tags: [react, hooks, marketplace, performance, network]
---
# Fix: Marketplace fetch storm — 300+ HTTP requests on startup

## Problem

The `useMarketplace` hook originally contained a `useEffect` that auto-called `loadResources()` on mount. Since multiple components use this hook independently (`App.tsx`, `QuackStoreDrawer`, `MarketplaceDrawer`, `AgentSelector`, `NewTerminalModal`), **every mount triggered its own full marketplace load**.

Each `loadResources()` call fires a cascade of HTTP requests:
1. `marketplace.json` (1 request)
2. `plugin.json` for each plugin (N requests)
3. `.md` description file for each enrichable resource — skills, commands, agents, droids, rules (M requests)
4. `checkInstalledResources` doing filesystem probes for every resource without a registry entry

With ~15 plugins and ~20 enrichable resources, a single call produces ~36 HTTP requests. Multiple hook instances firing concurrently (before the `_loading` guard existed) could easily exceed **300+ parallel fetch requests** on startup, saturating the network and causing visible UI lag.

## Solution

Two-part fix applied in `src/hooks/useMarketplace.ts`:

### 1. Removed auto-load from hook internals
The `useEffect(() => { loadResources(); }, [])` that was inside the hook body was removed entirely. Consumers now **explicitly call `loadResources()`** when they need data:

```typescript
// QuackStoreDrawer.tsx — conditionally rendered, mount = drawer open
useEffect(() => { loadResources(); }, [loadResources]);

// NewTerminalModal.tsx — only loads when modal is open
useEffect(() => { if (open) loadResources(); }, [open, loadResources]);

// AgentSelector.tsx — conditionally rendered, mount = visible
useEffect(() => { loadResources(); }, [loadResources]);
```

`App.tsx` destructures only `installAgentBundle` and **never calls `loadResources()`**, so the top-level hook instance creates no network traffic.

### 2. Module-level concurrency guard
A module-scoped `_loading` flag prevents multiple hook instances from firing concurrent loads:

```typescript
let _loading = false;

const loadResources = useCallback(async () => {
  if (_loading) return;  // Skip if another instance is already loading
  _loading = true;
  // ... fetch cascade ...
  _loading = false;
}, []);
```

This ensures that even if two drawers/selectors mount simultaneously, only one fetch cascade executes.

## Key Insight

React hooks are **per-instance** — every component calling `useMarketplace()` gets its own `useState` and `useEffect`. An auto-loading `useEffect` inside a custom hook becomes a **multiplier**: N consumers = N independent load cascades. For hooks that trigger expensive I/O, **always externalize the trigger** and let consumers decide when to load.

The module-level `_loading` guard is a pragmatic secondary defense, but the primary fix is architectural: the hook exposes `loadResources()` as an explicit API rather than auto-firing on mount.

## Related Files

- `src/hooks/useMarketplace.ts` — hook with fix (lines 130–131 guard, line 1003 comment)
- `src/App.tsx` — uses hook but never calls `loadResources()`
- `src/components/QuackStoreDrawer.tsx` — calls `loadResources()` on drawer mount
- `src/components/MarketplaceDrawer.tsx` — calls `loadResources()` on drawer mount
- `src/components/AgentSelector.tsx` — calls `loadResources()` on selector mount
- `src/components/NewTerminalModal.tsx` — calls `loadResources()` only when `open=true`
