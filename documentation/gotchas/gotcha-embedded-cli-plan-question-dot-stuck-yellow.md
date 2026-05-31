---
type: gotcha
project: quack-app
created: 2026-05-30
last_verified: 2026-05-30
tags: [embedded-cli, hooks, session-status, dot-color, plan-mode, askuserquestion, ws8]
---
# Embedded CLI: dot resta GIALLO su piano/domanda (serve PreToolUse, non Notification)

## Sintomo
Dopo il pivot embedded CLI (WS8), nella sidebar il dot di stato sessione:
- resta **giallo** (working) quando Claude mostra un **piano** (ExitPlanMode) o una
  **domanda** (AskUserQuestion), invece di diventare **viola** (needs attention);
- a volte resta **grigio** invece di verde (hook `Stop` perso → marker assistant mancante);
- a volte diventa **viola "a caso"** e resta appeso (Notification idle non bloccante).

## Causa radice
Il dot è interamente activity-driven da `useHookStatusListener.ts` che mappa gli hook di
Claude Code sui Map di `chatStore`. Priorità colore (`sessionStatus.ts`):
`viola(pending) > giallo(loading) > verde(unread) > grigio(vuoto)`.

Il viola era derivato **solo** da `Notification`/`PermissionRequest`. Ma in modalità
interattiva Claude Code **NON spara `Notification` quando mostra un piano o una
domanda**: quegli stati sono i tool `ExitPlanMode` / `AskUserQuestion`. L'ultimo evento
resta `UserPromptSubmit` → `loading=true` → giallo; il turno non è `Stop` (l'agente
aspetta, non ha finito) → niente verde → **bloccato giallo** finché l'utente non risponde.

Confermato dalla doc ufficiale (code.claude.com/docs/hooks): il segnale affidabile per
"agente bloccato in attesa di una decisione utente" è **`PreToolUse` con matcher
`ExitPlanMode|AskUserQuestion`** (+ `PostToolUse` per la ripresa), NON `Notification`.
`Notification` in interattivo è rumoroso (scatta anche su idle "Claude is waiting for
your input") → falsi viola.

## Fix (metodo herdr — schermo come ground truth)
Un primo tentativo solo-hook (PreToolUse `ExitPlanMode|AskUserQuestion`→viola) è stato
**superato**: gli hook da soli restano lossy (Stop persi, eventi fuori ordine, nessun
evento per AskUserQuestion). La soluzione adottata copia
[herdr](https://github.com/ogulcancelik/herdr): **lo schermo del terminale è l'autorità**,
gli hook sono solo l'accel­eratore istantaneo.

1. **Detector schermo** `src/utils/agentScreenDetect.ts` — port fedele di
   `claude_code.rs` di herdr: `detectClaudeScreenState(content)` → `blocked` (prompt
   permessi/piano, selezione+yes/no, `tab to amend`…), `working` (`esc to interrupt` /
   spinner sopra il prompt box), `idle` (prompt box `❯` visibile), `unknown` (schermo
   non-Claude OPPURE menu numerato ambiguo → defer agli hook, non forzare mai "done").
2. **Loop di arbitraggio** `src/hooks/useScreenStateArbitration.ts` — ogni 700ms legge il
   buffer di ogni terminale agent (`readAgentTerminalScreen`) e applica lo stato; `idle`
   debounced 1.5s per non flippare a "done" tra un tool e l'altro.
3. **Scritture condivise** `src/utils/sessionStatusWrites.ts` — `markWorking/Blocked/Done/
   Released` idempotenti; usate SIA dagli hook SIA dall'arbitraggio così convergono.
4. **Hook** (`useHookStatusListener.ts` + `terminal.rs` `ensure_status_hooks_installed`):
   `UserPromptSubmit`→working, `PermissionRequest`→blocked, `Stop`→done,
   `SessionStart`/`SessionEnd`→released, e — segnale di precisione —
   `PreToolUse(ExitPlanMode|AskUserQuestion)`→blocked / `PostToolUse`→working.
   `Notification` NON mappato (rumoroso).

## Caso yes/no vs AskUserQuestion generica
Lo schermo riconosce `blocked` solo su scelte **yes/no** o frasi "would you like to
proceed?": Claude usa lo STESSO widget di selezione (`❯ 1. … 2. …`) per i blocchi reali
e per i menu innocui (`/` slash, settings) → marcarli tutti darebbe falsi viola. Una
`AskUserQuestion` con opzioni libere è quindi indistinguibile sullo schermo. Soluzione
**ibrida**: lo schermo su un menu numerato non-yes/no ritorna `unknown` (defer), e il hook
`PreToolUse` matcher `ExitPlanMode|AskUserQuestion` fornisce il `blocked` preciso (scatta
solo per quei tool → zero falsi positivi sui menu). `PostToolUse` → resume.

## Gotcha operativa
La registrazione hook è in **Rust** ed è **per-progetto** (`.claude/settings.json`).
Richiede **rebuild** dell'app e i progetti già aperti devono far **ri-spawnare un
terminale** perché `ensure_status_hooks_installed` aggiunga i nuovi eventi. Senza questo,
il vecchio comportamento (giallo bloccato) persiste.

## File
- `src/utils/agentScreenDetect.ts` (detector schermo, port di herdr)
- `src/hooks/useScreenStateArbitration.ts` (loop 700ms, autorità)
- `src/utils/sessionStatusWrites.ts` (markWorking/Blocked/Done/Released, DRY)
- `src/hooks/useHookStatusListener.ts` (hook acceleratore, mappatura herdr)
- `src/components/AgentTerminalView.tsx` (`readAgentTerminalScreen`, `listAgentTerminalSessionIds`)
- `src-tauri/src/terminal.rs` (`ensure_status_hooks_installed`, EVENTS herdr)
- `src/components/AgentSessionItem.tsx:170-195`, `src/utils/sessionStatus.ts:15-26` (dot, invariati)

## Consumatori: leggere SEMPRE da chatStore, non da App.useState
`sessionStatusWrites` scrive i marker (incl. l'`assistant complete` che fa il VERDE) in
`chatStore.chatSessions`. La sidebar legge da lì → corretta. Il Task Hub invece leggeva i
messaggi da uno `useState` locale di `App.tsx` (sync solo App→store, mai inversa) → non
vedeva il marker → sessione "done" finiva in OTHER grigia. Fix: `TaskHubView` +
`computeTaskHubBadge` (SidePanelAccordion) leggono `chatSessions` da `useChatStore`.
Regola: **qualsiasi consumer dello stato sessione deve leggere `chatStore`** (giallo/viola
sono già nello store; verde/done dipende dai messaggi nello store, NON dalla prop App).

## Test
`src/tests/agentScreenDetect.test.ts` (10 casi: blocked/working/idle/unknown + menu generico→defer).

Vedi anche: [[gotcha-mobile-session-dot-status]] (priorità colori + session.status ≠ attività).
Brain: 069-embedded-cli-hooks-pivot
