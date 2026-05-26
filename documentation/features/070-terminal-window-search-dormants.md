---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-05-26
last_verified: 2026-05-26
tags: [terminal-window, search, persistence, dormant, perf]
---

## Terminal Window — Project Search + Dormant Terminals
**Purpose:** Due miglioramenti UX per la Terminal Window separata: (1) una barra di ricerca per filtrare la lista progetti quando ne hai molti; (2) preservare i terminali fra restart dell'app — invece di sparire quando il PTY muore, i terminali restano visibili come "dormienti" e si possono rianimare con un click (ricreazione PTY con stesso nome/colore/cwd).
**Stack:** React 18, TypeScript strict, Zustand persist, Tauri v2 invoke (`create_terminal`, `get_terminal_status`, `close_terminal`)

### Files
| Type | Path | Exports / Purpose |
|------|------|-------------------|
| Component | src/components/TerminalWindowApp.tsx | `projectQuery` + `useDeferredValue` + `filteredProjects`; `verifyTerminals` non distruttivo; `handleReviveTerminal`, `handleSelectTerminal`; `aliveTerminalCount` memo |
| Styles | src/components/TerminalWindowApp.css | `.terminal-sidebar-search*` (input + icona + clear), `.terminal-item.dormant` (italic + grayscale indicator) |
| Type | src/types.ts | `ProjectTerminal.status` allargato a `"idle" \| "busy" \| "dormant"` |
| Store | src/stores/terminalStore.ts | Nessuna modifica — `partialize` già persiste i metadati necessari |

### Data Flow
```
APP MOUNT (Terminal Window)
  └→ verifyTerminals (batch, Promise.allSettled):
       map snapshot → invoke('get_terminal_status', {id})
       collect ids where rejected || !alive
       setProjectTerminals(snapshot.map → mark {alive:false, status:'dormant'}))
         (ONE persist write, not N)

USER TYPES in search input
  └→ setProjectQuery(q)
       └→ useDeferredValue(q) → filteredProjects = allProjects.filter(name.includes(q))
           (digit immediato, filter low-priority)

USER CLICKS sidebar terminal
  └→ handleSelectTerminal(t)
       if dormant → handleReviveTerminal(t):
         invoke('create_terminal', {label, color, cwd})  // new Rust id
         removeProjectTerminal(t.id) + addProjectTerminal(revived)
         setActiveTerminalId(newId)
       else → setActiveTerminalId(t.id)

USER CLOSES dormant via context menu
  └→ handleCloseTerminal: skip invoke('close_terminal'), only store remove

WINDOW onCloseRequested
  └→ if aliveTerminalCount > 0 → confirm prompt
     else (all dormant) → close silently
```

### Key Design Decisions
- **Dormant marking, non removal**: il cleanup al mount non rimuove più i terminali con PTY morto; li marca `{alive:false, status:'dormant'}`. I metadati erano già persistiti dallo store (`partialize`), ma il vecchio `removeProjectTerminal` cancellava sia memoria sia disco. Ora la persistenza fa quel che promette.
- **Revive ricrea, non riusa**: l'`id` Rust del PTY nuovo è diverso. Si fa swap nello store (remove vecchio + add nuovo) preservando `name/color/cwd/projectPath`. L'output del PTY morto NON è recuperabile — l'utente vede una shell fresca.
- **Ricerca semplice, no fuzzy lib**: `.toLowerCase().includes(name)` coerente col resto della codebase (`RulesPanel`, `BackgroundTaskLogs`). Niente `fuse.js`/`cmdk` aggiunti.
- **`useDeferredValue` invece di debounce**: pattern React 18 nativo. L'input resta immediato, il filter viene deprioritizzato. Mitiga il re-render di `TerminalMain` (non memoizzato) ad ogni keystroke.
- **Perf batch al mount**: `verifyTerminals` parallelizza con `Promise.allSettled` e fa UNA sola `setProjectTerminals`. Prima: N round-trip sequenziali + N serializzazioni del blob `terminal-storage`. Importante se l'utente accumula molti dormienti.
- **`onCloseRequested` deps minime**: `aliveTerminalCount` memo (primitivo) come unica dep → il listener Tauri non si re-registra ad ogni edit/revive.
- **Confirm chiusura solo se necessario**: i dormienti non hanno PTY, quindi chiudere la finestra non termina nulla — niente prompt fastidioso.

### Limitations
- L'output del PTY morto è perso col processo (non si può recuperare lo scrollback).
- `TerminalWindowApp.tsx` ha superato ~1100 righe — debito tecnico: andrebbe spezzato in `TerminalSidebar.tsx` + hook (`useTerminalRevive`, `useProjectFilter`).

### Brain References
- `documentation/gotchas/gotcha-terminal-store-sync-persist-quota.md` — perché `partialize` esclude i campi runtime
- `documentation/gotchas/gotcha-terminal-info-field-names.md` — naming dei campi PTY
- `src/hooks/useMinuteTick.ts` — pattern singleton ticker (creato nello stesso ciclo perf)
