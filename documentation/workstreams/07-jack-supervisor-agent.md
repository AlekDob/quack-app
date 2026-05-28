---
ws: 7
title: "Jack Supervisor Agent — finestra dedicata cross-project per orchestrazione agenti"
status: "PHASE 1 MVP + PM WIDGETS IMPLEMENTED — SMOKE TEST PENDING"
focus: current
opened: 2026-05-27
updated: 2026-05-27
---

# WS7 — Jack Supervisor Agent

## Goal

Reinventare Jack (attualmente una personality di default nella sidebar) come **supervisor meta-agent** in una finestra Tauri dedicata persistente. Jack vive al di sopra dei singoli progetti, vede tutti gli agenti in tempo reale, puo' agire su di loro (creare sessioni, delegare task, fermare agenti), e ha accesso nativo a skill quack-remote, whiteboard, project-ops.

## Phases

1. **MVP**: Jack window + chat SDK-powered + multi-session sidebar (3-4gg) — ✅ DONE
2. **Hotkey**: Option+Option activation su Mac, fallback shortcut Windows (2gg) — PENDING
3. **Control Center**: Dashboard agenti/sessioni/progetti + delegation actions (3gg) — PENDING
4. **Server-hosted**: Jack come processo remoto via Remote API (futuro) — DEFERRED

## Status — Phase 1 MVP

**Implementato (2026-05-27):**

- ✅ Rust: `jack_window.rs` (window creation), tray menu entry, registrato in `lib.rs`
- ✅ Vite entry point: `jack.html` + `src/jack.tsx` (apply accent color al mount)
- ✅ Components: `JackApp.tsx`, `JackChat.tsx`, `JackSessionsSidebar.tsx`
- ✅ Hooks: `useJackChat.ts`, `useJackWindow.ts`, `useJackAgentRefresh.ts`
- ✅ Store: `jackStore.ts` (sessions con timeline ClaudeEvents, streamingSessionId per-sessione)
- ✅ Service: `jackPersonalityService.ts` (JACK_AGENT_ID, JACK_AVATAR, buildJackSystemPrompt)
- ✅ Persistence: `jackSessionsStorage.ts` (Tauri Store `jack-sessions.json`, MAX 500 timeline items)
- ✅ Cross-project visibility: legge `quack-agents.json` + `.quack-repo-order.dat`, event-driven refresh
- ✅ SDK streaming: full tool access (`permissionMode: 'bypass'`), sdkSessionId per multi-turn continuation
- ✅ Multi-session sidebar: 220px wide, "+Nuova chat", auto-title, delete on hover, time formatting
- ✅ Settings UI: nuova categoria "Jack" in UnifiedSettings, model selector, shortcut display
- ✅ Toolbar entry: ActionIcons icon Cmd+Shift+J shortcut
- ✅ StreamMessage rendering: full fidelity con main chat (tool_use, thinking, AskUserQuestion)

**PM Widgets — Inline Visual Tools (Phase 1.5, 2026-05-27):**

- ✅ 4 widget React in `src/components/jack/widgets/`: `WorkstreamBoard`, `TaskSuggester`, `AgentActivityGrid`, `DailyBriefing`
- ✅ CSS shared: `.jack-widget` shell con glass effect + per-widget styles
- ✅ Types in `widgets/types.ts`: `WorkstreamBoardData`, `TaskSuggestData`, `AgentGridData`, `DailyBriefingData`
- ✅ Wire in `MarkdownText.tsx`: lazy imports + `flushCodeBlock()` switch su lang tag (`ws-board`, `task-suggest`, `agent-grid`, `briefing`)
- Layout: inline nel chat stream come code block speciali

**Bug critici risolti:**

- Eventi assistente cross-session leak quando si cambia sessione durante streaming — fix con `appendToSession(capturedId, ...)`, mai `activeSessionId` da callback async
- Indicatore "sta pensando" + bottone Stop cross-session — fix con `streamingSessionId` per-sessione nello store
- `claude.defaultModel` (campo inesistente) → `claude.jackModel || claude.model`
- Header overlap traffic lights macOS → `paddingTop: 38` sul header sidebar
- Bottone Invia disallineato → `alignItems: 'center'` su input area
- StatusBar ridondante rimossa (data loading estratto in hook)

**Files**: 17 nuovi + 7 modificati. Build OK: `dist/jack.html` 2.10kb + `jack-*.js` 14.23kb.

## Key Decisions

- Finestra persistente Tauri (non overlay/spotlight)
- Full control: osservare + agire su altri agenti
- Backend: Claude Code SDK con multi-provider (sistema gia' implementato)
- Sessions persistite in `jack-sessions.json` separato (NON nel `quack-agents.json`) per isolare lo stato meta-agent
- Jack e' singleton di sistema, non cancellabile
- Solo UN stream concorrente per ora — l'input nelle altre sessioni e' disabilitato se stream attivo altrove. Multi-stream e' refactor separato (Phase 3+)

## Brain entries

- `documentation/bugs/fix-jack-multisession-events-wrong-session.md` — cross-session event leak + indicator leak
- `documentation/features/073-jack-supervisor-window.md` — feature doc

## Next (Phase 2)

- macOS `CGEventTap` doppio Option entro 400ms (`jack_hotkey.rs`)
- Windows `SetWindowsHookExW` doppio VK_MENU
- Fallback shortcut Cmd+Shift+J / Ctrl+Shift+J (gia' wired, manca solo l'hotkey nativa)
- Graceful degradation se Accessibility permission negata

## Plan

Architecture details: `~/.claude/plans/skill-project-ops-stavo-pensando-encapsulated-hejlsberg.md`
