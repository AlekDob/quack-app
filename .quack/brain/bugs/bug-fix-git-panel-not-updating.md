---
type: bug_fix
project: quack-app
created: 2026-02-11
tags: [git, panel, session, worktree, ui]
---

# Bug Fix: Git drawer panel non si aggiorna con sessione worktree

## Sintomo

Il Git drawer panel (pannello laterale con status git, staged files, etc.) mostra sempre lo stato del repo principale anche quando la sessione attiva usa un worktree in un path diverso. L'utente vede i file del `main` branch invece di quelli del worktree.

## Causa

Il `GitPanel` riceveva `rootPath={explorerPath}` che puntava sempre alla directory dell'agente (il repo principale), ignorando il `worktreePath` della sessione attiva.

Inoltre `refreshGitSummary` usava `explorerPath` hardcoded.

## Fix

3 cambiamenti in `App.tsx`:

### 1. `effectiveGitRootPath` (useMemo)

```typescript
const effectiveGitRootPath = useMemo(() => {
  if (activeSessionId) {
    const session = useSessionStore.getState().sessions.find(s => s.id === activeSessionId);
    if (session?.worktreePath) return session.worktreePath;
  }
  return explorerPath;
}, [activeSessionId, explorerPath]);
```

### 2. `refreshGitSummary` aggiornato

Cerca il `worktreePath` della sessione attiva prima di usare `explorerPath` come `rootPath` per `git_status_summary`.

### 3. `GitPanel rootPath`

Cambiato da `explorerPath` a `effectiveGitRootPath`.

### 4. Auto-refresh su cambio sessione

Nuovo `useEffect` che quando `activeSessionId` cambia e il git drawer e' aperto, chiama `refreshGitSummary()`.

## File modificati

- `src/App.tsx` — `effectiveGitRootPath`, `refreshGitSummary`, `GitPanel` props, nuovo useEffect

## Race condition nel branch display

Scoperto anche un race condition nel display del branch nell'header: il `useEffect` che imposta `gitBranch` dal terminale faceva una chiamata async a `git_current_branch` che poteva risolvere DOPO l'override della sessione, sovrascrivendolo con "main". Fix: controllare `activeSession?.branch` sia nel sync path che nel `.then()` della promise asincrona.
