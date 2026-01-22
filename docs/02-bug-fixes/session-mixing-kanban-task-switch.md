# Bug Fix: Session Mixing quando si clicca su Task dalla Kanban

**Data**: 2026-01-20
**Severity**: Critical
**Status**: Fixed

## Sintomo

Quando l'utente clicca su diversi task nella Kanban board, i messaggi di sessioni diverse vengono mostrati nella stessa chat view. Due session ID diverse appaiono mischiate nella stessa conversazione.

## Root Cause

Due state variables indipendenti (`activeTaskId` e `activeSessionId`) gestivano la sessione corrente senza mutual exclusion:

```typescript
// App.tsx:423-426
const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
```

Il problema era amplificato da:

1. **Fallback pericoloso**: `chatKey = activeSessionId || activeId` poteva puntare a sessioni diverse quando `activeSessionId` non era ancora aggiornato
2. **Dual fetch paths**: `currentAgentMessages` e `activeTaskMessages` leggevano da chiavi diverse
3. **Aggiornamenti asincroni**: I setter di React non sono sincronizzati atomicamente

## Flusso del Bug

```
Click Task A → activeSessionId = A, activeTaskId = A ✓
Click Task B rapidamente → activeSessionId = B (pending), activeTaskId = B ✓
                         └─ Ma activeId potrebbe essere ancora A!
Re-render → chatKey = activeSessionId || activeId
          └─ Se activeSessionId non è aggiornato, usa activeId vecchio!
```

## Soluzione Implementata

### 1. Funzioni Wrapper Exclusive (App.tsx:428-448)

```typescript
// Quando si setta activeTaskId, viene automaticamente clearato activeSessionId
const setActiveTaskIdExclusive = useCallback((taskId: string | null) => {
  console.log(`[SESSION-FIX] setActiveTaskIdExclusive: ${taskId}`);
  setActiveTaskId(taskId);
  if (taskId !== null) {
    setActiveSessionId(null); // ← MUTUAL EXCLUSION
    console.log(`[SESSION-FIX] Cleared activeSessionId because activeTaskId is now: ${taskId}`);
  }
}, []);

// E viceversa
const setActiveSessionIdExclusive = useCallback((sessionId: string | null) => {
  console.log(`[SESSION-FIX] setActiveSessionIdExclusive: ${sessionId}`);
  setActiveSessionId(sessionId);
  if (sessionId !== null) {
    setActiveTaskId(null); // ← MUTUAL EXCLUSION
    console.log(`[SESSION-FIX] Cleared activeTaskId because activeSessionId is now: ${sessionId}`);
  }
}, []);
```

### 2. Rimosso Fallback Pericoloso (App.tsx:3674)

```typescript
// PRIMA (pericoloso):
const chatKey = activeSessionId || activeId;

// DOPO (sicuro):
const chatKey = activeSessionId; // REMOVED || activeId fallback
```

### 3. Guard in currentAgentMessages (App.tsx:3677-3680)

```typescript
const currentAgentMessages = useMemo(() => {
  // Se activeTaskId è settato, ritorna vuoto (i task hanno i loro messaggi separati)
  if (activeTaskId) {
    console.log(`[ChatView] activeTaskId is set (${activeTaskId}), returning empty for currentAgentMessages`);
    return [];
  }
  const messages = chatKey ? (chatSessions.get(chatKey) ?? []) : [];
  return messages;
}, [chatKey, chatSessions, activeSessionId, activeTaskId]);
```

### 4. Sostituito tutti i setter diretti con versioni exclusive

| Funzione | Modifica |
|----------|----------|
| `handleSessionClick` | Usa `setActiveSessionIdExclusive` |
| `handleSelectTerminal` | Usa `setActiveSessionIdExclusive` |
| `openTaskTab` | Usa `setActiveTaskIdExclusive` |
| `selectTask` | Usa `setActiveTaskIdExclusive` |

## Come Funziona Ora

```
Click su Session (sidebar) → setActiveSessionIdExclusive(sessionId)
                           → activeSessionId = sessionId ✓
                           → activeTaskId = null ✓ (cleared automaticamente)
                           → chatKey = sessionId ✓ (singola source of truth)

Click su Task (kanban) → setActiveTaskIdExclusive(taskId)
                       → activeTaskId = taskId ✓
                       → activeSessionId = null ✓ (cleared automaticamente)
                       → isTaskChat = true ✓
                       → usa taskMessages invece di currentAgentMessages ✓
```

## File Modificati

- `src/App.tsx`:
  - Linee 428-448: Nuove funzioni wrapper exclusive
  - Linea 3674: Rimosso fallback `|| activeId`
  - Linee 3677-3680: Guard per activeTaskId
  - `handleSessionClick`: Usa `setActiveSessionIdExclusive`
  - `handleSelectTerminal`: Usa `setActiveSessionIdExclusive`
  - `openTaskTab`: Usa `setActiveTaskIdExclusive`
  - `selectTask`: Usa `setActiveTaskIdExclusive`

## Test

Per verificare il fix:

1. Apri un task dalla Kanban
2. Clicca su una sessione nella sidebar
3. Torna al task dalla Kanban
4. Verifica che i messaggi NON si mischiano più

## Lezioni Apprese

1. **Mutual exclusion**: Quando due state variables gestiscono lo stesso concetto (quale chat mostrare), devono essere mutualmente esclusive
2. **Niente fallback**: I fallback `||` possono causare race conditions
3. **Single source of truth**: Meglio usare una sola variabile che due con logica di fallback
4. **Guard clauses**: Aggiungere guard all'inizio delle funzioni per gestire stati inattesi
