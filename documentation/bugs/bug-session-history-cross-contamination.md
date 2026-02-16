---
type: bug_fix
created: 2026-02-06
tags: [sessions, chat, conversation-history, race-condition]
---

# Bug: Session History Cross-Contamination

## Problema

Quando l'utente aveva due sessioni (A e B) dello stesso agente e switchava velocemente tra loro, le risposte apparivano nel contesto sbagliato:

- L'utente mandava un messaggio nella sessione B
- Claude rispondeva parlando di argomenti della sessione A
- La risposta appariva nella UI corretta (sessione B), ma il contenuto era contaminato dal contesto di A

**Esempio concreto** (riportato dall'utente):
> "Mi fa una domanda, dico si' procedi, e mi risponde con l'argomento dell'altra sessione che non centrava nulla con la cosa precedente, e nell'altra sessione continua intanto normalmente"

## Root Cause

**`chatConversationHistoryRef`** in `App.tsx` era una `Map<agentId, history[]>` invece che `Map<sessionId, history[]>`.

Tutte le sessioni dello stesso agente condividevano lo stesso storico di conversazione:

```typescript
// PRIMA (sbagliato)
const agentHistory = chatConversationHistoryRef.current.get(capturedAgentId) ?? [];
// Sessione A e B dello stesso agente → STESSA chiave → STESSA history

// Quando mandavi messaggio in sessione B:
// 1. Sistema legge history con chiave agentId → ottiene storico di A
// 2. Costruisce prompt: history di A + "si' procedi" di B
// 3. Claude risponde nel contesto di A
```

Il sistema Session-First (implementato nella 0.5.0) usa `sessionId` come chiave per `chatSessions`, ma il ref della conversation history era rimasto con la vecchia chiave `agentId` → **architettura mista**.

## Soluzione

**Fase 1 — Fix critico** (3 modifiche in `App.tsx`):

| Riga | Funzione | Chiave prima | Chiave dopo |
|------|----------|--------------|-------------|
| 2218 | `sendMessageForAgent` | `capturedAgentId` | `messageKey` (= `activeSessionId`) |
| 2328 | `sendMessageForAgent` | `capturedAgentId` | `messageKey` |
| 3440 | `clearCurrentAgentConversation` | `activeId` | `activeSessionId \|\| activeId` |

```typescript
// DOPO (corretto)
const messageKey = activeSessionId; // Session ID catturato a inizio funzione
const agentHistory = chatConversationHistoryRef.current.get(messageKey) ?? [];
// Sessione A e B → chiavi diverse → history isolate
```

**Effetto**:
- Ogni sessione ha il suo storico di conversazione isolato
- Il prompt inviato a Claude contiene solo il contesto della sessione corrente
- Zero bleed tra sessioni dello stesso agente

## Problemi Secondari Trovati

L'analisi ha rilevato altre 5 issue di severita' alta/media (non ancora fixate):

| # | Severita' | Problema | File:Riga |
|---|----------|----------|-----------|
| 2 | ALTO | `abortStreamForAgent` legge `activeSessionId` at call-time invece che capture-time | `App.tsx:2500` |
| 3 | ALTO | RepositoryGroup usa `chatSessions.get(agent.id)` (chiave sbagliata) | `RepositoryGroup.tsx:1301,2140,2205` |
| 4 | ALTO | Multi-listener result handler usa `chatSessions.get(agentId)` (chiave sbagliata) | `App.tsx:1737` |
| 5 | MEDIO | Rust fallback `agent_id` quando manca `session_key` | `claude_cli.rs:1036-1043` |
| 6 | MEDIO | Race condition nella lazy hydration con switch rapido | `App.tsx:470-504` |

## File Modificati

1. `src/App.tsx` — 3 edit per cambio chiave `chatConversationHistoryRef`

## Pattern Estratto

**Session Isolation Pattern**: quando passi da un'architettura Agent-First (chiave = agentId) a Session-First (chiave = sessionId), verifica che TUTTI i ref/map/store usino la chiave corretta. Fai grep di `.get(agentId)` e `.set(agentId)` per trovare leak.
