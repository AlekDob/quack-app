# Quack

Terminale desktop multi‑sessione con file explorer e integrazione Git, costruito con React + TypeScript (Vite) e Tauri 2 (Rust).

## Indice
- Panoramica
- Funzionalità
- Architettura
- Requisiti
- Avvio rapido (Dev)
- Build e distribuzione
- Dettagli tecnici (Tauri, eventi, sicurezza)
- Hook HTTP esterno (status terminale)
- Integrazione Git
- Limiti attuali e roadmap
- Troubleshooting

---

## Panoramica
Quack fornisce un terminale integrato con più sessioni, un file explorer e un pannello Git in un’unica finestra desktop. È pensato per aumentare la produttività locale senza dipendere da IDE pesanti.

Stack principale:
- Frontend: React 19 + Vite 7 + TypeScript 5.8, xterm.js per il terminale
- Desktop: Tauri 2 (Rust) con plugin Dialog e Notification
- Backend locale: comandi Tauri per PTY, file system e Git; piccolo server HTTP (Axum) per eventi esterni

Struttura cartelle rilevante:
- `src/`: UI React (TerminalSidebar, TerminalView, FileExplorer, GitPanel)
- `src-tauri/`: backend Tauri (Rust): PTY (`terminal.rs`), file system (`fs.rs`), Git (`git.rs`), bootstrap (`lib.rs`)

## Funzionalità
- Terminali multipli con stato (busy/idle), colori personalizzabili e gestione focus
- Rilevamento “idle” intelligente basato sull’output del processo e sul prompt
- Notifiche desktop quando un job termina (permesso richiesto la prima volta)
- File explorer con navigazione, refresh e anteprima file (limite 5MB)
- Pannello Git: status, diff (worktree/staged), stage/unstage, commit, timeline dei commit
- Hook HTTP locale per aggiornare lo stato di terminali esterni (status busy/idle)

## Architettura
- Eventi Tauri → UI
  - `terminal-data`: stream dell’output PTY verso React
  - `terminal-exit`: notifica di terminazione processo
- Comandi Tauri esposti:
  - Terminale: `create_terminal`, `list_terminals`, `write_to_terminal`, `resize_terminal`, `close_terminal`, `set_terminal_color`
  - File system: `list_directory`, `get_home_directory`, `read_file_content`
  - Git: `git_status_summary`, `git_diff`, `git_stage`, `git_unstage`, `git_commit`, `git_commit_history`
- Server HTTP interno: Axum su `127.0.0.1:6768` (vedi Hook HTTP) per ricevere eventi `busy/idle` e propagarli alla UI tramite `external-terminal-status`.

Componenti chiave UI:
- `TerminalView`: monta xterm.js, inoltra input a Tauri, ascolta `terminal-data` e `terminal-exit`, adatta dimensioni al layout
- `TerminalSidebar`: lista terminali, colore, chiusura e selezione
- `FileExplorer`: elenco directory, su/refresh, click per aprire file in anteprima
- `GitPanel`: status staged/unstaged, diff viewer, stage/unstage, box commit, timeline

Backend PTY (Rust):
- `portable-pty` per spawn shell, gestione reader/writer, resize e lifecycle
- Registry in‑memory delle sessioni per stato, ordine e metadati

Git (Rust):
- Interfaccia minimale via `git` CLI: status porcelain v1, diff, add/reset, commit, log formattato

## Requisiti
- Node.js 18+ e npm
- Rust toolchain + Cargo
- Prerequisiti Tauri 2 per il tuo OS (es. macOS: Xcode CLT)
- Git installato e disponibile nel PATH

## Avvio rapido (Dev)
1) Installazione dipendenze
```bash
npm install
```
2) Avvio app desktop (consigliato, abilita terminali/FS/Git)
```bash
npm run tauri:dev
```
3) Solo frontend web (limitato, mostra messaggio di fallback)
```bash
npm run dev
```

Script utili:
- `npm run tauri:dev`: avvia finestra desktop Quack
- `npm run tauri:build`: build pacchetti desktop
- `npm run build`: build frontend Vite (per bundling Tauri)
- `npm run preview`: anteprima build Vite
- `npm run lint`: linting

## Build e distribuzione
Configurazione in `src-tauri/tauri.conf.json`:
- `beforeDevCommand`: `npm run dev`
- `frontendDist`: `../dist` (output Vite)
- Bundle attivo per target multipli, icone incluse

Build desktop:
```bash
npm run tauri:build
```
L’artefatto risultante dipende dal sistema (dmg/msi/deb ecc.).

## Dettagli tecnici (Tauri, eventi, sicurezza)
- Bind dei plugin: Dialog e Notification sono abilitati. In dev viene attivato anche `tauri-plugin-log`.
- Eventi UI:
  - `terminal-data`: payload `{ id, data }`
  - `terminal-exit`: payload `{ id, code, success, message }`
- Sicurezza:
  - Server Axum in ascolto solo su `127.0.0.1:6768` (loopback)
  - CSP non impostata (sviluppo). Valutare policy dedicate in produzione.
  - Le azioni Git invocano la CLI locale di `git` nella root repo rilevata (vedi nota sotto).

## Hook HTTP esterno (status terminale)
Endpoint: `POST http://127.0.0.1:6768/terminal/status`

Body JSON:
```json
{
  "id": "<id-terminale-opzionale>",
  "label": "<label-opzionale>",
  "status": "busy|idle",
  "notify": true
}
```
- È sufficiente passare `id` oppure `label` (uno dei due). La UI prova a risolvere la sessione corrispondente; se trova il match, aggiorna lo stato e (se `notify` true e abilitato) mostra una notifica.

Esempio curl:
```bash
curl -X POST \
  http://127.0.0.1:6768/terminal/status \
  -H 'Content-Type: application/json' \
  -d '{"label":"Terminal 1","status":"idle","notify":true}'
```

## Integrazione Git
- Status: branch, upstream, ahead/behind, elenco file staged/unstaged/untracked
- Diff: vista worktree o staged; per untracked cade su `--no-index` vs /dev/null
- Stage/unstage: `git add -- <path>` / `git reset HEAD -- <path>`
- Commit: `git commit -m <message>` (rifiutato se messaggio vuoto)
- Timeline: `git log --date=relative` con parsing custom

Nota importante: l’implementazione attuale risolve la root Git a partire dalla `current_dir` del processo Tauri. Assicurati di avviare l’app all’interno della repository che vuoi ispezionare. In futuro si potrà agganciare la root Git alla `cwd` del terminale attivo o del file explorer.

## Limiti attuali e roadmap
Limiti:
- Git legato alla `current_dir` del processo (vedi nota sopra)
- Anteprima file limitata a 5 MB
- UI solo italiana in questa fase

Roadmap (vedi `plan/git-integration-plan.md`):
- Visualizzazione grafo branch/history
- Autenticazione GitHub (device flow o PAT) e push
- Gestione branch: checkout, create, merge

## Troubleshooting
- Vedo il messaggio “Avvia l’app desktop Tauri…”: usa `npm run tauri:dev` (il web puro non ha accesso a PTY/FS/Git)
- Niente notifiche: consenti i permessi quando richiesto; puoi riabilitarli dalle preferenze di sistema del tuo OS
- Git: “Impossibile trovare la directory .git” → avvia l’app dentro una repo o spostati in una repo e riesegui
- Porta 6768 occupata: chiudi il processo in conflitto o modifica la porta nel codice (`lib.rs`)

## Licenza
TBD

