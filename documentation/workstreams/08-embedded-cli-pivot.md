---
ws: 8
title: "Embedded CLI Pivot — centro = Claude Code interattivo, stato dagli hook"
status: "RENDER + AUTOSTART + HOOK-STATUS WORKING — Fasi 4/7/9 PENDING"
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
4. **Sorgente token da transcript** — su Stop leggere `transcript_path` per ultimo messaggio + token approssimati (AgentTokenStatsPanel) — ⏳ PENDING
5. **Flip + validazione consumer** — ✅ DONE (validato nell'app reale)
6. **Cancellare il centro chat-stream** — ChatView/ChatInput/ChatContext/AppRefactored/featureFlags cancellati (~5.500 righe) — ✅ DONE (tsc 0)
7. **Strip path SDK in App.tsx** — rimuovere handleClaudeEvent/sendMessageForAgent/Map pending* — ⏳ DEFERRED (Jack/Kanban/BTW usano ancora sendMessageForAgent → prima Fase 9)
9. **Guard degradazione headless** — Jack/BTW/Kanban-inline/Remote-execute/Telegram/PWA mirror dietro fallback "non disponibile in embedded mode" — ⏳ PENDING

## Status (2026-05-29)

**Funzionante e validato nell'app reale:**

- ✅ Pipeline hook→stato: dot sidebar/TaskHub guidati da claude interattivo (no SDK)
- ✅ **Pallino verde sidebar**: su `UserPromptSubmit` aggiunto marker `user` contentless (altrimenti `AgentSessionItem` resta DORMANT e blocca il verde); su `Stop` marker assistant complete
- ✅ **Render TUI** stabile: container `position:absolute; inset:0` + fit con retry rAF + ResizeObserver + window-resize
- ✅ **Autostart `claude`**: one-shot per PTY (Set `createdTerminals`/`launchedTerminals`), trigger su primo byte + fallback 1200ms, StrictMode-safe
- ✅ **Persistenza istanza xterm** (Map globale `agentTerminalInstances`): l'xterm + listener NON vengono mai distrutti all'unmount, solo ri-agganciati — fix del "terminale vuoto" causato dal dispose/recreate su doppio-mount di StrictMode

**Pending:** Fase 4 (token), Fase 7 (strip SDK App.tsx), Fase 9 (guard headless). Wiring `disposeAgentTerminal(sessionId)` alla chiusura tab/sessione (oggi i PTY restano in Map fino a chiusura app).

## File chiave

- Nuovi: `src/components/AgentTerminalView.tsx` (+`.css`), `src/hooks/useHookStatusListener.ts`, `~/.quack/hooks/brain/quack-status.js`, `documentation/features/069-embedded-cli-hooks-pivot.md`
- Modificati: `src-tauri/src/terminal.rs` (`create_agent_terminal`, `ensure_status_hooks_installed`), `src-tauri/src/lib.rs` (route `/hooks/status`), `src/App.tsx` (mount AgentTerminalView), `.claude/settings.json`, `src/contexts/index.tsx`
- Cancellati: `ChatView`/`ChatInput`/`ChatContext`/`AppRefactored`/`featureFlags` (+ CSS)
- Gotcha: `gotcha-embedded-cli-xterm-persistent-instance.md`, `gotcha-embedded-cli-xterm-pty-resize-sync.md`
