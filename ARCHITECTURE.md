# Architettura di Quack

Questo documento descrive i componenti principali, i flussi di dati e le decisioni architetturali dell’app.

## Panoramica
- UI: React 19 + Vite 7 + TypeScript 5.8
- Terminale: xterm.js con addon Fit e WebLinks
- Desktop: Tauri 2 (Rust)
- Backend locale: comandi Tauri per PTY, FS, Git; server HTTP Axum (hook esterno)

## Mappa componenti
- React
  - `TerminalSidebar`: gestione e metadati delle sessioni (colore, stato, focus)
  - `TerminalView`: mounting xterm, input utente → `write_to_terminal`, resize → `resize_terminal`, ascolto eventi Tauri
  - `FileExplorer`: listing directory, up/refresh, anteprima file via `read_file_content`
  - `GitPanel`: stato, diff, stage/unstage, commit, timeline
  - `App`: orchestration, stato globale, gestione notifiche, pannello destro (Explorer/Git)
- Tauri (Rust)
  - `terminal.rs`: spawn shell via `portable-pty`, stream output → evento `terminal-data`, exit → `terminal-exit`, registry in‑memory
  - `fs.rs`: `list_directory`, `get_home_directory`, `read_file_content`
  - `git.rs`: status porcelain, diff (cached/no-index), stage/unstage, commit, log
  - `lib.rs`: bootstrap app, mount plugin, server HTTP Axum → evento `external-terminal-status`

## Flussi di dati
1) Input utente → xterm.js → Tauri
   - onData in `TerminalView` inoltra i caratteri a `write_to_terminal`
2) Output processo → Tauri → UI
   - thread reader PTY emette `terminal-data` con chunk UTF-8
3) Resize terminale
   - `FitAddon.fit()` → `resize_terminal` con `rows/cols`
4) Chiusura processo
   - Wait del child → `terminal-exit` con `{ code, success, message }`
5) Explorer
   - `list_directory(path?)` restituisce percorso canonico e entries (cartelle in cima, sort case-insensitive)
   - `read_file_content` rifiuta > 5MB
6) Git
   - `git_status_summary` (branch/upstream/ahead/behind + entries)
   - `git_diff(path, staged, untracked)` con fallback `--no-index` per untracked
   - `git_stage`, `git_unstage`, `git_commit`, `git_commit_history(limit)`
7) Hook HTTP esterno
   - POST `/terminal/status` con `{ id|label, status: busy|idle, notify }`
   - Emesso `external-terminal-status` verso la UI; `App` risolve id/label e aggiorna lo stato

## Gestione stato busy/idle
- Heuristica lato UI:
  - Input con invio/caratteri → `busy`
  - Output con prompt finale (regex) → `idle` immediato
  - Altrimenti `busy` + timer `IDLE_TIMEOUT_MS` (default 2000 ms) che porta a `idle` se non arriva altro output
- Eventi esterni:
  - L’hook HTTP può imporre busy/idle da processi esterni (es. task runner) con risoluzione per `id`, `label`, o slug del label
- Notifiche e attenzione:
  - Se un terminale passa a `idle` mentre non è attivo → `needsAttention: true` e (se permesso) notifica + suono

## Scelte e motivazioni
- PTY locale (`portable-pty`) per massima compatibilità e controllo
- Git via CLI per evitare binding complessi e mantenere comportamento allineato a git nativo
- Axum loopback per hook: semplice, sicuro (127.0.0.1), indipendente dal ciclo di vita React

## Considerazioni di sicurezza
- Server HTTP solo su `127.0.0.1:6768`
- Nessuna persistenza di credenziali
- Lettura file con limite dimensionale e evitando cartelle
- UI in dev con CSP nullo; definire policy in produzione (vedi SECURITY.md)

## Estensioni future
- Git remotes: auth GitHub (device flow/PAT), push/pull/fetch
- Branch management: checkout/crea/merge, grafo
- Associare radice Git e path Explorer alla `cwd` del terminale attivo
- Profili terminale (shell env, init commands)

## Diagramma
Vedi `diagrams/architecture.mmd` per il diagramma Mermaid della topologia e dei flussi.
