# Contribuire a Quack

Grazie per il tuo interesse! Ecco come impostare l’ambiente, lo stile di codice e il flusso di lavoro consigliato.

## Requisiti
- Node.js 18+
- Rust + Cargo (toolchain compatibile con Tauri 2)
- Prerequisiti di sistema Tauri (es. macOS: Xcode Command Line Tools)
- Git

## Setup progetto
```bash
npm install
npm run tauri:dev
```
- `npm run dev` avvia solo il frontend (limitato: niente PTY/FS/Git)

## Struttura
- `src/`: React + TypeScript (componenti UI)
- `src-tauri/`: backend Tauri (Rust)
- `plan/`: piani evolutivi
- `diagrams/`: diagrammi Mermaid

## Stile & Lint
- TypeScript 5.8, ESLint 9
- Esegui `npm run lint` prima delle PR
- Nomi chiari, tipizzazione esplicita quando utile, evitare `any`

## Commit
- Messaggi brevi e descrittivi
- Esempi: `feat(git): add staged/worktree diff toggle`, `fix(terminal): handle resize race`

## Branch e PR
- Crea branch da `main`
- PR piccole e focalizzate, descrizione con contesto e screenshot se UI
- Linka issue/piano (`plan/`) quando rilevante

## Test manuali
- Terminale: creazione/chiusura, input, resize, idle/busy, notifiche
- Explorer: navigazione, anteprima file, limiti >5MB
- Git: status, stage/unstage, diff, commit, timeline
- Hook: `curl` su `POST /terminal/status` con `busy/idle`

## Linee guida Rust
- Errori con `anyhow::Result` + messaggi contestuali (`context`)
- Evita deadlock: scope ridotto dei lock, preferisci clonare Arc/Mutex
- Eventi Tauri idempotenti e robusti contro race

## Rilasci
- `npm run tauri:build` genera i pacchetti
- Verifica icone, nome app, versione in `src-tauri/tauri.conf.json`

## Roadmap
- Vedi `plan/git-integration-plan.md` e apri discussioni/issue per nuove proposte

Grazie per i contributi!
