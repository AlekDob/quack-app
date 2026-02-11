---
type: bug_fix
project: quack-app
created: 2026-02-11
tags: [notification, ui, sidebar, chat, sessions-first]
---

# Bug Fix: "Quack quack..." badge showing on all agents at startup

## Problem

All'avvio dell'app, il badge "Quack quack..." (💬) appariva su tutti gli agenti che avevano sessioni con messaggi pre-esistenti, anche se l'utente non aveva ricevuto nuovi messaggi.

**Root cause**: `lastReadTimestamps` era inizializzato come `Map` vuota. Quando le sessioni venivano caricate con messaggi dell'assistente, il confronto `lastAssistantTimestamp > lastReadTimestamp` diventava `qualsiasi_timestamp > 0` = `true`.

## Symptoms

- Badge 💬 visibile su tutti gli agenti all'avvio
- Tooltip "Quack quack..." appare anche su sessioni vecchie
- Non ha senso mostrare notifiche per messaggi già visti

## Solution

**File**: `src/App.tsx` (dentro l'initialization useEffect)

Dopo il caricamento dei terminali al boot (`setTerminals(recreated)`), inizializza `lastReadTimestamps` con `Date.now()` per tutti gli agenti:

```typescript
// SIMPLE: Just load terminals - no migration needed!
setTerminals(recreated);

// 🔵 Initialize lastReadTimestamps to NOW for all agents at boot
// This prevents "Quack quack..." badge from showing on pre-existing sessions
// Badge should only appear for NEW messages received after app startup
const bootTimestamp = Date.now();
setLastReadTimestamps((prev) => {
  const updated = new Map(prev);
  for (const terminal of recreated) {
    if (!updated.has(terminal.id)) {
      updated.set(terminal.id, bootTimestamp);
    }
  }
  return updated;
});
```

## How it works

1. **At boot**: Tutti i terminali vengono marcati come "letti" al momento dell'avvio
2. **Pre-existing messages**: Considerati "già letti" (timestamp < bootTimestamp)
3. **New messages**: Solo messaggi ricevuti DOPO l'avvio fanno apparire il badge

## Related Code

- **Badge logic**: `src/components/RepositoryGroup.tsx` (SortableAgent + worktree section)
- **Condition**: `showNotificationBadge = lastAssistantTimestamp > lastReadTimestamp`
- **Mark as read**: `src/App.tsx` useEffect che monitora `activeId`

## Tested

- ✅ Badge non appare all'avvio per sessioni vecchie
- ✅ Badge appare correttamente quando l'agente risponde dopo l'avvio
- ✅ Badge scompare quando si clicca l'agente (mark as read)
