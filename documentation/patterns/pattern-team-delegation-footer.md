---
type: pattern
project: quack-app
created: 2026-04-03
last_verified: 2026-04-03
tags: [team, delegation, remote-api, popover, footer, agents]
---
# Pattern: Team Delegation from Chat Footer

## Context

Team delegation lives in the chat footer controls, allowing users to dispatch tasks to other agents without leaving the active conversation. This replaces the old team creation flow that lived in `RepositoryGroup.tsx` (hidden on hover, 3+ clicks away).

## Two Delegation Patterns

Quack has two distinct delegation modes, both using `POST /api/execute`:

| Mode | Trigger | `leadSessionId` | Auto-done | Notification |
|------|---------|-----------------|-----------|-------------|
| **Direct** | `quack-remote` skill / user prompt | NOT set | No | No |
| **Managed** | Team footer icon (this pattern) | SET | Yes | Yes |

The **only programmatic difference** is whether `leadSessionId` is populated. Title prefixes (`[Team]` vs `[Remote]`) are cosmetic — all logic checks `leadSessionId`.

## Architecture

### Components

| File | Role |
|------|------|
| `src/components/TeamDelegationPopover.tsx` | Popover UI: agent checkboxes + task textarea + submit |
| `src/components/TeamDelegationPopover.css` | Glassmorphism styling, slide-up animation |
| `src/services/remoteApi.ts` | `fetchRemoteAgents()`, `executeRemoteTask()`, `notifyLeadAgent()` |
| `src/components/ActionIcons.tsx` | Footer icon that toggles the popover |

### Data Flow

1. User clicks team icon in `div.chat-view-footer-controls`
2. `TeamDelegationPopover` opens, calls `fetchRemoteAgents()` → `GET /api/agents`
3. User selects agents + writes task description
4. `handleDelegate()` calls `executeRemoteTask()` for each selected agent with `leadSessionId = currentSessionId`
5. Each teammate receives a new session via `POST /api/execute`
6. On teammate completion (stream ends + `leadSessionId` present) → auto-done + `notifyLeadAgent()`
7. Lead receives inline notification via `POST /api/sessions/:leadSessionId/send`

### Key Implementation Details

- **Outside click dismiss**: `useEffect` with `mousedown` listener and `popoverRef.contains()` check
- **Agent filtering**: current agent is excluded from the list (`agents.filter(a => a.id !== currentAgentId)`)
- **Project override**: agents without a project receive the lead's `projectPath` as fallback
- **Parallel dispatch**: tasks are sent sequentially per agent (for loop), but could be parallelized if needed
- **Error aggregation**: failures are collected per-agent and displayed; partial success still closes the popover

### CSS Pattern

Popover uses `position: absolute; bottom: calc(100% + 8px)` to float above the footer. Glassmorphism with `backdrop-filter: blur(20px)`, dark translucent background, and a 0.15s slide-up animation.

## Notification Format

```
🦆 [Team Complete] Agent {agentId} ha completato il task assegnato.

Task: {taskSummary}
Status: Completato
```

The `taskSummary` is derived from `session.title` with `[Team]`/`[Remote]` prefix stripped.

## When to Use This Pattern

- Adding new delegation targets (e.g., MCP servers, external agents)
- Modifying the auto-done/notification flow
- Extending the popover with agent status, progress, or result preview
- Building similar footer popovers (same positioning + dismiss + animation pattern)
