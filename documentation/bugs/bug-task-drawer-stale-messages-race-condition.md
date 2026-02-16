---
type: bug
created: 2026-01-12
tags: [react, persistence, race-condition, state-management]
---

# bug-task-drawer-stale-messages-race-condition

**Problema**: TaskDrawer mostrava messaggi vecchi invece dell'ultima risposta dell'assistente

**Root Cause**: Race condition tra persistenza e caricamento dei messaggi nel TaskDrawer

**Causa 1 - Fire-and-forget save**: `saveKanbanChatSession` veniva chiamata senza `await`, quindi il salvataggio su disco non era garantito prima che l'utente chiudesse il drawer

**Causa 2 - Stale state read**: `chatSessions.get()` leggeva lo state PRIMA che React facesse il flush dell'update di `setChatSessions`

**Timeline problematica**: 1) Messaggio aggiunto a chatSessions Map (in memory) → 2) saveKanbanChatSession() inizia a scrivere su disco (async) → 3) setChatSessions ritorna PRIMA che il file sia scritto → 4) Quando clicki il task → selectTask carica messaggi STALI dal disk

**File coinvolti**: src/App.tsx linea 2681-2688 (sendMessageForTargetAgent), linea 2394-2411 (saveKanbanChatSession), linea 7806-7862 (selectTask)

**Fix applicata**: Invece di leggere dallo state React dopo setState, costruire i messaggi manualmente usando variabili locali (currentMessages, userMessage, response.result) e await il salvataggio

**Codice prima (problematico)**: `setChatSessions((prevSessions) => { saveKanbanChatSession(targetAgentId, updatedMessages, response.session_id); return prevSessions; });` - fire-and-forget!

**Codice dopo (corretto)**: Costruzione manuale di `finalUserMessage` e `finalAssistantMessage` con variabili locali, poi `await saveKanbanChatSession(targetAgentId, messagesToSave, response.session_id);`

**Pattern learned**: Quando si salva stato React su disco: 1) NON leggere dallo state React dopo un setState (potrebbe essere stale) 2) COSTRUIRE i dati da salvare usando variabili locali 3) AWAIT sempre le operazioni di persistenza prima di procedere
