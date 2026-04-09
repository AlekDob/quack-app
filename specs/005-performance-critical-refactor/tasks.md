# Implementation Tasks: Performance Critical Refactor

## Phase 1: Quick Wins (no breaking changes)

- [x] 1.1 Strip console.log in produzione
  - Aggiungere `esbuild: { drop: ['console.log', 'console.debug'] }` in vite.config.ts build options
  - Verificare che console.warn e console.error restino attivi
  - Build e verificare che il bundle non contenga console.log
  - **Depends on**: None
  - **Requirement**: FR-001
  - **File**: `vite.config.ts`

- [x] 1.2 [P] Riabilitare tree-shaking con chunk Mermaid isolato
  - Rimuovere `treeshake: false` dalla rollup config in vite.config.ts
  - Aggiungere manualChunks che isola `mermaid` in chunk dedicato
  - Per il chunk mermaid, valutare se il bug class initialization persiste con treeshake attivo solo su quel chunk; se si, usare `external` o dynamic import
  - Misurare bundle size prima/dopo (target: -30%)
  - **Depends on**: None
  - **Requirement**: FR-002
  - **File**: `vite.config.ts`

- [x] 1.3 [P] Attivare MessageListVirtualized in ChatView
  - In ChatView.tsx, sostituire import di MessageList con MessageListVirtualized
  - Aggiungere logica condizionale: usare virtualizzata se messages.length > 50, altrimenti MessageList standard
  - Verificare che scroll-to-bottom, auto-scroll durante streaming, e scroll-to-top funzionino con react-window
  - **Depends on**: None
  - **Requirement**: FR-003
  - **File**: `src/components/ChatView.tsx`, `src/components/MessageListVirtualized.tsx`

- [x] 1.4 [P] Memoizzare PipAgentCard e fix onClick inline
  - Wrappare PipAgentCard con React.memo e comparatore custom: `prev.agent.status === next.agent.status && prev.agent.lastMessage === next.agent.lastMessage`
  - In PipWindow.tsx, sostituire `onClick={() => handleAgentClick(agent)}` con `onClickAgent={handleAgentClick}` prop
  - Dentro PipAgentCard, usare useCallback per gestire il click
  - Estrarre inline styles come costanti statiche a livello modulo
  - **Depends on**: None
  - **Requirement**: FR-004
  - **Files**: `src/components/PipAgentCard.tsx`, `src/components/PipWindow.tsx`

## Phase 2: Stato e Streaming

- [x] 2.1 Aggiungere setSession action al chatStore
  - Aggiungere `setSession: (sessionId: string, messages: ChatMessage[]) => void` al chatStore
  - Implementazione: singolo `set()` che fa `new Map(state.chatSessions).set(sessionId, messages)`
  - Aggiungere anche `removeSession(sessionId)` per cleanup
  - **Depends on**: None
  - **Requirement**: FR-006
  - **File**: `src/stores/chatStore.ts`

- [x] 2.2 Ottimizzare sync loop chatSessions -> chatStore
  - Sostituito clearSession + addMessage*N con singolo setSession() (da centinaia a 1 set()/sync)
  - useState locale mantenuto (60+ reference in App.tsx, refactor completo rimandato a Fase 3)
  - **Depends on**: 2.1
  - **Requirement**: FR-005 (parziale), FR-006
  - **File**: `src/App.tsx`

- [x] 2.3 [P] Throttle updatePipAgents durante streaming
  - Importare throttle da lodash-es (o implementare custom, ~10 righe)
  - Wrappare updatePipAgents con useMemo + throttle(fn, 500)
  - Separare le dipendenze del useEffect: chatLoadingMap per status, chatSessions solo quando streaming e' fermo
  - **Depends on**: None
  - **Requirement**: FR-007
  - **File**: `src/App.tsx` (righe ~4985-5040)

- [x] 2.4 [P] Estrarre normalizeModelName a livello modulo
  - Spostare normalizeModelName fuori dal componente App
  - Creare oggetto MODEL_LEGACY_MAP come costante a livello modulo
  - Spostare getCurrentAgentSettings se dipende solo da dati passabili come parametri
  - **Depends on**: None
  - **Requirement**: FR-012
  - **File**: `src/App.tsx` (riga ~5127) -> `src/utils/modelUtils.ts`

- [x] 2.5 Eliminare ZustandProvider (N/A - non montato)
  - ZustandProvider non e' mai importato/montato nell'albero componenti attivo
  - Usato solo in AppRefactored.tsx (legacy) e README.md
  - Nessun impatto performance reale — skip
  - **Depends on**: 2.2
  - **Requirement**: FR-008 (already satisfied)

- [ ] 2.6 Refactor TerminalSidebar: selector al posto di prop chatSessions (DEFERRED -> Phase 3)
  - Prop drilling va 4 livelli deep (Sidebar -> RepositoryGroup -> WorktreeAgentCard -> helpers)
  - Richiede refactor di 5+ componenti — piu adatto alla Fase 3 quando App.tsx viene spezzato
  - Il bottleneck del sync loop (2.2) e' gia risolto, riducendo l'impatto
  - **Depends on**: 2.2
  - **Requirement**: FR-009
  - **File**: `src/components/TerminalSidebar.tsx`

- [x] 2.7 [P] Ottimizzare handleScroll in MessageList
  - Estrarre `messages.some(m => m.role === 'user')` in useMemo separato
  - Rimuovere `messages` dalle dipendenze di useCallback handleScroll
  - Usare `hasUserMessages` (boolean stabile) come dipendenza
  - **Depends on**: None
  - **Requirement**: FR-003 (complementare)
  - **File**: `src/components/MessageList.tsx`

- [ ] 2.8 [P] Fix usePipWindow listener Tauri
  - Separare useEffect di inizializzazione store da registrazione listener
  - Registrare listener `pip-window-ready` e `pip-window-closing` con `[]` come dipendenza
  - Gestire store in modo lazy nel callback del listener (useRef per accesso corrente)
  - **Depends on**: None
  - **Requirement**: FR-007 (complementare)
  - **File**: `src/hooks/usePipWindow.ts`

- [x] 2.8 done (background agent)

## Phase 3: Refactor App.tsx

- [ ] 3.1 Estrarre useTimers hook
  - Creare `src/hooks/app/useTimers.ts`
  - Spostare tutti i 26 setInterval/setTimeout da App.tsx
  - Centralizzare cleanup in un unico return di useEffect
  - Verificare che tutti i timer vengano puliti correttamente
  - **Depends on**: 2.2, 2.5
  - **Requirement**: FR-010, FR-011
  - **File**: `src/App.tsx` -> `src/hooks/app/useTimers.ts`

- [ ] 3.2 [P] Estrarre useEventListeners hook
  - Creare `src/hooks/app/useEventListeners.ts`
  - Spostare tutte le Tauri listen() registrations
  - Garantire pattern corretto: registra in useEffect, unlisten in cleanup
  - **Depends on**: 2.2, 2.5
  - **Requirement**: FR-010, FR-011
  - **File**: `src/App.tsx` -> `src/hooks/app/useEventListeners.ts`

- [ ] 3.3 Estrarre useStreamingHandlers hook
  - Creare `src/hooks/app/useStreamingHandlers.ts`
  - Spostare logica di gestione eventi streaming Claude (handleClaudeEvent, handleTokenUpdate, etc.)
  - Questo hook interagisce con chatStore direttamente (non tramite props)
  - **Depends on**: 3.1, 3.2
  - **Requirement**: FR-010, FR-011
  - **File**: `src/App.tsx` -> `src/hooks/app/useStreamingHandlers.ts`

- [ ] 3.4 Estrarre useAgentLifecycle hook
  - Creare `src/hooks/app/useAgentLifecycle.ts`
  - Spostare: creazione agente, eliminazione, restart, session management
  - Includere cleanup di tabsByTerminal alla rimozione agente (FR-017)
  - **Depends on**: 3.1, 3.2
  - **Requirement**: FR-010, FR-011, FR-017
  - **File**: `src/App.tsx` -> `src/hooks/app/useAgentLifecycle.ts`

- [ ] 3.5 Estrarre usePipManager hook
  - Creare `src/hooks/app/usePipManager.ts`
  - Spostare updatePipAgents (gia throttled dalla 2.3) e logica PiP correlata
  - **Depends on**: 2.3, 3.3
  - **Requirement**: FR-010, FR-011
  - **File**: `src/App.tsx` -> `src/hooks/app/usePipManager.ts`

- [ ] 3.6 Ridurre App.tsx a orchestratore
  - App.tsx deve solo: importare hooks, comporre il layout JSX, delegare logica
  - Target: <500 righe (da 14.284)
  - Verificare con React DevTools che i re-render siano isolati per dominio
  - **Depends on**: 3.1, 3.2, 3.3, 3.4, 3.5
  - **Requirement**: FR-010, FR-011

## Phase 4: Infrastruttura

- [ ] 4.1 FileExplorer: filesystem watcher nativo
  - Sostituire setInterval 10s con `@tauri-apps/plugin-fs` watcher
  - Registrare watcher sulle directory espanse
  - Aggiungere/rimuovere watcher quando directory vengono espanse/collassate
  - Fallback a polling 30s se watcher fallisce
  - **Depends on**: None
  - **Requirement**: FR-013
  - **File**: `src/components/FileExplorer.tsx`

- [ ] 4.2 [P] useWhiteboardFile: filesystem watcher
  - Sostituire setInterval 2s con filesystem watcher
  - Watchare il singolo file whiteboard.json
  - Fallback a polling 10s se watcher non disponibile
  - **Depends on**: None
  - **Requirement**: FR-014
  - **File**: `src/hooks/useWhiteboardFile.ts`

- [ ] 4.3 [P] Lazy-load PixiJS e Mermaid
  - Identificare i componenti che importano PixiJS e Mermaid
  - Wrappare con React.lazy() + Suspense con fallback loading
  - Verificare che il code splitting produca chunk separati nel build
  - **Depends on**: 1.2
  - **Requirement**: FR-015
  - **Files**: Componenti che usano PixiJS/Mermaid

- [ ] 4.4 [P] MCPProcessManager: tokio::sync::Mutex
  - Sostituire `std::sync::Mutex` con `tokio::sync::Mutex` in mcp.rs
  - Aggiornare tutti i lock() a .lock().await
  - Verificare che kill_process, is_running, kill_all funzionino correttamente
  - **Depends on**: None
  - **Requirement**: FR-016
  - **File**: `src-tauri/src/mcp.rs`

- [ ] 4.5 [P] Cleanup tabsByTerminal alla rimozione agente
  - In uiStore, aggiungere `removeTerminalTabs(terminalId: string)` action
  - Chiamare removeTerminalTabs quando un agente/terminale viene eliminato
  - Verificare che la Map non cresca senza limiti nel tempo
  - **Depends on**: None (ma 3.4 lo integrera)
  - **Requirement**: FR-017
  - **File**: `src/stores/uiStore.ts`, punto di eliminazione agente in App.tsx

## Notes

- `[P]` indica task parallelizzabili
- Le fasi 1-2 sono le piu impattanti per l'utente finale (streaming + startup)
- La fase 3 e' la piu rischiosa ma necessaria per sostenibilita a lungo termine
- La fase 4 sono ottimizzazioni infrastrutturali indipendenti
- Dopo ogni fase, misurare con React DevTools Profiler e confrontare con baseline
- Ogni task della fase 1 puo essere un commit separato (revertibile)
