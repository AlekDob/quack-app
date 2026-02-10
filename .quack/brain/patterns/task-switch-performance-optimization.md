---
type: pattern
project: quack-app
created: 2026-01-10
migrated: true
---

# task-switch-performance-optimization

[2026-01-10] Ottimizzato lo switch tra task da 1-2 secondi a ~300ms

Problema: openTaskTab() eseguiva operazioni sequenziali bloccanti (loadDirectory, Store.load, ensureListenerReady)

Soluzione 1: UI Update ottimistico - il tab appare IMMEDIATAMENTE, poi i dati si caricano in background

Soluzione 2: Promise.all() per parallelizzare loadDirectory(), chat loading, e salvataggio messaggi precedenti

Soluzione 3: Store caching con getCachedStore() a livello modulo - evita Store.load() ripetuti

Soluzione 4: Memoizzazione di TasksSidebarSection e TaskItem con React.memo() e custom comparison

File modificati: App.tsx (openTaskTab), TasksSidebarSection.tsx (memo)

Pattern: Optimistic UI + Parallel I/O + Component Memoization

Test: openTaskTab.test.ts con 3 test cases
