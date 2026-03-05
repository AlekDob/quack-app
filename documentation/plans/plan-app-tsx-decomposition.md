---
type: decision
project: quack-app
created: 2026-03-05
last_verified: 2026-03-05
tags: [refactor, architecture, app-tsx, strangler-fig]
---

# Plan: App.tsx Decomposition (Strangler Fig)

## Problem

`src/App.tsx` = 12,965 righe, singola funzione `AppContent()` da 12,648 righe.
Contiene: ~110 useState, 63 useEffect, 150 useCallback, 31 useRef, 35 Tauri listeners.
Ogni lettura da parte di un agente AI brucia ~15-20K token di contesto.

## Strategy: Strangler Fig + Custom Hooks

Non riscrivere. Estrarre un dominio alla volta come custom hook, partendo dal piu' isolato.
Lo stato globale e' gia' in 9 Zustand stores — i domini comunicano via store, non via props.
Questo rende l'estrazione meccanicamente sicura: il hook legge/scrive gli stessi store.

## Pattern per ogni estrazione

```typescript
// PRIMA (in App.tsx)
const [jobsLoading, setJobsLoading] = useState(false);
useEffect(() => { /* automation scheduler */ }, []);
const handleAutomationFireJob = useCallback(() => { ... }, []);

// DOPO (in hooks/useAutomationHandlers.ts)
export function useAutomationHandlers(deps: AutomationDeps) {
  const [jobsLoading, setJobsLoading] = useState(false);
  useEffect(() => { /* automation scheduler */ }, []);
  const handleAutomationFireJob = useCallback(() => { ... }, []);
  return { jobsLoading, handleAutomationFireJob };
}

// In App.tsx
const { jobsLoading, handleAutomationFireJob } = useAutomationHandlers(deps);
```

## Execution Order (by risk, ascending)

### Phase 1: Automation (~200 righe) — Risk: LOW

**What**: 1 useEffect (scheduler tick), 1 handler (`handleAutomationFireJob`), 2 Tauri listeners (`automation-scheduler-tick`, `automation-jobs-updated`)
**Why first**: Dominio piu' isolato. Solo dipendenze: `kanbanStore`, `automationStore`, `sendMessage` ref.
**Cross-refs**: Minime. Il JSX usa solo `jobsLoading` e pochi handler.
**Lines in App.tsx**: ~9327-9505
**Output file**: `src/hooks/useAutomationHandlers.ts`
**Verification**: Aprire tab Automations, creare un job, verificare che il tick funziona e il job si esegue.

### Phase 2: Git Operations (~700 righe) — Risk: LOW

**What**: State (`gitBranch`, `gitSummary`, `diffContent`, `selectedGitEntry`, `showGitDrawer`), 2 useEffect (branch sync, diff loading), ~8 handlers (`handleOpenGitDrawer`, `handleStageEntry`, `handleCommit`, `handleGenerateCommitMessage`, etc.)
**Why second**: Dominio autocontenuto con stato proprio.
**Cross-refs**: Il JSX usa `showGitDrawer`, `gitSummary`, `diffContent`. Passare come return values dal hook.
**Lines in App.tsx**: 859-876 (state) + 1650-1740 (effects) + 10594-11277 (handlers)
**Output file**: `src/hooks/useGitOperations.ts`
**Verification**: Aprire GitSidebar, stage files, commit, generare commit message con AI, aprire diff drawer.

### Phase 3: File Explorer & Preview (~600 righe) — Risk: LOW-MEDIUM

**What**: State (`explorerPath`, `explorerTree`, `explorerRoot`, `previewFile`, `previewContent`), 2 useEffect (file watcher, OPEN_FILE_IN_TAB), ~6 handlers (`handleOpenFilePreview`, `handleSaveFile`, `handleRefreshPreview`, `handleFilePathClick`)
**Why third**: Autocontenuto ma interagisce con il sistema tabs.
**Cross-refs**: `handleFilePathClick` e' usato anche da ChatMessage e StreamMessage (click su path nel messaggio).
**Lines in App.tsx**: 603-624 (state) + 707-730 (derived) + 6822-6966 (effects) + 8748-9130 (handlers)
**Output file**: `src/hooks/useFileExplorer.ts`
**Verification**: File Explorer tree, click su file, preview, salvataggio, click su path nei messaggi chat.

### Phase 4: Tab System (~300 righe) — Risk: MEDIUM

**What**: State (`tabs`, `activeTabId`, `tabsByTerminal`), ~5 handlers (`handleTabClick`, `handleTabClose`, `handleTabPopout`, `handleTabReorder`)
**Cross-refs**: Medie — tabs interagisce con Git drawer, File preview, Kanban, Office.
**Lines in App.tsx**: 764-855 (state) + 9935-10060 (handlers)
**Output file**: `src/hooks/useTabManager.ts`
**Verification**: Aprire/chiudere tab, riordinare, popout, verificare che le tab speciali (Kanban, Office) funzionino.

### Phase 5: Terminal CRUD (~1100 righe) — Risk: MEDIUM-HIGH

**What**: State (`terminals`, `activeId`, `agentTerminals`, `nativeTerminals`), ~10 handlers (`handleConfirmNewTerminal` 372 righe, `handleResetTerminal`, `handleDuplicateTerminal`, `handleEditTerminal`, `handleCloseTerminal`, `handleSelectTerminal`)
**Why risky**: `terminals` e `activeId` sono usati da 15+ handler in altri domini. Richiede definire un'interfaccia precisa.
**Lines in App.tsx**: 464-465, 557-564 (state) + 7333-8460 (handlers)
**Output file**: `src/hooks/useTerminalManager.ts`
**Verification**: Creare agente, duplicare, rinominare, resettare, chiudere, cambiare agente attivo.

### Phase 6: Chat & Session Management (~1000 righe) — Risk: HIGH

**What**: `chatSessions`, `chatLoadingMap`, `chatTokensMap`, `handleClaudeEvent`, `handleTokenUpdate`, `sendMessage`, Multi-Listener useEffect, Pre-warm listener.
**Why last**: Cuore del sistema. Tutto dipende da questo. Richiede interfaccia stabile definita dalle fasi precedenti.
**Lines in App.tsx**: 977-1060 (state) + 1215-1560 (handlers/effects) + 2036-2240 (listeners) + 2400-2600 (sendMessage)
**Output file**: `src/hooks/useChatEngine.ts`
**Verification**: Full test: inviare messaggi, streaming, abort, token tracking, stamina bar, multi-agent.

### NOT in scope (leave in App.tsx)

- **Bootstrap useEffect** (lines 6968-7235, 265 righe) — inizializza tutto, troppo rischioso spostare. Sara' l'ultimo pezzo da estrarre quando tutto il resto e' fuori.
- **JSX return** (lines 11317-12965, 1648 righe) — l'ultimo step. Si puo' fare SOLO dopo che tutti gli handler sono in hook esterni, perche' il JSX li usa tutti. Diventerà naturale quando restano solo `const { ... } = useXxxHandlers()` + JSX.
- **UI/Modal state** (~200 righe di useState per `showSettings`, `showStoreDrawer`, etc.) — basso impatto, puo' restare.

## Expected Results

| Dopo fase | Righe App.tsx | Riduzione | Token risparmiati |
|-----------|:------------:|:---------:|:-----------------:|
| Phase 1 | ~12,750 | -215 (-2%) | Marginale |
| Phase 2 | ~12,050 | -700 (-5%) | ~1K |
| Phase 3 | ~11,450 | -600 (-5%) | ~1K |
| Phase 4 | ~11,150 | -300 (-2%) | ~500 |
| Phase 5 | ~10,050 | -1100 (-9%) | ~1.5K |
| Phase 6 | ~9,050 | -1000 (-8%) | ~1.5K |
| **Totale** | **~9,050** | **-3,915 (-30%)** | **~5.5K** |

Nota: il 30% rimanente e' Bootstrap (265), UI state (200), JSX (1648), e glue code. Per scendere sotto 5K righe serve anche estrarre il JSX in sub-componenti (Phase 7, fuori scope).

## Rules

1. **Un dominio alla volta** — mai 2 estrazioni in parallelo sullo stesso file
2. **Commit dopo ogni fase** — checkpoint per rollback sicuro
3. **Nessun cambio funzionale** — solo spostamento meccanico di codice
4. **Mantieni lo stesso ordine dei hook** — React richiede ordine stabile
5. **Test manuale dopo ogni fase** — la feature estratta DEVE funzionare identicamente
6. **Non spostare useState condivisi** — se uno state e' usato da 2+ domini, resta in App.tsx fino all'ultimo dominio che lo usa viene estratto
7. **Interface first** — prima definisci il tipo di ritorno del hook, poi sposta il codice

## Dependencies between phases

```
Phase 1 (Automation) → indipendente
Phase 2 (Git) → indipendente
Phase 3 (File Explorer) → debole dipendenza da Phase 4 (tabs)
Phase 4 (Tabs) → indipendente
Phase 5 (Terminal CRUD) → dipende da Phase 4 (tabs reference terminals)
Phase 6 (Chat/Session) → dipende da Phase 5 (chat needs terminal context)
```

Phases 1, 2, 4 sono completamente indipendenti e possono essere fatte in qualsiasi ordine.
Phase 3 e' meglio dopo Phase 4, ma non e' bloccante.
Phases 5 e 6 sono sequenziali e vanno fatte per ultime.
