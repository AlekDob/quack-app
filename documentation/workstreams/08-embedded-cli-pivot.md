---
ws: 8
title: "Embedded CLI Pivot — centro = Claude Code interattivo, stato dagli hook"
status: "RENDER + AUTOSTART + HOOK-STATUS + TOKEN + SDK-GUARD WORKING — Fase 7 BLOCCATA (design)"
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
7. **Strip path SDK in App.tsx** — ⛔ BLOCCATA (non è dead-code): `handleClaudeEvent` + listener `claude-event` + `sendMessageForAgent` restano VIVI perché remote-execute/remote-send-message (Telegram/PWA/Remote)/DroidFactory/auto-start/git-commit streammano ancora via SDK sul main agent. Strippare romperebbe quelle feature. Serve PRIMA una decisione di design: repointare quei "send" sul PTY (`write_to_terminal`) invece dell'SDK. Vedi sezione "Fase 7 — perché è bloccata".
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

## Fase 7 — perché è bloccata (non è dead-code)

L'audit (3 esploratori) ha smentito l'assunto del piano. `handleClaudeEvent` (App.tsx 1526–1897), il listener `claude-event:${agentId}` (2478–2656) e `sendMessageForAgent` (2847–3554) **NON sono morti**: sono ancora cablati a feature vive che streammano via SDK sul **main agent**:

- `remote-execute` / `remote-send-message` (App.tsx ~6100/6138) ← Remote API (WS5), **Telegram**, **PWA inbound** convergono qui
- `DroidFactoryDrawer` `onSendMessage` (App.tsx 14366)
- auto-start (ref consumers) + git-commit-message handler (12363)

Tutti chiamano `sendMessageForAgentRef.current(...)` → `invoke('send_message_via_sdk_streaming')` → emette `claude-event:${activeAgentId}` → processato SOLO da `handleClaudeEvent`. Inoltre il flag che il piano assumeva (`useEmbeddedCLI`) **non esiste più** (cancellato in Fase 6): embedded è permanente, niente rollback.

**Prerequisito per la Fase 7:** decidere il comportamento "embedded" di quei send → repointarli da SDK a **`write_to_terminal`** sul PTY del main agent (digitare il prompt nel `claude` interattivo) invece di `send_message_via_sdk_streaming`. Solo dopo aver repointato (e validato nell'app) si può rimuovere `handleClaudeEvent` + listener `claude-event` + `sendMessageForAgent` + le Map `pending*` (607/611/614/618) e i 3 listener SDK (ask-user-question/tool-permission/plan-approval, surgicalmente dentro l'effetto 5640–6160). NON toccare il comando Rust `send_message_via_sdk_streaming` (usato anche da Jack/BTW/Kanban) né `pendingQuestionIdsMap` (condiviso).

**Pending residui:** Fase 7 (sopra). Wiring `disposeAgentTerminal(sessionId)` alla chiusura tab/sessione (oggi i PTY restano in Map fino a chiusura app).

## File chiave

- Nuovi: `src/components/AgentTerminalView.tsx` (+`.css`), `src/hooks/useHookStatusListener.ts`, `~/.quack/hooks/brain/quack-status.js`, `documentation/features/069-embedded-cli-hooks-pivot.md`
- Modificati: `src-tauri/src/terminal.rs` (`create_agent_terminal`, `ensure_status_hooks_installed`), `src-tauri/src/lib.rs` (route `/hooks/status`), `src/App.tsx` (mount AgentTerminalView), `.claude/settings.json`, `src/contexts/index.tsx`
- Cancellati: `ChatView`/`ChatInput`/`ChatContext`/`AppRefactored`/`featureFlags` (+ CSS)
- Gotcha: `gotcha-embedded-cli-xterm-persistent-instance.md`, `gotcha-embedded-cli-xterm-pty-resize-sync.md`
