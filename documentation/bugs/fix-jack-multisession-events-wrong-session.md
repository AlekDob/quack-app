---
type: bug
project: quack-app
created: 2026-05-27
last_verified: 2026-05-27
tags: [jack, multi-session, race-condition, active-state, ws07]
---

# Jack multi-session — eventi assistente atterrano nella sessione sbagliata

## Sintomo

Con Jack aperto e una chat in streaming:
1. Utente invia "ciao" nella sessione A
2. Mentre lo stream e' in corso, clicca "+ Nuova chat" -> crea sessione B
3. Risposta dell'assistente atterra nella sessione B (sbagliato!)
4. Sessione A contiene solo il messaggio utente "ciao" senza risposta
5. Sessione B contiene solo la risposta dell'assistente senza nessun input utente

Risultato: dati corrotti, UI confusa, persistenza compromessa (jack-sessions.json salva lo stato sbagliato).

Stesso bug se l'utente cambia sessione attiva tramite click in sidebar durante lo stream.

## Root cause

In `src/hooks/useJackChat.ts`, sia il messaggio utente che gli eventi assistente erano scritti via `appendToActive`:

```ts
store.appendToActive(userItem);  // user msg
...
useJackStore.getState().appendToActive({ kind: 'event', event: claudeEvent, ... });  // stream events
```

L'implementazione di `appendToActive` nel jackStore leggeva `activeSessionId` AL MOMENTO della chiamata:

```ts
appendToActive: (item) => {
  const { activeSessionId } = get();  // <-- valore corrente, non quello iniziale
  ...
}
```

Se l'utente cambiava `activeSessionId` durante lo stream (cambio sessione o nuova chat), gli eventi assistente venivano scritti sulla sessione attualmente attiva — non sulla sessione che aveva originato la richiesta.

## Fix

Aggiungere `appendToSession(sessionId, item)` allo store che scrive su una sessione specifica per ID. Catturare `sessionId = session.id` all'inizio di `sendMessage` e usarlo per tutti gli append (utente + eventi):

```ts
// jackStore.ts
appendToSession: (sessionId, item) => {
  set((s) => ({
    sessions: s.sessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, timeline: [...sess.timeline, item], updatedAt: Date.now() }
        : sess
    ),
  }));
},

// useJackChat.ts
const sessionId = session.id;  // capture once
...
store.appendToSession(sessionId, userItem);
...
useJackStore.getState().appendToSession(sessionId, { kind: 'event', ... });
```

`appendToActive` rimosso interamente (era dead code dopo la migrazione).

## Secondo sintomo correlato — indicatore "sta pensando" cross-sessione

Anche con `appendToSession` fixato, l'utente segnala: "Jack sta pensando..." compare in TUTTE le sessioni, non solo in quella che sta streamando. Stesso per il bottone Stop (che appare anche su sessioni inattive).

Root cause: in `useJackChat.ts`, `isStreaming` e' uno `useState` a livello hook — singleton per la componente `JackChat`. Non e' per-sessione. Il check `{isStreaming && <Indicator />}` mostra l'indicatore ovunque.

Fix: aggiunto `streamingSessionId: string | null` a `jackStore`. `sendMessage` lo setta a `sessionId` quando lo stream parte, `null` nel `finally` e in `stopStreaming`. `JackChat` calcola:

```ts
const isThisSessionStreaming = isStreaming && streamingSessionId === activeSessionId;
```

E usa `isThisSessionStreaming` per gate dell'indicatore e del bottone Stop. Il bottone Invia rimane visibile su altre sessioni ma disabilitato + tooltip "Un'altra sessione sta streamando, aspetta..." quando `isStreaming` globale e' true (preveniamo send concorrenti — un solo stream alla volta per Jack).

## Pattern generale

**Async callback che scrive in uno store DEVE catturare l'identita' target (sessionId, agentId, ecc.) come variabile locale all'inizio dell'operazione, mai leggerla dallo store al momento della scrittura.**

Stesso pattern di:
- `bug-delayed-agent-message-stale-closure.md`
- `fix-stale-closure-pointerup-lasso.md`

Quando l'UI permette al user di switchare contesto durante un'operazione async (streaming, fetch, timer), il "current" state dello store non rappresenta piu' il target originale.

## Files

- `src/hooks/useJackChat.ts:92,114` — usa `appendToSession(sessionId, ...)`
- `src/stores/jackStore.ts:122` — nuovo metodo `appendToSession`, rimosso `appendToActive`

## Breadcrumb

```ts
// Brain: fix-jack-multisession-events-wrong-session
const sessionId = session.id;
store.appendToSession(sessionId, userItem);
```
