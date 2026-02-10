---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Project Dashboard

## Project Dashboard

Quack include una **dashboard progetto** che mostra una panoramica dello stato del progetto corrente.

## Informazioni Mostrate

- **Git Status**: Branch corrente, modifiche pending
- **Recent Commits**: Ultimi commit con autore e data
- **Worktrees**: Git worktree attivi per task isolati
- **Task Overview**: Riassunto task Kanban (todo/progress/done)
- **Project Stats**: Metriche progetto

## Accesso

La dashboard e accessibile come tab dedicato. Puo essere aperta dalla sidebar o tramite shortcut.

## Componenti

| File | Data Creazione | Ruolo |
|------|----------------|-------|
| `ProjectDashboard.tsx` | Jan 7 | Componente principale |
| `ProjectDashboardTabView.tsx` | Jan 7 | Vista tab |
| `useProjectDashboard.ts` | Jan 7 | Hook dati dashboard |

## Integrazione

La dashboard si integra con:
- Git store per status e commit
- Kanban store per task overview
- File system per statistiche progetto

## Note

Feature recente (7 Gennaio 2026), potrebbe essere ancora in evoluzione.
