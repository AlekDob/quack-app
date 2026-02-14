---
type: pattern
created: 2026-01-08
---

# Terminal System

Frontend: TerminalSidebar.tsx, TerminalView.tsx, TerminalTab.tsx

Backend: terminal.rs (PTY management with portable-pty)

Hook: useTerminals.ts

Store: terminalStore.ts

Features: Multi-session PTY, status detection (running/waiting/idle), ANSI colors, CWD sync, popout windows

## Come Funziona il Terminale

Quack usa **PTY (Pseudo-Terminal)** reali, non emulazione:
- Supporta programmi interattivi (vim, htop, etc.)
- I colori ANSI funzionano nativamente
- Il terminale si comporta come quello di sistema

## Stack Tecnologico

- **Frontend**: xterm.js 5.5.0 per il rendering
- **Backend**: portable-pty 0.8 per la gestione PTY in Rust
- **State**: terminalStore.ts con Zustand

## Flusso di una Sessione

1. User clicca "New Terminal"
2. Frontend chiama `invoke('create_terminal', { cwd })`
3. Rust crea un PTY con portable-pty
4. Output viene streamato via eventi Tauri
5. xterm.js renderizza l'output
6. Input viene inviato al PTY via `invoke('write_terminal')`

## Status Detection

- **Running**: Comando in esecuzione
- **Waiting**: Shell pronta per input
- **Idle**: Nessuna attivita
