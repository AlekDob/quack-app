---
type: pattern
created: 2026-01-08
---

# Processes Drawer

Drawer per monitorare i processi attivi nei terminali.

## Informazioni Mostrate

- Lista processi per terminale
- Uptime formattato (45s / 12m / 2h 30m)
- Status indicator (running/waiting)
- Port se servizio web attivo
- PID processo

## Funzionalita

- Click per focus sul terminale
- Apri URL localhost da servizi running
- Ordinamento per label terminale
- Card responsive per ogni processo

## Struttura Dati

```typescript
ProcessInfo {
  terminalId: string
  terminalLabel: string
  status: 'running' | 'waiting'
  port?: number
  pid?: number
}
```

## File

| File | Ruolo |
|------|-------|
| `ProcessesDrawer.tsx` | Drawer processi |
