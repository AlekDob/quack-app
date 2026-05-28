---
ws: 5
title: "Remote Terminal Management — API endpoints per terminali visibili"
status: "BE + FE + SKILL IMPLEMENTED — REBUILD NEEDED"
warning: |
  Skill quack-remote.md e' bundled via include_str! — agenti esterni non vedono i nuovi endpoint finche' Quack non viene rebuildato.
focus: current
opened: 2026-05-27
updated: 2026-05-27
feature: documentation/features/062-quack-remote.md
---

# WS5 — Remote Terminal Management

## Goal

Permettere agli agenti Claude (via skill `quack-remote`) di creare terminali visibili nell'UI di Quack, eseguire comandi in background e leggere l'output — senza bloccarsi. Quando un terminale viene creato da remoto, la finestra terminali si apre in primo piano e il terminale si auto-seleziona. L'utente ha feedback visivo in tempo reale.

## Scope

- 6 endpoint REST sotto `/api/terminals` (create, list, get, write, output, close)
- Output ring buffer (5000 righe) nel backend Rust per cattura output PTY
- 3 nuovi eventi WebSocket (TerminalCreated, TerminalOutput, TerminalClosed)
- Frontend: auto-select + focus finestra terminali su creazione remota
- Aggiornamento skill `quack-remote` con documentazione endpoint + workflow tipico

Deliverable: un agente esterno puo' fare `POST /api/terminals` + `POST /api/terminals/:id/write` e il terminale appare live nell'UI.

## Status detail

Piano completo redatto. File coinvolti:

| File | Cambiamento |
|------|-------------|
| `src-tauri/src/remote_api_terminal.rs` | **NUOVO** — 6 handler axum (~220 righe) |
| `src-tauri/src/terminal.rs` | `pub(crate)` su `_impl` fn, `OutputRingBuffer`, helper flush |
| `src-tauri/src/remote_ws.rs` | 3 varianti WsEvent + `WS_BROADCAST` static |
| `src-tauri/src/remote_api.rs` | 5 route `/terminals*` in router |
| `src-tauri/src/lib.rs` | `mod remote_api_terminal` + init `WS_BROADCAST` |
| `src/App.tsx` | Listener `terminal-list-changed` → auto-select + focus window |
| `src/components/TerminalWindowApp.tsx` | Listener `terminal-window-select-terminal` |
| `src-tauri/templates/skills/quack-remote.md` | Sezione Terminal Management |

Piano dettagliato: `.claude/plans/inherited-enchanting-widget.md`

## Next action

Rebuild Quack (`pnpm tauri build` o `pnpm tauri dev`) per aggiornare la skill bundled. Poi smoke test con curl contro i nuovi endpoint.
