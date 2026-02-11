---
type: bug_fix
project: quack-app
created: 2026-02-11
tags: [notification, ui, sidebar, chat, sessions-first]
---

# Bug Fix: "Quack quack..." badge showing on all agents at startup

## Problem

All'avvio dell'app, il badge "Quack quack..." appariva su tutti gli agenti, anche quelli senza sessioni attive sotto di loro.

**Root causes** (two issues):

1. `lastReadTimestamps` era inizializzato come Map vuota - qualsiasi messaggio pre-esistente risultava "non letto" (`timestamp > 0 = true`)
2. `agentSessions` includeva sessioni con status `done` (archiviate) - i loro messaggi venivano contati per il badge anche se le sessioni sono nascoste nella sidebar

## Symptoms

- Badge e tooltip "Quack quack..." visibili su agenti senza sessioni visibili nella sidebar
- Appare sia in main che in worktree sections, su agenti di diversi progetti

## Solution (Two-Part Fix)

### Part 1: Boot timestamp initialization (`src/App.tsx`)

Inizializza `lastReadTimestamps` con `Date.now()` per tutti gli agenti al boot.

### Part 2: Filter done sessions (`src/components/RepositoryGroup.tsx`)

**This is the real fix.** Created `activeSessions` filtering out `status === "done"`:

```typescript
const activeSessions = useMemo(
  () => agentSessions.filter((s) => s.status !== "done"),
  [agentSessions],
);
```

All badge-related calculations (`isDormant`, `hasUnreadMessages`, `lastAssistantTimestamp`, `showNotificationBadge`) now use `activeSessions` instead of `agentSessions`.

Same fix applied to the worktree section using `activeSessionsWorktree`.

## Key Insight

The sidebar shows only non-done sessions (max 5), but the badge logic was counting ALL sessions including archived ones. This mismatch caused "phantom" notifications - badge visible but no sessions shown underneath.

## Related Code

- **Badge logic**: `src/components/RepositoryGroup.tsx` (SortableAgent + worktree section)
- **Active sessions filter**: `activeSessions = agentSessions.filter(s => s.status !== "done")`
- **Condition**: `showNotificationBadge = !isActive && !isDormant && activeSessions.length > 0 && lastAssistantTimestamp > lastReadTimestamp`
- **Boot init**: `src/App.tsx` initializes `lastReadTimestamps` with `Date.now()` for all agents
