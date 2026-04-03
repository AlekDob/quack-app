# Feature Specification: Team Delegation from Chat Footer

## Problem Statement

Team delegation currently lives in `div.repo-action-row` (RepositoryGroup.tsx), which is hidden on hover and disconnected from the chat workflow. Users need to navigate away from the active conversation to create a team. Additionally, the current team system uses Tauri commands (`create_team`) which are separate from the Remote API — making it inconsistent with how remote execution works.

There are two distinct delegation patterns in Quack:

1. **Direct delegation** — the user says "affida a Leo" and switches to work with Leo directly. No callback needed. This is `quack-remote` skill usage.
2. **Managed delegation** — the user says "gestisci tu il team" and the lead agent orchestrates. Teammates auto-complete and notify the lead. This is the team footer icon.

Both use `POST /api/execute` under the hood. The **only difference** is whether `leadSessionId` is set.

## User Stories

### Story 1: Quick Team Delegation from Chat Footer

As a user working in a chat session,
I want to click a team icon in the footer controls and select agents to delegate to,
So that I can dispatch tasks to teammates without leaving the conversation.

**Acceptance Criteria:**
- [ ] Team icon visible in `div.chat-view-footer-controls` (next to existing icons)
- [ ] Click opens a lightweight agent selector popover
- [ ] User can select 1+ agents from ALL available agents (including those without a project)
- [ ] Selected agents receive tasks via Quack Remote API (`POST /api/execute`)
- [ ] Sessions created on teammates have `[Team]` prefix in title (cosmetic only)
- [ ] Agents without a project receive the lead's `projectPath` as override

### Story 2: leadSessionId-Driven Auto-Done + Notification

As the system,
When a session has a `leadSessionId`, I auto-complete it on finish and notify the lead,
So that managed delegation has reliable callbacks regardless of source.

**Acceptance Criteria:**
- [ ] When a session with `leadSessionId` finishes streaming → `status: 'done'` + `completedAt`
- [ ] On completion, `POST /api/sessions/:leadSessionId/send` with formatted notification
- [ ] Notification includes: teammate name, task summary, completion status
- [ ] Lead agent sees the notification inline in their chat
- [ ] Sessions WITHOUT `leadSessionId` remain `in_progress` (no auto-done)

### Story 3: Agents Without Project Can Receive Tasks

As a user,
I want to delegate tasks to agents that don't have a project assigned,
So that I can use any available agent for team work.

**Acceptance Criteria:**
- [ ] `POST /api/execute` accepts optional `projectPath` override
- [ ] If agent has no project, the override `projectPath` is used
- [ ] TeamDelegationPopover shows ALL agents, not just those with projects
- [ ] The popover passes the lead's current `projectPath` for agents without one

## Non-Functional Requirements

- Performance: Team delegation should complete in < 2s (API call + session creation)
- UX: Footer icon should not clutter the controls — use a compact popover
- Consistency: Uses existing Quack Remote API, no new Tauri commands needed
- Robustness: Logic based on `leadSessionId` field, not title prefix string matching

## Success Metrics

- Team delegation accessible in 1 click from chat (vs. current 3+ clicks)
- Teammates auto-notify on completion (vs. manual polling)
- Any agent can participate in team delegation (no project requirement)

## Out of Scope

- Multi-turn team conversations (teammates get 1 prompt, respond once)
- Team progress dashboard in chat (existing RemoteTeamWidget handles this)
- Removing old team creation from repo-action-row (can coexist for now)

## Clarifications

### Q1: How is managed delegation different from direct delegation?

**Context**: Both use `POST /api/execute`. The user needs clarity on when each pattern applies.
**Answer**: The ONLY difference is `leadSessionId`:
- **Direct** (quack-remote skill): no `leadSessionId` → session stays `in_progress`, user works with the agent directly
- **Managed** (team footer icon): `leadSessionId` set → auto-done on finish + notification to lead
The title prefix (`[Team]` vs `[Remote]`) is cosmetic. All logic checks `leadSessionId`.

### Q2: Where do we store the lead session ID?

**Context**: Needs to survive persistence and be accessible on session completion.
**Answer**: `leadSessionId` as a new optional field on `AgentSession` type. Persisted with the session, read on completion.

### Q3: What UI does the footer icon open?

**Context**: Existing TeamCreationModal is heavyweight.
**Answer**: Lightweight popover — agent checkboxes + task textarea + "Delega" button. Current agent is automatically the lead. No team name needed (auto-generated if needed).

### Q4: How do we handle agents without a project?

**Context**: Currently `/api/execute` uses the agent's configured `projectPath`. Some agents are "free".
**Answer**: `POST /api/execute` already accepts an optional `projectPath` in the payload. If the agent has no project, the caller passes the lead's `projectPath`. The popover reads the current project context and sends it as override.

### Q5: How is the completion notification delivered?

**Context**: The lead agent is running in an active session.
**Answer**: `POST /api/sessions/:leadSessionId/send` with a formatted message. The message is injected as a user message into the lead's conversation. Format: `"🦆 [Team Complete] Agent {name} ha completato il task assegnato.\n\nTask: {prompt}\nStatus: Completato"`
