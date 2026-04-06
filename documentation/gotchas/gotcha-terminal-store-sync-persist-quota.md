---
type: gotcha
project: quack-app
created: 2026-04-06
last_verified: 2026-04-06
tags: [zustand, persist, localstorage, quota, terminals, sync]
---

# Terminal store sync + persist = QuotaExceededError

## Problem

Syncing `terminals[]` from App.tsx `useState` into `useTerminalStore` (Zustand with `persist`) triggers localStorage writes on every terminal change. If localStorage is near quota → `QuotaExceededError` crashes the app.

## Why

`terminalStore` uses `persist()` with `partialize`. If `terminals` is included in `partialize`, every sync writes all agent data to localStorage. With 20+ agents, this fills up fast alongside sessionStore, settingsStore, etc.

## Fix

Exclude runtime-synced fields from `partialize`:

```typescript
partialize: (state) => ({
  // terminals + activeId NOT persisted — synced from App.tsx at runtime
  projectTerminals: state.projectTerminals.map(t => ({ ... })),
  manualProjects: state.manualProjects,
}),
```

## Rule

When syncing App.tsx state → Zustand store for component access:
1. ALWAYS exclude the synced fields from `partialize`
2. The store is a **read cache**, not the source of truth
3. Source of truth = App.tsx `useState` → synced via `useEffect`

## Files

- `src/stores/terminalStore.ts` — persist config, `partialize` section
- `src/App.tsx` — sync useEffect near `terminalsRef.current = terminals`
