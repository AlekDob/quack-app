---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Frontend Architecture

Entry: /src/main.tsx (bootstrap), /src/App.tsx (6528 LOC - tab system, terminal sidebar)

268 components organized by feature domain

62 custom hooks in /src/hooks/

17 Zustand stores in /src/stores/ (persistent state)

34 services in /src/services/

10 views in /src/views/

Key libraries: React 19, Vite 7, xterm.js 5.5, Monaco 0.55, Zustand 5, TailwindCSS 3.4

## Punto di Partenza: main.tsx e App.tsx

Quando apri Quack, tutto parte da `/src/main.tsx`:
- Configura gli error handlers globali
- Inizializza i providers (Zustand, Context, PostHog)
- Monta il componente `<App />`

`App.tsx` e il cuore dell'applicazione (6500+ righe). Gestisce:
- Il sistema di tab (terminali, chat, docs, kanban)
- La sidebar sinistra con progetti e terminali
- Il pannello destro con file explorer e git

## Organizzazione delle Cartelle

```
/src
├── components/     # 268 componenti UI
│   ├── kanban/     # Kanban board
│   ├── second-brain/ # Outliner e graph
│   └── ...
├── hooks/          # 62 custom hooks
├── stores/         # 17 Zustand stores
├── services/       # 34 servizi
├── views/          # 10 viste principali
└── types.ts        # TypeScript definitions
```

## Pattern Chiave: Feature-Based Organization

Non organizziamo per tipo (components/, hooks/, utils/) ma per feature. Esempio per Kanban:
- `components/kanban/KanbanView.tsx` - Vista principale
- `stores/kanbanStore.ts` - Stato
- `hooks/useKanbanChatStore.ts` - Logica chat

## Dove Iniziare?

1. **Capire il tab system**: Guarda `App.tsx` linee 200-400
2. **Capire lo state**: Esplora `/src/stores/`
3. **Modificare UI**: I componenti sono in `/src/components/`
