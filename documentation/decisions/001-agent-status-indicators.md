---
type: decision
project: quack-desktop
created: 2026-06-28
last_verified: 2026-06-28
tags: [agent-status, sessions, ui, agent-mode, aitaskstore, design]
status: implemented
---

> **Implemented (2026-06-28)** as the cross-project Agent Hub — see
> `features/009-agent-hub.md`. Diverged from the draft below in two ways:
> (1) status is produced by ONE global `AgentHubWatcher` reading app-wide
> signals (backend `claude_code_active_sessions` + the global
> `claude:permission-request` event), NOT by each `AIChatPanel` publishing —
> this sidesteps mount-asymmetry without background-mounting panels (the
> Phase-2 idea below is no longer needed). (2) The hub is global + grouped by
> status with project name+color badges, plus OS notifications and right-click
> lifecycle (done/archive/rename).

# Decision: Per-session agent status indicators

## Context
Alek's headline need: read the state of every agent at a glance to move fast. Today the run-state (working / waiting permission / done) lives only inside `AIChatPanel` (the active session), invisible in the session lists. See `features/001-ai-session-library.md`.

## Target states (mapped to Quack brand semantics)
| State | Meaning | Color token |
|-------|---------|-------------|
| `working` | streaming / running tools | `--accent` (#f28c52), animated |
| `needs-input` | pending question or permission request | `--semantic-warning` (#f59e0b) |
| `idle` | finished, waiting for the user | neutral / `--semantic-success` |
| `error` | run failed | `--semantic-error` (#ef4444) |

## Decision
1. **`agentStatusStore.ts`** — clone the `aiTaskStore` pattern: module-level, keyed by `chatId`, `publish/get/subscribe`. NOT Zustand (transient UI state).
2. **`AIChatPanel` publishes** its derived status (from `streaming`, `runningTools`, pending-permission, error) — single source of truth, no parallel state.
3. **Both lists read it** (`AIChatsRail`, `AgentModeShell` sessions) and render a status dot. Extract the duplicated `modelBadge` into a shared module at the same time.
4. **Agent Mode background**: replicate the `AIChatHost` mount pattern so non-active sessions stay mounted and keep reporting — otherwise status only reflects the active session (see mount-asymmetry gotcha).

## Phasing
- Phase 1: store + publish from active panel + dots in both lists (works fully in editor mode).
- Phase 2: mount background panels in Agent Mode so background agents report too.

## Rejected alternatives
- A second Zustand slice for run-state: heavier, and the run-state is transient, not persisted workspace state. `aiTaskStore` precedent fits better.
- Deriving status by polling the backend per session: no per-session backend handle exists outside the panel; the panel already has the stream.
