---
type: bug
project: quack-app
created: 2026-05-31
last_verified: 2026-05-31
tags: [embedded-cli, pty, leak, ws8, claude-process, session-delete, reaper]
---
# Embedded CLI: PTY orfani (processi `claude` mai uccisi) accumulati a ogni delete

## Sintomo
Dopo il pivot embedded CLI (WS8), facendo "done" + elimina sessione (e poi
riaprendone altre) il processo `claude` della sessione cancellata resta vivo.
Ripetendo, si accumulano N istanze `claude` orfane → rischio "1000 istanze attive".
Verificabile con `ps aux | grep '[c]laude'`.

## Causa
`disposeAgentTerminal()` (`AgentTerminalView.tsx`) fa `term.dispose()` +
`invoke('close_terminal')` (che lato Rust fa `child.kill()`), MA **non veniva mai
chiamata**: nessun call-site fuori dal file che la definisce.

Con la pivot, il PTY (figlio del processo app, keyed `agent-cli-<sessionId>`) e la
sua istanza xterm hanno un ciclo di vita **scollegato** da quello del record
`AgentSession`. I path di delete:
- `sessionStore.deleteSession` → rimuove il record, salva, marca token deleted.
- `App.tsx handleDeleteSession` → solo stato UI.
- `TaskHubView` / Kanban / drawer → chiamano `deleteSession` dello store.

Nessuno teardown del terminale → PTY + `claude` restano vivi per sempre. Il vecchio
percorso SDK gestiva il processo altrove; ora non più.

## Fix (2 livelli)
1. **Choke-point delete** — in `sessionStore.deleteSession` chiamo
   `disposeAgentTerminal(id)` via `import()` dinamico (evita di tirare xterm nello
   store / cicli). È l'unico punto attraversato da TUTTI i path di delete.
2. **Reaper di sicurezza** — `src/hooks/useTerminalReaper.ts` (montato in App.tsx):
   ogni 3s interroga `list_terminals` (backend = autoritativo sui processi reali) e
   per ogni `agent-cli-*` la cui sessione non è più nello store → `disposeAgentTerminal`.
   Grace di 8s (orphanSince map) per evitare race su delete-in-corso / cold boot;
   skip se `isLoading`.
3. `disposeAgentTerminal` reso idempotente: chiama SEMPRE `close_terminal`, anche
   senza istanza xterm nel Map frontend (così il reaper raggiunge orfani che il Map
   non traccia — es. dopo reset modulo HMR).

## KEY INSIGHT
La `REGISTRY` dei terminali è una `HashMap` **in-memory** nel processo Rust → al
riavvio app è vuota, quindi `list_terminals` ritorna SOLO i PTY della run corrente.
Niente falsi positivi al boot: un `agent-cli-*` vivo implica una sessione creata in
questa run; se non è più nello store, è stata cancellata → orfano sicuro da reapare.

Nota: Claude Code usa un proprio `claude daemon` / `--bg-pty-host` (`/tmp/cc-daemon`)
che può tenere processi indipendenti dall'app. `close_terminal` uccide la shell
figlia (→ SIGHUP a `claude`); la gestione del daemon è interna a Claude Code.

## File
- `src/stores/sessionStore.ts` (deleteSession → disposeAgentTerminal)
- `src/components/AgentTerminalView.tsx` (disposeAgentTerminal sempre chiude il PTY)
- `src/hooks/useTerminalReaper.ts` (NEW — reaper)
- `src/App.tsx` (mount useTerminalReaper)

Brain: 069-embedded-cli-hooks-pivot
