---
type: gotcha
created: 2026-02-11
last_verified: 2026-02-14
tags: [react, useEffect, race-condition, git, branch, async]
---

# Gotcha: Race condition nel display del branch (async overwrite)

## Il problema

In `App.tsx`, il branch mostrato nell'header (`gitBranch` state) puo' essere sovrascritto da una promise asincrona che risolve in ritardo.

### Sequenza rotta

1. Utente seleziona sessione con `branch: "feature/x"`
2. `useEffect [activeSessionId]` → `setGitBranch("feature/x")` (corretto)
3. `useEffect [activeTerminal]` → `invoke('git_current_branch')` (async, parte)
4. La promise risolve → `setGitBranch("main")` (SOVRASCRIVE!)
5. Header mostra "main" invece di "feature/x"

### La causa

Due `useEffect` scattano contemporaneamente quando cambi sessione:
- Uno imposta il branch dalla sessione (sync, immediato)
- L'altro legge il branch dal disco (async, puo' arrivare dopo)

## La fix

Nel `useEffect` del terminale, controllare **prima** se la sessione ha un branch esplicito:

```typescript
// Prima di tutto: se la sessione ha un branch, usa quello
const activeSession = activeSessionId
  ? useSessionStore.getState().sessions.find(s => s.id === activeSessionId)
  : null;

if (activeSession?.branch) {
  setGitBranch(activeSession.branch);
} else if (activeTerminal.branch) {
  setGitBranch(activeTerminal.branch);
} else {
  // Async fallback — ri-controlla nel .then()
  invoke('git_current_branch', { rootPath: cwd })
    .then((branch) => {
      const currentSession = activeSessionId
        ? useSessionStore.getState().sessions.find(s => s.id === activeSessionId)
        : null;
      if (!currentSession?.branch) {
        setGitBranch(branch.trim());
      }
    });
}
```

## Lezione

Quando hai due `useEffect` che scrivono lo stesso state e uno e' async, il sync puo' "vincere" inizialmente ma essere sovrascritto quando l'async risolve. Usa guard conditions nel `.then()` per evitare overwrite tardivi.
