---
type: pattern
created: 2026-01-08
---

# Background Tasks System

Quack supporta l'esecuzione di **task in background** senza bloccare l'interfaccia principale. Ideale per build, test, analisi lunghe.

## Invocazione

Comando slash: `/background <comando>` o `/background @<agente> <prompt>`

## Tipi di Task

- `agent` - Agente AI in background
- `build` - Compilazione progetto
- `test` - Esecuzione test suite
- `analysis` - Analisi codice
- `watch` - File watcher
- `custom` - Task personalizzati

## Sistema di Priorita

- **High**: Eseguiti immediatamente
- **Medium**: Coda standard
- **Low**: Eseguiti quando risorse disponibili

## Funzionalita

- Coda prioritizzata
- Streaming log real-time
- Tracking progresso con percentuali
- Notifiche desktop al completamento
- Retry logic configurabile
- Controllo concorrenza (default: 5 task)

## File Principali

| File | LOC | Ruolo |
|------|-----|-------|
| `useBackgroundAgents.ts` | 397 | Hook principale |
| `backgroundAgentStore.ts` | - | Store Zustand |
| `backgroundAgentService.ts` | 16K | Service esecuzione |
| `BackgroundTasksDrawer.tsx` | - | UI drawer |
| `BackgroundTaskCard.tsx` | - | Card singolo task |
| `BackgroundTaskLogs.tsx` | - | Viewer log |
| `background_tasks.rs` | 22K | Backend Rust |
