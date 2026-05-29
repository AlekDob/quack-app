---
type: bug
project: quack-app
created: 2026-05-28
last_verified: 2026-05-28
tags: [sdk-0.3, task-tools, todowrite, react, rendering, reconciliation]
---

# Bug: TodoWrite widget shows 0/N completed — TaskUpdate orphaned (SDK 0.3.150)

## Sintomo

Dopo l'upgrade `@anthropic-ai/claude-agent-sdk` a 0.3.150, il widget TodoWrite mostra il counter corretto di task con i subject visibili, ma lo status rimane `pending` per tutti (0/N completed). TaskUpdate events non aggiornano lo status.

## Root cause

L'SDK 0.3.150 gestisce i Task tools (TaskCreate, TaskUpdate, TaskList, TaskGet) internamente come "managed tools". Quando il modello chiama `TaskCreate`, l'SDK:
1. Emette l'evento `assistant` con il `tool_use` block (visibile nello stream)
2. Crea il task internamente e genera un `task.id` reale (es. `task-abc123`)
3. Ritorna il `tool_result` al modello ma **NON lo emette come evento `user` nello stream**

Il `taskAccumulator.ts` dipendeva dal `tool_result` per estrarre il `task.id` reale:
```ts
const rawResult = toolResults.get(c.id); // → undefined (no user event emitted)
const parsed = parseJsonSafe(rawResult);  // → null
const realTaskId = parsed?.task?.id;      // → undefined
const id = realTaskId ?? `pending-${c.id}`; // → always pending-*
```

Quando poi arriva `TaskUpdate(taskId: "task-abc123")`, cerca `byId.get("task-abc123")` che non esiste (l'entry e' keyed come `pending-toolu_xxx`). L'orphan guard (dal fix precedente `fix-task-accumulator-toolresult-text-mismatch`) lo skippa → status mai aggiornato.

## Fix

Aggiunto meccanismo di riconciliazione in `taskAccumulator.ts`:
1. TaskCreate: se `realTaskId` non disponibile, aggiunge il `toolUseId` a `unresolvedPending[]` (in ordine di creazione)
2. TaskUpdate: se `byId.get(taskId)` fallisce, prende il primo entry da `unresolvedPending`, rimappa `pending-${toolUseId}` → `taskId` reale in `byId` e `order`
3. Procede con l'update normalmente

Questo funziona perche' il modello crea e aggiorna i task nello stesso ordine sequenziale.

Il path originale via `toolResultTexts` e' preservato come primary — se una futura versione SDK ricomincia a emettere tool_result come user events, il mapping diretto ha precedenza.

## Relazione con fix-task-accumulator-toolresult-text-mismatch

Il fix precedente (2026-05-27) risolveva un type mismatch (`Map<string, any>` vs `Map<string, string>`) aggiungendo `toolResultTexts`. Questo fix e' ancora necessario per il caso in cui il tool_result arrivi effettivamente. La riconciliazione qui e' un **fallback** per quando il tool_result non arriva affatto.

## Related files

- `src/utils/taskAccumulator.ts:63-68` — unresolvedPending declaration
- `src/utils/taskAccumulator.ts:128-153` — reconciliation logic in TaskUpdate
- `src/components/StreamMessage.tsx:438-468` — toolResultTexts extraction (still needed)

## Verifica

1. Avviare una sessione dove l'agente usa TaskCreate 5-7 volte e poi TaskUpdate
2. Il widget TodoWrite deve mostrare status corretto (in_progress / completed)
3. Il counter "X/Y completed" deve aggiornarsi in tempo reale
4. Abilitare `window.__TODO_DEBUG__ = true` nella console per vedere i log di riconciliazione
