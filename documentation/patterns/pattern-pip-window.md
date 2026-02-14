---
type: pattern
created: 2026-01-08
---

# PIP Window System

## Picture-in-Picture Window

Quack supporta una finestra **PIP (Picture-in-Picture)** per monitorare gli agenti attivi mentre lavori in altre app.

## Funzionalita

- Finestra draggable usando Tauri native APIs
- Lista agenti attivi con aggiornamenti real-time
- Visualizzazione stato agente (idle/working/completed)
- Contatore lavori per agente
- Comunicazione event-driven tra main e PIP
- Persistenza posizione e dimensione
- Click su agente per focus nella finestra principale

## Stato Agente PIP

```typescript
PipAgentState {
  agentId: string
  sessionId: string
  status: 'idle' | 'running' | 'completed'
  workCount: number
  displayName: string
}
```

## Eventi di Comunicazione

- `pip-agents-update` -- Aggiornamento lista agenti
- `pip-window-ready` -- PIP window pronta
- `pip-agent-clicked` -- Selezione agente
- `pip-window-closing` -- Salva posizione/size alla chiusura

## Persistenza

- Usa Tauri plugin-store
- File: `.quack-popout-windows.dat`

## File Principali

| File | Ruolo |
|------|-------|
| `PipWindow.tsx` | Finestra PIP |
| `PipAgentCard.tsx` | Card agente in PIP |
| `usePipWindow.ts` | Hook gestione PIP |
| `popoutWindowStore.ts` | Store Zustand |
| `pip-window-entry.tsx` | Entry point finestra |
