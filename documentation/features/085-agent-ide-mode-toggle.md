---
type: feature-doc
project: quack-desktop
stack: Tauri + React
created: 2026-07-20
startDate: 2026-07-20
endDate:
last_verified: 2026-07-20
status: active
tags: [agent-mode, ide-mode, layout-toggle, performance, remount, chat-hydrate]
related:
  - 001-ai-session-library.md
  - 043-chat-transcript-persistence.md
  - 058-workspace-switch-performance.md
  - 075-chat-switch-loader.md
  - 076-chat-lazy-hydrate-done-unload.md
  - 079-cold-project-switch-loader.md
  - 081-chat-switch-chrome-freeze.md
  - 084-agent-context-panels.md
  - 086-perf-audit-window.md
  - 087-new-chat-perf.md
---

## Agent Mode ↔ IDE layout toggle
**Purpose:** Global Agents ↔ IDE layout preference (`lcp.agentMode`): Agent Mode replaces the editor-centric shell with a sessions + chat + context column; leaving remounts every `WorkspaceShell`. Instrument, measure, and keep chat hydrate warm across the swap.
**Stack:** Tauri 2 + React 19 / TypeScript, plain CSS tokens

### Tasks
- [x] Feature doc + CLAUDE.md KB entry
- [x] Dev instrumentation `[agent-mode-switch]` (`switchPerf.ts` + Perf Audit ring `086`)
- [x] Trigger-file sim (`agentModeSwitchSim.ts`)
- [x] Measure cold Agent→IDE (user console + automated sim)
- [x] Warm hydrate: use RAM when present; never force-drop empty new chats (`AIChatPanel` + `087`)
- [ ] Keep shells mounted / lazy terminals / veil — deferred

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Store/State | `src/agentMode.ts` | `get/set/toggle/useAgentMode`; marks switch start |
| Component | `src/App.tsx` | `AgentModeShell` XOR `WorkspaceShell`s; DEV sim poll |
| Component | `src/components/AgentModeShell.tsx` | Agent layout; `agent-shell mounted` |
| Component | `src/components/WorkspaceShell.tsx` | IDE shell; `ide-shell mounted` / `editors ready` |
| Component | `src/components/AIChatPanel.tsx` | Conditional `force` hydrate + phase logs |
| Component | `src/components/FileTree.tsx` | `filetree root loaded` phase |
| Component | `src/components/TerminalCore.tsx` | `terminal attached` + `replayMs` |
| Component | `src/components/TopBar.tsx` | Agents / IDE toggle |
| Service | `src/actions.ts` | `view.toggle_agent_mode` |
| Util | `src/switchPerf.ts` | `markAgentModeSwitch` / `logAgentModePhase` |
| Util | `src/agentModeSwitchSim.ts` | Trigger-file round-trip → JSON report |
| Test | `src/switchPerf.test.ts` | Agent-mode mark/phase contract |

### Data Flow
```
toggleAgentMode → setAgentMode → markAgentModeSwitch
  → App re-render (full shell swap)
  → phases: ide-shell|agent-shell mounted → editors ready
  → chat hydrate (cacheHit? RAM : disk) → terminal attached…
```

- **IDE → Agent:** unmount all `WorkspaceShell` + ActivityBar + hub rail → `AgentModeShell`
- **Agent → IDE:** unmount `AgentModeShell` → remount N `WorkspaceShell` + chrome

Constraint: one `AIChatPanel` owner per chat (no double stream). Chat bodies can stay in `chatStoreCache` across the swap; Monaco warm-LRU (`058`) does **not**.

### Warm hydrate (2026-07-20)

| Before | After |
|---|---|
| Every remount `ensureSessionLoaded({ force: true })` | Use RAM when present; disk only if cold |
| Then: `force` if `!cached \|\| messages.length === 0` | **Removed empty-force** — empty new chats were paying `chat_store_load` miss (~3s) |
| ~2.6s disk reload on 102-msg chat (OS page-cache cold after idle) | RAM hit → `cacheHit: true` |
| New chat `msgCount: 0` still forced disk | `addAIChat` seeds empty body in RAM → instant hydrate (`087`) |

Project switch still clears bodies via `dropAllCachedBodies` (`043`) before remount — cold load remains correct there. Full new-chat paint path (sync empty apply + `afterFirstPaint`): **`087-new-chat-perf.md`**.

### Measurement

**User console (cold, 8 projects, 102 msgs, 9 terminals) — Agent → IDE**

| Phase | sinceMs | Notes |
|---|---|---|
| `ide-shell mounted` ×8 | 52–68 | All open workspaces |
| `editors ready` | ~55 | False done (2× rAF) |
| `session loaded` | loadMs **2661** | Forced disk (pre-fix) |
| `terminal attached` ×9 | **4440–4453** | `replayMs` ~368–381 |
| `chat hydrate done` | **4474** | Wall ≈ max(hydrate, terminals) |

`refuse shrink 102→1` ×3 — concurrent thin hydrate; `preferRicherSession` kept rich.

**Automated sim (lighter):** Agent→IDE ~558ms / IDE→Agent ~671ms (terminals + hydrate).

### How to re-run sim
1. `touch documentation/.agent-mode-sim-trigger`
2. Wait with `tauri dev` open (~5–15s)
3. Read `documentation/.agent-mode-sim-results.json` or `/tmp/quack-agent-mode-sim-results.json`
4. Console filter: `[agent-mode-switch]` (or Perf Audit window `086`)

### Gotchas
- `editors ready` ≠ interactive.
- Multi-project remounts every shell in `shellOrder`.
- Terminal remount still dominates with many PTYs (lazy attach deferred).
- No veil on this path (`075`/`079` are chat/project only).

### Fix candidates (remaining)
1. Keep `WorkspaceShell` mounted in Agent Mode (`display:none`) + single chat owner.
2. Lazy-mount only visible `TerminalCore` on mode return.
3. Veil until hydrate done + terminal quiet.
