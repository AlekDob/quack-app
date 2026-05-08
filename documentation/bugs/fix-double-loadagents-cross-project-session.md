---
type: bug
project: quack-app
created: 2026-05-06
last_verified: 2026-05-06
tags: [performance, react, hooks, deps-cascade, session-switch, app-tsx]
---
# Double `loadAgents` on cross-project session switch

## Symptom
Clicking a session in a different project produced two consecutive `[loadAgents] 🦆 Loading agents` logs (and two `check_agents_directory` + `list_agents` Tauri round-trips). Same noise visible for `loadAvailableSkills` (3 chiamate) and a `[Tab Update]` cascade — partly due to this effect, partly to other multi-mount components.

Reproduction: open Agent A on Project X, then click a session of Agent B on Project Y from the sidebar. Watch the console.

## Root Cause
Classic "deps a cascata" between a `useCallback` and a `useEffect`.

`loadAgents` was declared as:
```ts
const loadAgents = useCallback(async () => {
  const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);
  // ...invoke check_agents_directory + list_agents...
}, [tauriAvailable, activeTerminal?.cwd, explorerPath]);
```

So a new `loadAgents` identity is produced on every change of `activeTerminal?.cwd` OR `explorerPath`.

The reload effect was:
```ts
const currentWorkingDir = activeTerminal?.cwd ?? explorerPath;
useEffect(() => {
  if (!tauriAvailable || !hasBootstrapped || !currentWorkingDir) return;
  void loadAgents();
}, [currentWorkingDir, tauriAvailable, hasBootstrapped, loadAgents]);
```

`handleSessionClick` mutates state in two cascading steps:
1. `setActiveId(session.agentId)` → `activeTerminal.cwd` changes (e.g. studio-futuro → spaceship). `loadAgents` is recreated. Effect dep `loadAgents` differs → effect fires. Inside `loadAgents`, `explorerPath` is still the old value but `getEffectiveWorkingDir(cwd, explorerPath)` returns `cwd` (priority), so the result is correct — just one unnecessary call.
2. `loadDirectory(session.projectPath)` → `explorerPath` changes. `loadAgents` is recreated again. Effect dep `loadAgents` differs → effect fires again. Same output, second redundant call.

Note: `currentWorkingDir` itself does NOT change between the two steps in this scenario (cwd has priority and is already `spaceship` after step 1). The duplication is *entirely* due to `loadAgents` being in the deps.

## Fix
Drop `loadAgents` from the effect deps with an `eslint-disable`, mirroring the pattern already in place for the sibling `loadSkills` effect a few lines below:

```ts
useEffect(() => {
  if (!tauriAvailable || !hasBootstrapped || !currentWorkingDir) return;
  void loadAgents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentWorkingDir, tauriAvailable, hasBootstrapped]);
```

Now the effect re-runs only when `currentWorkingDir` actually changes value. Stale-closure risk is bounded: `loadAgents` reads `activeTerminal?.cwd` and `explorerPath` from its own closure; even if those are slightly stale at call time, `getEffectiveWorkingDir` gives `cwd` priority, so the resolved path matches the freshly-changed `currentWorkingDir`.

## Files
- `src/App.tsx` — effect at line ~7195

## Why not stabilise `loadAgents` with refs instead?
Cleaner long-term, but has 8 callsites (`App.tsx:7002, 7147, 7188, 7200, 7220, 7226, 11982, 13498`) and a deeper refactor — not warranted for the symptom. The eslint-disable matches the established pattern in the same file.

## Outstanding (related, not fixed here)
- `loadAvailableSkills` fires 3× per session switch (likely several `ChatInput` instances each with a `useEffect([basePath])`).
- `unifiedAgentStorage Saved 47 agents` fires 3× per session switch (some store subscriber persists on every render).
- `[Tab Update] Setting tab to: Agent Jack` fires 4× and `TerminalActivityBar isActive: false` cascades for many agents — sidebar/activity-bar re-renders too aggressive.

These remain after the fix and contribute to the residual "scattoso" feeling.

## Related
- `documentation/bugs/fix-token-stats-panel-blocks-project-switch.md` — sibling perf fix from the same session
- `documentation/bugs/bug-delayed-agent-message-stale-closure.md` — same "stale closure in deps" family
