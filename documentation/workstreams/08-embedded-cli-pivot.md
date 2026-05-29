---
ws: 8
title: "Embedded CLI Pivot — centro = Claude Code interattivo, stato dagli hook"
status: "RENDER + AUTOSTART + HOOK-STATUS + TOKEN + SDK-GUARD + FASE7-REPOINT WORKING — strip aggressivo deferred (Codex/Jack)"
focus: current
opened: 2026-05-29
updated: 2026-05-29
---

# WS8 — Embedded CLI Pivot

## Goal

Rimuovere lo stream di chat SDK dal centro di Quack e montare al centro la **CLI interattiva di Claude Code** in un PTY reale. Lo stato di sessione (working/needs-attention/done) non deriva piu' dal parsing degli eventi SDK ma dai **Claude Code hooks** (Stop / Notification / PermissionRequest / UserPromptSubmit). Sidebar sinistra (043), barra destra (035/054) e tab in alto restano invariati.

**Motivo strategico:** il 15/06/2026 Anthropic sposta l'uso programmatico dell'Agent SDK in un pool di credito a pagamento; *"Interactive Claude Code in the terminal is not affected"*. Embeddando la CLI interattiva si usa il pool della subscription, non toccato.

## Decisione

REFACTOR in-place (NON rewrite). `chatStore` e' gia' una facade (4 Map, 19 consumer via selector): si cambiano solo gli **scrittori** (SDK → hook) tenendo Map/setter identici, e tutta la UI preservata si aggiorna gratis. Vedi `documentation/decisions/` + diary 2026-05-29.

## Phases

1. **Pipeline hook→status** — `~/.quack/hooks/brain/quack-status.js` + route Rust `/hooks/status` → emit `hook-status` — ✅ DONE
2. **Listener frontend sulla facade** — `useHookStatusListener.ts` (UserPromptSubmit→working, Notification/PermissionRequest→waiting, Stop→done) — ✅ DONE (always-on)
3. **Centro CLI embedded** — `AgentTerminalView.tsx` + backend `create_agent_terminal` (env injection QUACK_SESSION_ID/QUACK_API_PORT/QUACK_HOOK_TOKEN, hook per-progetto) — ✅ DONE
4. **Sorgente token da transcript** — su Stop leggere `transcript_path` per token per-turno → stamina bar — ✅ DONE (comando Rust `parse_transcript_tail` + bridge CustomEvent → `handleTokenUpdate`)
5. **Flip + validazione consumer** — ✅ DONE (validato nell'app reale)
6. **Cancellare il centro chat-stream** — ChatView/ChatInput/ChatContext/AppRefactored/featureFlags cancellati (~5.500 righe) — ✅ DONE (tsc 0)
7. **Repoint send SDK → PTY in App.tsx** — ✅ DONE (come REPOINT, non strip). Sbloccata da Alek ("possiamo annientare telegram/whatsapp/pwa → procedi"). `sendMessageForAgent` ora, per le sessioni **non-Codex**, fa early-return scrivendo il prompt nel PTY embedded (`write_to_terminal` su `agent-cli-<sessionId>`, bracketed paste + CR) invece di `send_message_via_sdk_streaming`. Tutti i 9 call-site programmatici (remote-execute/remote-send-message/WhatsApp/auto-start/git-commit/`/clear`/@team) confluiscono lì → azzerato l'uso del pool SDK a pagamento sul main agent. **Strip aggressivo (handleClaudeEvent + Map pending* + 3 listener SDK) NON eseguito**: condiviso con Codex (OpenAI, fuori dal billing) e Jack/Kanban → rimuoverlo romperebbe feature non sacrificabili. Vedi sezione "Fase 7 — repoint fatto, strip deferred".
9. **Guard degradazione SDK** — ✅ DONE (riformulata): non più "gate dietro embedded flag" (embedded è permanente, disabiliterebbe Jack/BTW/Kanban). Implementato kill-switch **opt-out** `quack:disableSdkStream` (default OFF = tutto invariato) che disabilita con fallback grazioso i 3 send SDK programmatici secondari (Jack/BTW/Kanban-inline). Util `src/utils/sdkStreamGuard.ts`.

## Status (2026-05-29)

**Funzionante e validato nell'app reale:**

- ✅ Pipeline hook→stato: dot sidebar/TaskHub guidati da claude interattivo (no SDK)
- ✅ **Pallino verde sidebar**: su `UserPromptSubmit` aggiunto marker `user` contentless (altrimenti `AgentSessionItem` resta DORMANT e blocca il verde); su `Stop` marker assistant complete
- ✅ **Render TUI** stabile: container `position:absolute; inset:0` + fit con retry rAF + ResizeObserver + window-resize
- ✅ **Autostart `claude`**: one-shot per PTY (Set `createdTerminals`/`launchedTerminals`), trigger su primo byte + fallback 1200ms, StrictMode-safe
- ✅ **Persistenza istanza xterm** (Map globale `agentTerminalInstances`): l'xterm + listener NON vengono mai distrutti all'unmount, solo ri-agganciati — fix del "terminale vuoto" causato dal dispose/recreate su doppio-mount di StrictMode

**Aggiunto 2026-05-29 (pomeriggio):**

- ✅ **Fase 4 — token da transcript**: comando Rust `sessions::parse_transcript_tail(path)` (legge solo gli ultimi ~512KB del JSONL, prende l'`usage` dell'**ultimo** messaggio assistant = context-fill per-turno, non la somma). Su `Stop`, `useHookStatusListener` lo invoca e dispatcha un `CustomEvent('quack:transcript-usage', {sessionKey, usage, cost})`; App.tsx ascolta e chiama `handleTokenUpdate(sessionKey, ...)`. La chiave combacia perché il token map è keyed by `chatKey` (= session id = `quack_session_id` dell'hook). Best-effort: se il transcript manca/illeggibile → N/A, nessun crash.
- ✅ **Fase 9 — guard SDK (riformulata)**: `src/utils/sdkStreamGuard.ts` → `isSdkStreamEnabled()` (opt-OUT via `localStorage quack:disableSdkStream='1'`, default abilitato). Gating con fallback grazioso (`SDK_DISABLED_MESSAGE`) su Jack (`useJackChat`), BTW (`useBTW`), Kanban inline (`usePopoutKanbanChat`). Motivo: dare all'utente un kill-switch per il pool SDK a pagamento (15/06) senza rompere niente di default.

## Fase 7 — repoint fatto, strip deferred

**Fatto (REPOINT).** `sendMessageForAgent` (App.tsx ~2865), per `currentSession?.backend !== 'codex'`, fa early-return e scrive il prompt nel PTY embedded:
```ts
const ptyData = `\x1b[200~${resolvedContent}\x1b[201~\r`; // bracketed paste + CR
await invoke('write_to_terminal', { id: `agent-cli-${messageKey}`, data: ptyData });
return;
```
Tutti i 9 call-site programmatici confluiscono lì (remote-execute ~6118, remote-send-message ~6156, WhatsApp auto-start ~6039, pendingAutoStart ~3588, git-commit ~12381, `/clear` ~4577, @team enrichment). Risultato: **zero uso del pool SDK a pagamento (15/06) sul main agent** — il typing manuale era già su PTY (`term.onData`), lo stato resta dagli hook.

**Verifica chiave:** il mount centrale (App.tsx ~13458/13495) è `AgentTerminalView` **incondizionato** (lancia sempre `claude`), per ogni sessione. Quindi dopo la cancellazione di `ChatView` (Fase 6) l'output SDK Claude non era più renderizzato da nessuna parte → il repoint è strettamente meglio (il prompt ora appare nel terminale + guida gli hook).

**NON fatto (strip aggressivo) — deliberato.** `handleClaudeEvent` (1544-1915) + le `Map pending*` (pendingUserQuestions/ToolPermissions/PlanApprovals, 607/611/618) + i 3 listener SDK (ask-user-question/tool-permission/plan-approval) **restano VIVI** perché condivisi:
- **Codex** (OpenAI, NON toccato dal billing Anthropic): `codex-event:${agentId}` listener → `handleClaudeEvent`; `sendMessageForAgent` ha un branch Codex (~3193).
- **Jack / Kanban**: usano ancora `send_message_via_sdk_streaming` → possono emettere ask-user-question/tool-permission/plan-approval.

Alek ha autorizzato ad annientare SOLO telegram/whatsapp/pwa, non Codex/Jack → rimuovere quel codice romperebbe feature non sacrificabili, su un branch senza rollback e non validabile da me. Se in futuro si vuole completare lo strip: prima confermare che Codex e Jack/Kanban siano dismessi o repointati, poi rimuovere handleClaudeEvent + i listener + le Map. NON toccare il comando Rust `send_message_via_sdk_streaming` né `pendingQuestionIdsMap`.

**Pending residui:** strip aggressivo (sopra, condizionato a Codex/Jack). Wiring `disposeAgentTerminal(sessionId)` alla chiusura tab/sessione (oggi i PTY restano in Map fino a chiusura app). Nota: il *model override* passato da remote-execute non si applica al `claude` già avviato nel PTY (limite accettato).

## File chiave

- Nuovi: `src/components/AgentTerminalView.tsx` (+`.css`), `src/hooks/useHookStatusListener.ts`, `~/.quack/hooks/brain/quack-status.js`, `documentation/features/069-embedded-cli-hooks-pivot.md`
- Modificati: `src-tauri/src/terminal.rs` (`create_agent_terminal`, `ensure_status_hooks_installed`), `src-tauri/src/lib.rs` (route `/hooks/status`), `src/App.tsx` (mount AgentTerminalView), `.claude/settings.json`, `src/contexts/index.tsx`
- Cancellati: `ChatView`/`ChatInput`/`ChatContext`/`AppRefactored`/`featureFlags` (+ CSS)
- Gotcha: `gotcha-embedded-cli-xterm-persistent-instance.md`, `gotcha-embedded-cli-xterm-pty-resize-sync.md`
