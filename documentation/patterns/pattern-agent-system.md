---
type: pattern
created: 2026-01-08
---

# Agent System

## Sistema Agenti Multi-Progetto

La sidebar sinistra di Quack mostra gli **Active Agents** - sessioni AI organizzate per progetto. Ogni progetto puo avere piu agenti attivi contemporaneamente.

## Struttura della Sidebar

```
ACTIVE AGENTS
├── flow-bi (2 agents)
│   ├── Agent Jack - Project Manager
│   └── Agent Magnus - Coder
├── quack-app (4 agents)
│   ├── Agent Laura - Marketing Manager
│   ├── Agent Jack - Project Manager
│   ├── Agent Magnus - Coder
│   └── [Task cards in progress]
└── safehood (1 agent)
    └── Agent Magnus - Coder
```

## Creazione Agenti: NewTerminalModal.tsx

Quando clicchi '+' su un progetto, si apre `NewTerminalModal.tsx` che permette di:
- Selezionare un agente esistente (dalla cartella `.claude/agents/`)
- Creare un nuovo agente con personalita custom
- Assegnare ruolo (Coder, Project Manager, Marketing, etc.)
- Scegliere avatar e colore

## File Agenti: .claude/agents/

Gli agenti sono definiti come file markdown in `.claude/agents/`:

```markdown
---
name: Agent Magnus
role: Coder
avatar: magnus.png
color: purple
---

Sei un developer esperto in React e TypeScript...
```

## Task Integration

Sotto ogni agente appaiono i **task Kanban** assegnati:
- Pallino arancione = TODO
- Pallino cyan = In Progress
- Pallino verde = Done

Cliccando un task si apre il chat drawer per interagire con l'agente su quel task specifico.

## File Principali

| File | Ruolo |
|------|-------|
| `TerminalSidebar.tsx` | Container sidebar agenti |
| `NewTerminalModal.tsx` | Modal creazione agente |
| `AgentCard.tsx` | Card singolo agente |
| `.claude/agents/*.md` | Definizioni agenti |
