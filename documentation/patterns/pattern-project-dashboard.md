---
type: pattern
created: 2026-01-08
---

# Project Dashboard

Dashboard progetto che mostra panoramica dello stato del progetto corrente.

## Informazioni Mostrate

- **Git Status**: Branch corrente, modifiche pending
- **Recent Commits**: Ultimi commit con autore e data
- **Worktrees**: Git worktree attivi per task isolati
- **Task Overview**: Riassunto task Kanban (todo/progress/done)
- **Project Stats**: Metriche progetto

## Accesso

La dashboard e accessibile come tab dedicato dalla sidebar o tramite shortcut.

## Componenti

| File | Ruolo |
|------|-------|
| `ProjectDashboard.tsx` | Componente principale |
| `ProjectDashboardTabView.tsx` | Vista tab |
| `useProjectDashboard.ts` | Hook dati dashboard |

## Integrazione

La dashboard si integra con Git store, Kanban store, e File system.
