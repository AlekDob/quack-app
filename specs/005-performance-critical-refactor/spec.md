# Feature Specification: Performance Critical Refactor

**Feature Branch**: `005-performance-critical-refactor`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: Performance audit findings from code-explorer + code-reviewer droids (17 issues, 3 critical, 7 high)

## Problem Statement

Quack soffre di rallentamenti significativi su Mac e Windows causati da:
1. **App.tsx God Component** (14.284 righe, 73 useState) che ri-renderizza l'intero albero ad ogni cambio di stato
2. **Doppia sorgente di verita per chatSessions** con sync loop O(N) che genera centinaia di set() Zustand/sec durante streaming
3. **Tree-shaking disabilitato** che gonfia il bundle di 2-3x (PixiJS 76MB, Mermaid 68MB, OpenAI 13MB dead code)
4. **Rendering non ottimizzato** (MessageList non virtualizzata, polling filesystem, 327 console.log in hot path)

L'impatto combinato: +200-500ms per interazione, +1-3s startup, CPU spike durante streaming, DOM con decine di migliaia di nodi per sessioni lunghe.

## User Scenarios & Testing

### User Story 1 - Streaming fluido durante chat agente (Priority: P1)

L'utente avvia una sessione con un agente Claude. Durante lo streaming della risposta (che puo durare 30-120 secondi), l'UI deve restare reattiva: scroll fluido, sidebar cliccabile, tab switching immediato. Oggi durante lo streaming pesante l'app lagga visibilmente.

**Why this priority**: Lo streaming e' l'interazione piu frequente e piu lunga. Ogni utente la sperimenta centinaia di volte al giorno.

**Independent Test**: Avviare un agente, chiedergli un task complesso (generazione codice lungo), e durante lo streaming provare a: scrollare la chat, cliccare su un altro agente nella sidebar, switchare tab. Tutto deve essere istantaneo.

**Acceptance Scenarios**:

1. **Given** un agente in streaming con 100+ messaggi nella sessione, **When** l'utente scrolla la chat, **Then** lo scroll e' fluido a 60fps senza jank
2. **Given** un agente in streaming, **When** l'utente clicca su un altro agente nella sidebar, **Then** il tab switch avviene in <100ms
3. **Given** 5 agenti attivi di cui 2 in streaming, **When** l'utente naviga tra le sessioni, **Then** non c'e lag percepibile

---

### User Story 2 - Startup rapido dell'app (Priority: P2)

L'utente apre Quack. L'app deve raggiungere lo stato "pronta all'uso" (interfaccia caricata, agenti precedenti ripristinati) il piu velocemente possibile. Oggi il bundle oversized causa un cold start lento.

**Why this priority**: La prima impressione conta. Un'app desktop che impiega 3+ secondi a caricare sembra rotta.

**Independent Test**: Chiudere Quack completamente, riaprirla, misurare il tempo dal click sull'icona alla prima interazione possibile.

**Acceptance Scenarios**:

1. **Given** Quack chiusa, **When** l'utente la apre, **Then** l'interfaccia e' interattiva in <2 secondi su Mac e <3 secondi su Windows
2. **Given** Quack con 10 agenti configurati, **When** l'utente la riapre, **Then** la sidebar mostra gli agenti in <1 secondo

---

### User Story 3 - Sessioni lunghe senza degradazione (Priority: P2)

L'utente lavora con Quack per ore. Con il passare del tempo e l'accumulo di messaggi, tab, e sessioni, l'app non deve rallentare. Oggi i memory leak (tabsByTerminal, listener non puliti) causano degradazione progressiva.

**Why this priority**: Gli utenti power (target principale) tengono Quack aperta tutto il giorno.

**Independent Test**: Usare Quack intensivamente per 2 ore: creare/eliminare agenti, aprire/chiudere tab, generare sessioni lunghe. Monitorare RAM e CPU. Non devono crescere oltre il 20% rispetto al valore iniziale.

**Acceptance Scenarios**:

1. **Given** Quack aperta da 2+ ore con uso intensivo, **When** si controlla il consumo RAM, **Then** e' <500MB (oggi arriva a 1GB+)
2. **Given** un agente eliminato, **When** si controllano le Map interne (tabsByTerminal, chatSessions), **Then** le entries relative sono state rimosse

---

### User Story 4 - PiP window performante con molti agenti (Priority: P3)

L'utente usa la Picture-in-Picture window per monitorare piu agenti. Con 10+ agenti attivi, la PiP deve aggiornarsi senza causare lag nella finestra principale.

**Why this priority**: Feature avanzata usata da utenti power con molti agenti paralleli.

**Independent Test**: Aprire PiP, avviare 10 agenti, 3 in streaming. Verificare che sia PiP che finestra principale restino responsive.

**Acceptance Scenarios**:

1. **Given** PiP aperta con 10 agenti, **When** 3 agenti streamano contemporaneamente, **Then** gli aggiornamenti PiP avvengono a max 2Hz senza impatto sulla finestra principale
2. **Given** PiP aperta, **When** updatePipAgents viene chiamato, **Then** non itera tutti i messaggi di tutte le sessioni ma usa dati pre-calcolati

---

### Edge Cases

- Cosa succede con 500+ messaggi in una sessione? (cap attuale, deve reggere senza crash)
- Come gestire agenti che streamano contemporaneamente su 3+ sessioni?
- Cosa succede se il filesystem watcher fallisce? (fallback a polling con intervallo piu lungo)
- Come reagisce l'app se un chunk lazy-loaded fallisce il caricamento?

## Requirements

### Functional Requirements

**Fase 1 - Quick Wins (no breaking changes)**:
- **FR-001**: Il build di produzione DEVE strippare tutti i console.log via Vite esbuild drop option
- **FR-002**: Il build DEVE riabilitare tree-shaking globale, isolando Mermaid in un chunk manuale con treeshake disabilitato solo per quel chunk
- **FR-003**: ChatView DEVE usare MessageListVirtualized per sessioni con 50+ messaggi
- **FR-004**: PipAgentCard DEVE essere wrappato in React.memo con comparatore custom su status e lastMessage

**Fase 2 - Stato e Streaming (refactor controllato)**:
- **FR-005**: chatSessions DEVE avere una singola sorgente di verita (chatStore Zustand), eliminando lo useState locale in App.tsx
- **FR-006**: chatStore DEVE esporre una action `setSession(sessionId, messages)` che fa un singolo `set()` Zustand
- **FR-007**: updatePipAgents DEVE essere throttled a max 2Hz (500ms) durante lo streaming
- **FR-008**: ZustandProvider DEVE essere eliminato; tutti i consumer devono usare selettori individuali
- **FR-009**: TerminalSidebar NON DEVE ricevere l'intera chatSessions Map come prop; ogni AgentSessionItem deve usare un selector Zustand puntuale

**Fase 3 - Refactor App.tsx (architetturale)**:
- **FR-010**: App.tsx DEVE essere spezzato in hooks dedicati per dominio (useAppState, useAgentLifecycle, useEventListeners, useStreamingHandlers)
- **FR-011**: Ogni hook estratto DEVE gestire il proprio stato isolato, riducendo i re-render cross-dominio dell'80%+
- **FR-012**: Le funzioni helper (normalizeModelName, etc.) DEVONO essere estratte a livello di modulo, non inline nel render

**Fase 4 - Infrastruttura**:
- **FR-013**: FileExplorer DEVE usare filesystem watcher Tauri nativo invece di polling 10s
- **FR-014**: useWhiteboardFile DEVE usare filesystem watcher invece di polling 2s
- **FR-015**: PixiJS e Mermaid DEVONO essere lazy-loaded (React.lazy + Suspense)
- **FR-016**: MCPProcessManager in mcp.rs DEVE usare tokio::sync::Mutex al posto di std::sync::Mutex
- **FR-017**: tabsByTerminal DEVE essere pulita quando un agente/terminale viene eliminato

### Key Entities

- **chatSessions**: Map<string, ChatMessage[]> - oggi duplicata in useState + Zustand, deve vivere solo in chatStore
- **tabsByTerminal**: Map<string, Tab[]> in uiStore - accumula entries senza cleanup
- **MCPProcessManager**: Rust struct con std::sync::Mutex che wrappa HashMap di child processes

## Success Criteria

### Measurable Outcomes

- **SC-001**: Tempo di startup (cold) ridotto del 40%+ (da ~4s a <2.5s su Mac)
- **SC-002**: Frame rate durante streaming mantenuto a 60fps (oggi cala a 20-30fps con sessioni lunghe)
- **SC-003**: Consumo RAM dopo 2 ore di uso intensivo <500MB (oggi 800MB-1.4GB)
- **SC-004**: Bundle size ridotto del 30%+ grazie a tree-shaking e lazy loading
- **SC-005**: Re-render count durante streaming ridotto dell'80%+ (misurabile con React DevTools Profiler)
- **SC-006**: Tab switch durante streaming <100ms (oggi 200-500ms)

## Out of Scope

- Riscrittura completa di App.tsx (solo estrazione incrementale di hooks)
- Migrazione a un framework diverso (Solid, Svelte, etc.)
- Ottimizzazioni GPU/WebGL
- Test automatici di performance (CI benchmark) - da fare in feature separata
- Refactor del sistema di streaming Claude SDK (stream-claude.js, claude_cli.rs)
