---
type: pattern
created: 2026-01-08
---

# Frontend Architecture

Entry: /src/main.tsx (bootstrap), /src/App.tsx (tab system, terminal sidebar)

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

`App.tsx` e il cuore dell'applicazione. Gestisce:
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

Non organizziamo per tipo (components/, hooks/, utils/) ma per feature.
