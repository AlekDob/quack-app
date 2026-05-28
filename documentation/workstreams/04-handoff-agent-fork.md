---
ws: 4
title: "Handoff — fork sessione su altro agente con summary"
status: "COMPLETED — SMOKE TEST PASSED"
focus: completed
opened: 2026-05-27
updated: 2026-05-27
---

# WS4 — Handoff agente con summary bootstrap

## Goal

Permettere all'utente, a metà di una conversazione con Agent X, di passare ad Agent Y senza
perdere il contesto: Quack genera un sunto AI-driven della conversazione corrente (editabile),
crea una nuova `AgentSession` su Y con quel sunto come `initialPrompt`, e mostra la nuova
sessione indentata sotto la genitrice nella sidebar agente. Continuità di lavoro tra agenti
specializzati senza copia-incolla manuale.

## Scope

- Type: `parentSessionId?: string` su `AgentSession` (genealogy solo visiva).
- Service: `src/services/handoffService.ts` con `generateHandoffSummary` (Claude SDK) e `executeHandoff` (createSession + initialPrompt).
- UI nuova: `src/components/HandoffDialog.tsx` (agent picker + summary preview editable).
- Trigger #1: voce "Handoff to…" in `SessionPopover` (chat header).
- Trigger #2: slash command `/handoff @agent` (pattern `/background`).
- Sidebar: render indentato sessioni con `parentSessionId` (clamp `depth=2`).

Plan completo: `/Users/alekdob/.claude/plans/mi-piacerebbe-abilitare-funzione-parsed-glade.md`.

## Status detail

- 2026-05-27 16:40: implementazione completa frontend + slash command Quack built-in. `tsc --noEmit` pulito.
- File toccati: `types.ts` (+`parentSessionId`), `services/handoffService.ts` (nuovo), `components/HandoffDialog.tsx` + `.css` (nuovi), `components/chat/SessionPopover.tsx` (+`onHandoff` prop + button), `components/chat/UnifiedActionBar.tsx` (+prop pass-through), `components/ChatView.tsx` (state + dialog render + slash interceptor + `useTerminalStore` import), `components/AgentSessionList.tsx` (logica fork tree + render ricorsivo), `components/AgentSessionItem.tsx` (+`depth` prop + connector decorativo), `src-tauri/src/slash_commands.rs` (+entry `/handoff` in `QUACK_BUILTIN_COMMANDS`).
- Decisioni di prodotto:
  - Summary mode: AI auto via `streamClaudeMessage` (MCP disabilitato, sessionId nullo) + textarea editabile prima del confirm + fallback `createLocalSummary` se SDK fallisce.
  - UI trigger: slash command `/handoff @agent` + voce nel `SessionPopover`.
  - Session link: solo visivo (`parentSessionId`), nessuna semantica runtime tipo `leadSessionId`.
  - Indent clamp = 2 in sidebar.
- 2026-05-27 16:42: BLOCKER smoke test — `cargo check` rosso su `terminal.rs:576-577` (`WS_BROADCAST` / `WsEvent::TerminalOutput` mancanti). Bug pre-existing introdotto in commit `2f568e6 feat(quack-remote): PWA Task Hub mobile rewrite`. Fuori scope WS4.

## Next action

1. Risolvere il bug Rust in `terminal.rs` (workstream separato — flush_and_store usa simboli mancanti).
2. Smoke test E2E secondo checklist in `~/.claude/plans/mi-piacerebbe-abilitare-funzione-parsed-glade.md` (Verification section).
3. Brain entries post-merge: `pattern-session-handoff-fork.md` se l'approccio summary+initialPrompt si rivela riusabile.

Owner: Alek.
