---
type: bug_fix
project: quack-app
created: 2026-02-11
tags: [git, branch, session, worktree, checkout]
---

# Bug Fix: Branch checkout mancante alla creazione sessione

## Sintomo

Quando l'utente crea una nuova sessione selezionando un branch **esistente** senza worktree, il repo rimane sul branch precedente (es. `main`). Il branch viene salvato nella sessione ma non viene fatto checkout.

## Causa

Il codice in `RepositoryGroup.tsx` e `SessionEmptyState.tsx` gestiva solo 2 scenari:

1. `useWorktree && branch` → `git_add_worktree` (OK)
2. `!branchExists` → `git_create_branch` con switch (OK)

Mancava il terzo caso:

3. `branchExists && !useWorktree` → **nessuna azione** (BUG!)

## Fix

Aggiunto `else` branch in entrambi i handler:

```typescript
if (useWorktree) {
  await invoke('git_add_worktree', { ... });
} else if (!branchExists) {
  await invoke('git_create_branch', { branchName: branch, switch: true, ... });
} else {
  // NUOVO: checkout di branch esistente senza worktree
  await invoke('git_switch_branch', { branchName: branch, rootPath: agent.cwd });
}
```

## File modificati

- `src/components/RepositoryGroup.tsx` — `handleNewSession`
- `src/components/SessionEmptyState.tsx` — `handleNewSession`

## Trigger

Creazione sessione con branch esistente diverso dal corrente, senza abilitare worktree.

## Nota

Il checkout senza worktree e' safe solo se la working tree e' pulita. Il `NewSessionModal` gia' blocca il submit se ci sono uncommitted changes e non si usa worktree (`isBlockedByDirty`).
