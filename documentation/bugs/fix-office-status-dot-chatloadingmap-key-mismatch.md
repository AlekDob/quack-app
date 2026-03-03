---
type: gotcha
project: quack-app
created: 2026-03-03
last_verified: 2026-03-03
tags: [office-view, status-dot, chatLoadingMap, sessionId, agentId, key-mismatch]
---
# Fix: Office Status Dot Always Green (chatLoadingMap Key Mismatch)

## Problem

In the Office View (isometric PixiJS scene), the agent status dot stayed green (idle) even when the agent was actively working. Meanwhile, the sidebar session list correctly showed the amber (working) dot.

## Root Cause

Two different status signals in play:

1. **Sidebar** (`AgentSessionItem`): Uses `chatLoadingMap.get(session.id)` — keyed by **sessionId** (correct)
2. **TerminalInfo.status sync effect** (`App.tsx`): Used `chatLoadingMap.get(terminal.id)` — keyed by **agentId** (wrong!)

After the sessions-first architecture migration, `chatLoadingMap` keys changed from agentId to sessionId (`messageKey = activeSessionId`). But the sync effect that propagates loading state to `TerminalInfo.status` was never updated. Result: lookup always returned `undefined` → `isLoading = false` → `newStatus = 'idle'` → **overrides** the `'busy'` state set by `external-terminal-status` Tauri event.

Same issue for `chatSessions.get(terminal.id)` — also keyed by sessionId.

## Fix

In the sync effect, look up the agent's sessions from `useSessionStore` and check `chatLoadingMap` by sessionId:

```tsx
const allSessions = useSessionStore.getState().sessions;
const agentSessionIds = allSessions
  .filter(s => s.agentId === terminal.id)
  .map(s => s.id);

const isLoading = chatLoadingMap.get(terminal.id) === true ||
  agentSessionIds.some(sid => chatLoadingMap.get(sid) === true);
```

Same pattern for `chatSessions` messages lookup.

## Key Insight

When migrating map keys (agentId → sessionId), every consumer of the map must be updated. The sidebar was updated but the `TerminalInfo.status` sync effect was missed. The Office View, PiP agents, and any component reading `TerminalInfo.status` were all affected.

## Files

- `src/App.tsx` — sync effect (lines ~1710-1760)
- `src/components/office/OfficeDuck.tsx` — reads `agent.status` for dot color
