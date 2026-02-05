---
type: idea
project: quack-app
created: 2026-01-10
migrated: true
---

# Quack Agent Preview Card Update

## Agent Personality Section Update

**Componente**: `div.context-section.personality-section`
**Location**: Side panel right, Agent Context Panel

### Stato Attuale

La preview card mostra:
- Avatar dell'agente
- Nome e ruolo
- Communication Style badge
- Custom Notes (descrizione)
- Agent Rules (collapsible)

### Proposta: Aggiungere Power Rating

```
+----------------------------------+
|  [Avatar]  Agent Jack            |
|            Project Manager       |
|                                  |
|  POWER: 850  ████████░░          |
|  Skills: 3 | Droids: 1 | Rules: 2|
+----------------------------------+
|  COMMUNICATION STYLE             |
|  [Professional]                  |
+----------------------------------+
|  CUSTOM NOTES                    |
|  Sei un project manager che...   |
+----------------------------------+
|  > Agent Rules (2)               |
+----------------------------------+
```

### UI Design

**Power Badge:**
- Numero prominente con barra progress
- Colore gradient: verde (low) -> giallo (mid) -> cyan (high)
- Breakdown on hover: "Skills: 3×100 + Droids: 1×150 + Rules: 2×50"

**Posizione:**
- Sotto nome/ruolo, sopra Communication Style
- O in una riga dedicata con icona ⚡

### Implementazione

1. Calcolare power in `useAgentPersonality` hook
2. Aggiungere `PowerBadge` component
3. Mostrare breakdown in tooltip

### Tag
#quack-bundles
