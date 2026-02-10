---
type: pattern
project: quack-app
created: 2026-01-08
migrated: true
---

# State Management Pattern

Zustand for persistent stores (17 stores in /src/stores/)

Context API for global state (10 contexts)

Key stores: chatStore, terminalStore, fileSystemStore, gitStore, kanbanStore, backgroundAgentStore, uiStore, settingsStore

Stores have devtools integration

Pattern: feature-specific stores with clear separation of concerns

## La Strategia: Zustand + Context API

Quack usa un approccio ibrido:
- **Zustand** per stato persistente e complesso
- **Context API** per stato UI transitorio

## Perche Zustand?

- Semplice (no boilerplate come Redux)
- Persistenza built-in
- DevTools integration
- Selectors per performance

## I 17 Store Principali

| Store | Persiste? | Contenuto |
|-------|-----------|-----------|
| `chatStore` | Si | History, sessions, messages |
| `terminalStore` | Si | Lista terminali, settings |
| `kanbanStore` | Si | Tasks, columns, agents |
| `settingsStore` | Si | Preferenze utente |
| `gitStore` | No | Status, branches (refresh) |
| `uiStore` | No | Panels, modals, notifications |

## Pattern: Feature Store

Ogni feature ha il suo store dedicato:

```typescript
// stores/kanbanStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface KanbanStore {
  tasks: Task[]
  addTask: (task: Task) => void
  moveTask: (id: string, status: Status) => void
}

export const useKanbanStore = create<KanbanStore>()(
  persist(
    (set) => ({
      tasks: [],
      addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
      moveTask: (id, status) => set((s) => ({
        tasks: s.tasks.map(t => t.id === id ? {...t, status} : t)
      })),
    }),
    { name: 'kanban-storage' }
  )
)
```

## Context API per UI

I Context sono usati per stato che non deve persistere:
- `TerminalContext` - Operazioni terminale attivo
- `UIContext` - Stato modali, drawer aperti
- `TestModeContext` - Flag per testing
