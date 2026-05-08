---
type: bug_fix
project: quack-app
created: 2026-03-30
last_verified: 2026-05-08
tags: [file-explorer, cache, refresh, stale-data, memo]
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

## Regression 2026-05-08: memo comparator swallowing prop updates

Anche dopo i fix sopra, il bottone Refresh continuava a non aggiornare la UI nel side panel destro.

### Causa

Il `memo` comparator in `FileExplorer.tsx` controllava solo `Object.keys(tree).length`:

```ts
const prevKeys = Object.keys(prevProps.tree)
const nextKeys = Object.keys(nextProps.tree)
if (prevKeys.length !== nextKeys.length) return false
return true
```

Quando il bottone Refresh ricarica path già nel tree (`fetchDirectoryChildren` fa `{...prev, [path]: newEntries}`), le **chiavi non cambiano** — cambiano solo gli array delle entries. Il comparator restituiva `true` (uguale) e React saltava il re-render → UI stale anche se `explorerTree` era aggiornato.

Funzionava in altri casi solo perché:
- **Cambio sessione**: nuovo `rootPath` → primo guard scatta.
- **Auto-refresh trigger** (file modificati da Claude): `setExplorerTree({})` prima di `loadDirectory(root)` → `keys.length` 0 → 1.

Solo il **bottone manuale** mutava chiavi esistenti senza variare il count.

`modifiedFiles` non era nemmeno nel comparator (bug pre-esistente: i badge dei file modificati non avrebbero potuto re-renderizzare se solo quella prop fosse cambiata).

### Fix 2026-05-08

Confronto per reference: `setExplorerTree` produce sempre un nuovo oggetto, quindi qualsiasi aggiornamento del tree (incluso il replacement di chiavi esistenti) è rilevato.

```ts
if (prevProps.tree !== nextProps.tree) return false
if (prevProps.modifiedFiles !== nextProps.modifiedFiles) return false
return true
```

Goal originale ("non re-renderizzare per cambi a terminali/git status") preservato: `tree` e `modifiedFiles` cambiano reference solo quando i loro setter scattano, non a ogni render del parent.

### File modificati

- `src/components/FileExplorer.tsx` — comparator usa reference equality e include `modifiedFiles`
