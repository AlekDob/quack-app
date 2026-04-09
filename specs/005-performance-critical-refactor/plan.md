# Implementation Plan: Performance Critical Refactor

**Branch**: `005-performance-critical-refactor` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-performance-critical-refactor/spec.md`

## Summary

Refactor incrementale in 4 fasi per eliminare i bottleneck di performance critici e alti identificati dall'audit. Focus su: eliminazione re-render cascata (God Component + doppia sorgente chatSessions), riduzione bundle size (tree-shaking + lazy loading), e ottimizzazione rendering (virtualizzazione + memo + throttle).

## Technical Context

**Language/Version**: TypeScript strict (React 18), Rust 1.75+ (Tauri v2)
**Primary Dependencies**: React 18, Zustand, Vite, react-window, PixiJS, Mermaid, Tauri v2
**Storage**: Local filesystem (JSON, JSONL, MD), Zustand in-memory stores
**Testing**: Manuale + React DevTools Profiler per misurare re-render
**Target Platform**: macOS (arm64/x64), Windows (x64)
**Project Type**: Desktop app (Tauri)
**Performance Goals**: 60fps durante streaming, <2.5s cold start, <500MB RAM dopo 2h
**Constraints**: No breaking changes nella Fase 1, refactor incrementale (non rewrite)
**Scale/Scope**: 14.284 righe App.tsx, 17 file coinvolti, 4 fasi

## Constitution Check

| Principio | Stato | Note |
|-----------|-------|------|
| I. AI-First Architecture | OK | Nessun impatto su workflow agenti |
| II. Tauri + React Full-Stack | OK | Stesso stack, solo ottimizzazione |
| III. Domain-Driven Organization | MIGLIORA | Fase 3 estrae hooks per dominio |
| IV. Code Quality Gates | VIOLA OGGI | App.tsx 14k righe vs max 300. Fase 3 corregge |
| V. Knowledge-Driven Development | OK | Diary + gotcha entries da creare |
| VI. Simplicity Over Cleverness | OK | Nessuna nuova astrazione, solo separazione |
| VII. User Experience First | MIGLIORA | Performance = UX diretta |

## Architecture

### Fase 1 - Quick Wins (no risk)

```
vite.config.ts
  └── Riabilitare treeshake, chunk manuale per Mermaid, esbuild.drop console.log

src/components/ChatView.tsx
  └── Import MessageListVirtualized invece di MessageList (soglia 50+ messaggi)

src/components/PipAgentCard.tsx
  └── React.memo con comparatore custom (status + lastMessage)

src/components/PipWindow.tsx
  └── useCallback per handleAgentClick, passare agentId come prop
```

**Strategia**: Modifiche isolate, ognuna testabile indipendentemente, zero rischio di regressione.

### Fase 2 - Stato e Streaming (refactor controllato)

```
src/stores/chatStore.ts
  └── Aggiungere setSession(sessionId, messages) action (singolo set())

src/App.tsx
  ├── Eliminare useState<Map> chatSessions locale (riga 1070)
  ├── Sostituire sync loop (righe 1355-1376) con uso diretto chatStore
  ├── Throttle updatePipAgents a 500ms (righe 4985-5040)
  └── Estrarre normalizeModelName a livello modulo (riga 5127)

src/contexts/ZustandProvider.tsx
  └── Eliminare (marcato @deprecated, sostituire tutti i consumer)

src/components/TerminalSidebar.tsx
  └── Rimuovere prop chatSessions, usare selector chatStore puntuale

src/components/MessageList.tsx
  └── Separare hasUserMessages in useMemo, rimuovere da deps handleScroll
```

**Strategia**: Ogni modifica nella Fase 2 ha una singola responsabilita. L'ordine e' critico:
1. Prima: aggiungere `setSession` al chatStore (additive, no breaking)
2. Poi: migrare App.tsx a usare chatStore come unica sorgente
3. Poi: eliminare ZustandProvider e aggiornare consumer
4. Infine: ottimizzare TerminalSidebar e MessageList

### Fase 3 - Refactor App.tsx (architetturale)

```
src/hooks/app/
  ├── useAppState.ts           # Stato globale app (theme, layout, preferences)
  ├── useAgentLifecycle.ts     # Creazione, eliminazione, restart agenti
  ├── useEventListeners.ts     # Tutti i Tauri event listener
  ├── useStreamingHandlers.ts  # Gestione eventi streaming Claude
  ├── usePipManager.ts         # Logica PiP (estratta da App.tsx)
  └── useTimers.ts             # Tutti i setInterval/setTimeout centralizzati

src/App.tsx
  └── Ridotto a orchestratore: importa hooks, compone layout, delega logica
```

**Strategia**: Estrazione incrementale, un hook alla volta. Dopo ogni estrazione:
- Verificare che l'app funzioni identicamente
- Misurare re-render con React DevTools (deve diminuire)
- Ogni hook gestisce SOLO il suo stato (nessun cross-contamination)

### Fase 4 - Infrastruttura

```
src/components/FileExplorer.tsx
  └── Sostituire setInterval 10s con @tauri-apps/plugin-fs watcher

src/hooks/useWhiteboardFile.ts
  └── Sostituire setInterval 2s con filesystem watcher

src/App.tsx (o hook dedicato)
  └── React.lazy + Suspense per PixiJS e Mermaid components

src-tauri/src/mcp.rs
  └── std::sync::Mutex → tokio::sync::Mutex per MCPProcessManager

src/stores/uiStore.ts
  └── Aggiungere removeTerminalTabs(terminalId) per cleanup tabsByTerminal
```

## File coinvolti per fase

| Fase | File | Tipo modifica | Rischio |
|------|------|---------------|---------|
| 1 | vite.config.ts | Edit (3 righe) | Basso |
| 1 | ChatView.tsx | Edit (1 import) | Basso |
| 1 | PipAgentCard.tsx | Edit (wrap memo) | Basso |
| 1 | PipWindow.tsx | Edit (useCallback) | Basso |
| 2 | chatStore.ts | Edit (add action) | Basso |
| 2 | App.tsx:1070,1355 | Edit (remove useState, sync) | Medio |
| 2 | App.tsx:4985 | Edit (throttle) | Basso |
| 2 | App.tsx:5127 | Edit (extract fn) | Basso |
| 2 | ZustandProvider.tsx | Delete | Medio |
| 2 | TerminalSidebar.tsx | Edit (selector) | Medio |
| 2 | MessageList.tsx | Edit (useMemo) | Basso |
| 3 | App.tsx | Refactor (extract hooks) | Alto |
| 3 | src/hooks/app/*.ts | Create (6 files) | Medio |
| 4 | FileExplorer.tsx | Edit (watcher) | Medio |
| 4 | useWhiteboardFile.ts | Edit (watcher) | Medio |
| 4 | mcp.rs | Edit (mutex type) | Basso |
| 4 | uiStore.ts | Edit (cleanup fn) | Basso |

## Design Patterns

- **Zustand Selectors**: Ogni componente sottoscrive SOLO lo slice di stato che usa, mai l'intero store
- **Throttle/Debounce**: Effects ad alta frequenza (streaming) limitati a 2Hz max
- **React.memo + comparatore**: Componenti in lista (PipAgentCard, AgentSessionItem) memoizzati con shallow compare su campi specifici
- **Lazy Loading**: Componenti pesanti (PixiJS, Mermaid) caricati on-demand con React.lazy + Suspense
- **Filesystem Watchers**: Sostituzione polling con eventi reattivi nativi Tauri

## Rollback Strategy

Ogni fase e' indipendente e revertibile:
- **Fase 1**: Revert singoli commit, nessuna dipendenza tra le 4 modifiche
- **Fase 2**: Se chatStore migration fallisce, revert a useState + sync (stato attuale)
- **Fase 3**: Ogni hook estratto e' revertibile ri-inlineando il codice in App.tsx
- **Fase 4**: Watcher fallback a polling (gia' implementato oggi)
