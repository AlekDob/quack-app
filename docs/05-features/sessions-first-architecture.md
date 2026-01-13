# Sessions-First Architecture

> Documentazione completa per continuazione da parte di altro agente.
> Data: 2026-01-13

## Overview

Quack implementa un'architettura **Sessions-First** dove ogni agente può avere multiple sessioni di chat indipendenti, simile a WhatsApp.

## Architettura

### Stores Zustand

| Store | File | Scopo |
|-------|------|-------|
| `sessionStore` | `src/stores/sessionStore.ts` | Gestisce `AgentSession[]` |
| `chatStore` | `src/stores/chatStore.ts` | Gestisce `chatSessions` Map e `chatLoadingMap` |

### Tipi Chiave

```typescript
// src/types.ts
interface AgentSession {
  id: string;              // session-{timestamp}-{random}
  agentId: string;         // UUID dell'agente
  title: string;
  status: AgentSessionStatus; // 'todo' | 'in_progress' | 'done'
  claudeSessionId?: string;   // UUID da Claude API
  projectPath: string;
  projectName: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

### Activity Indicators

I pallini colorati indicano lo stato della sessione:

| Colore | Stato | Condizione |
|--------|-------|------------|
| **Grigio** `#6b7280` | Empty/Dormant | Nessun messaggio o nessun messaggio utente |
| **Giallo** `#f59e0b` | Working | `isLoading === true` |
| **Verde** `#22c55e` | Ready | Ultimo messaggio è assistant con `status === 'complete'` |

### "Quack quack..." Tooltip

- Appare quando: agent ha risposto E sessione NON è attiva
- Scompare quando: utente clicca sulla sessione (diventa attiva)
- Stile: tooltip bianco sopra il dot con animazione bounce

## File Principali

### `src/App.tsx`

**Loading state immediato (lines 1848-1858)**:
```typescript
const messageKey = activeSessionId;

// Set loading IMMEDIATELY when user presses Enter/Send
setChatLoadingMap((prev) => {
  const newMap = new Map(prev);
  newMap.set(messageKey, true);
  return newMap;
});
useChatStore.getState().setLoading(messageKey, true);
```

**Sync effect chatLoadingMap → chatStore (lines 856-860)**:
```typescript
useEffect(() => {
  chatLoadingMap.forEach((isLoading, sessionId) => {
    chatStoreSetLoading(sessionId, isLoading);
  });
}, [chatLoadingMap, chatStoreSetLoading]);
```

**Finally block che resetta loading (lines 2344-2351)**:
```typescript
finally {
  setChatLoadingMap((prev) => {
    const newMap = new Map(prev);
    newMap.delete(messageKey);
    return newMap;
  });
  useChatStore.getState().setLoading(messageKey, false);
}
```

### `src/stores/chatStore.ts`

**setLoading con debug log (lines 87-96)**:
```typescript
setLoading: (sessionId, loading) => set((state) => {
  console.log(`🦆 [chatStore.setLoading] sessionId=${sessionId}, loading=${loading}`);
  const newLoadingMap = new Map(state.chatLoadingMap);
  if (loading) {
    newLoadingMap.set(sessionId, loading);
  } else {
    newLoadingMap.delete(sessionId);
  }
  return { chatLoadingMap: newLoadingMap };
}),
```

### `src/components/AgentSessionItem.tsx`

**Logica dot color (lines 60-84)**:
```typescript
const isAgentReady = useMemo(() => {
  if (isLoading || chatMessages.length === 0 || isDormant) {
    return false;
  }
  const lastMessage = chatMessages[chatMessages.length - 1];
  if (lastMessage?.role !== 'assistant') {
    return false;
  }
  return lastMessage.status === 'complete' || lastMessage.status === undefined;
}, [chatMessages, isDormant, isLoading]);

const hasUnreadMessages = isAgentReady && !isActive;
const dotColor = getActivityDotColor(isLoading, isAgentReady, isChatEmpty || isDormant);
const showQuackBadge = hasUnreadMessages && !isActive;
```

### `src/components/RepositoryGroup.tsx`

**Sessioni sempre visibili (line ~1616)**:
```typescript
{/* Sessions under this agent - always visible */}
{onSessionClick && (
  <div className="agent-sessions-container">
    <AgentSessionList ... />
  </div>
)}
```
Rimosso il vecchio check `agent.id === activeId &&`.

### `src/components/AgentSessionList.tsx`

**Passa loading state a ogni item (lines 91-105)**:
```typescript
{visibleSessions.map((session) => {
  const isLoadingForSession = chatLoadingMap.get(session.id) ?? false;
  return (
    <AgentSessionItem
      ...
      isLoading={isLoadingForSession}
    />
  );
})}
```

---

## Bug Aperti

### BUG 1: Loading Indicator Resets to Gray

**Sintomo**: Il pallino giallo appare per ~1 secondo poi torna grigio mentre l'agente sta ancora lavorando.

**Debug log aggiunto**: In `chatStore.ts` c'è un log che traccia ogni chiamata a `setLoading`:
```
🦆 [chatStore.setLoading] sessionId=session-xxx, loading=true/false
```

**Possibili cause**:
1. Il sync effect (App.tsx:856-860) potrebbe interferire
2. Multiple places chiamano `setChatLoadingMap`:
   - Line 2638
   - Line 2856
   - Line 2966
   - Line 3053
   - Line 3117
   - Line 3202
3. Il finally block potrebbe eseguire troppo presto

**Prossimo step**: Verificare console output per vedere cosa chiama `setLoading(false)` prematuramente.

**Fix tentato**: Spostato il setting del loading IMMEDIATAMENTE dopo la validazione (line 1853), prima di qualsiasi operazione async.

---

## Task Pendenti

### TASK 1: Metro-Line UI

**Obiettivo**: Linea verticale stile metro che connette i dot delle sessioni sotto ogni agent card.

**File da modificare**:
- `src/components/AgentSessionItem.tsx`
- `src/components/AgentSessionList.tsx`
- `src/components/AgentSessionItem.css`

**Design reference**: Simile a Git timeline o metro map.

### TASK 2: Kanban Refactor to Sessions

**Obiettivo**: Unificare il sistema - le sessioni diventano i task del kanban.

**Modifiche richieste**:
1. Modificare `kanbanStore` per usare `sessionStore` come data source
2. Aggiornare componenti Kanban per renderizzare `AgentSession` invece di `KanbanTask`
3. Rimuovere/deprecare `kanbanStorage.ts`

**File da modificare**:
- `src/stores/kanbanStore.ts`
- `src/components/kanban/*.tsx`
- `src/services/kanbanStorage.ts`

---

## Fix Completati

| Fix | Descrizione | File |
|-----|-------------|------|
| ✅ Chat mixing | Aggiunto `sessionKey` agli eventi Rust per routing corretto | `src-tauri/src/claude_cli.rs` |
| ✅ Green dot | Separato `isAgentReady` da `hasUnreadMessages` | `AgentSessionItem.tsx` |
| ✅ Quack badge hide | Badge scompare quando `isActive === true` | `AgentSessionItem.tsx` |
| ✅ Sessions visible | Rimosso check `agent.id === activeId` | `RepositoryGroup.tsx` |
| ✅ Stale closure | Usato `useChatStore.getState()` invece di hook | `App.tsx` |

---

## Note per Continuazione

1. **Per debuggare il bug del loading**: Avvia l'app, invia un messaggio, guarda la console per i log `🦆 [chatStore.setLoading]`. Traccia cosa chiama `loading=false` troppo presto.

2. **Per la metro-line**: Aggiungi una linea verticale CSS nel container delle sessioni, posizionata a sinistra dei dot.

3. **Per il kanban refactor**: Parti da `kanbanStore.ts`, sostituisci `KanbanTask[]` con un getter che legge da `sessionStore`.
