---
type: bug_fix
project: quack-app
created: 2026-03-30
last_verified: 2026-03-30
tags: [file-explorer, cache, refresh, stale-data]
---

# Bug Fix: File Explorer non aggiorna su refresh (cache stale)

## Sintomo

Quando la struttura della cartella corrente cambia (file creati/eliminati dall'AI o manualmente), il file explorer non mostra i cambiamenti. Neanche premendo il bottone Refresh. Solo cambiando sessione e tornando indietro si vedono gli aggiornamenti.

## Causa

Due problemi nella gestione della cache del tree:

### 1. `loadDirectory` fa merge, non replace
```ts
setExplorerTree((previous) => ({
  ...previous,                        // mantiene tutte le sotto-cartelle cached
  [listing.path]: listing.entries,    // aggiorna SOLO il livello richiesto
}));
```
Le sotto-cartelle espanse mantengono i dati vecchi nel tree state.

### 2. Bottone Refresh ricarica solo il root
```ts
onClick={() => activePath && onLoadChildren?.(activePath)}
```
Ricarica solo `activePath` (la root directory), ignorando tutte le sotto-cartelle espanse.

### 3. `refreshExplorerTrigger` stesso problema
Il trigger automatico (quando Claude modifica file) chiama `loadDirectory(explorerRoot)` che aggiorna solo il root.

## Perché cambiare sessione funziona

Quando si cambia sessione, viene chiamato `loadDirectory(newPath)` con un path diverso, e l'intero tree viene ricostruito da zero perché si parte da un nuovo root.

## Fix

### FileExplorer.tsx - Bottone Refresh
Il bottone ora ricarica TUTTE le directory espanse:
```ts
onClick={() => {
  const pathsToReload = [activePath, ...Array.from(expanded)].filter(Boolean);
  const unique = [...new Set(pathsToReload)];
  for (const p of unique) {
    void onLoadChildren(p).catch(() => {});
  }
}}
```

### App.tsx - refreshExplorerTrigger
Svuota la cache prima di ricaricare il root:
```ts
if (refreshExplorerTrigger > 0 && explorerRoot) {
  setExplorerTree({});  // Clear stale cache
  loadDirectory(explorerRoot);
}
```

## File modificati

- `src/components/FileExplorer.tsx` — bottone refresh ora ricarica expanded set
- `src/App.tsx` — trigger refresh svuota cache tree
