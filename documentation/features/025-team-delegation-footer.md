---
type: feature-doc
project: quack-app
stack: Tauri v2 (Rust) + React 18 (TypeScript)
created: 2026-04-03
last_verified: 2026-04-03
tags: [025-team-delegation-footer, team, delegation, remote-api, mention]
---

## 025 Team Delegation Footer
**Purpose:** Let users delegate tasks to project agents via `@team` mention in chat, with auto-done + lead notification on completion.
**Stack:** Tauri v2 (Rust backend) + React 18 (TypeScript frontend)

### UX Flow
1. User types `@team` in chat (or clicks team icon in footer → inserts `@team `)
2. `@team` appears in the `@` mention dropdown as first option
3. User writes the task: `@team assign Leo to fix the bug`
4. On send, content is enriched with quack-remote instructions (hidden from UI)
5. Lead agent uses `quack-remote` skill to: list agents → choose who → POST /api/execute with `leadSessionId`
6. Teammate sessions auto-complete + notify lead when done

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/ChatView.tsx` | Team icon button in footer → inserts `@team ` via `onInsertAtCursor` |
| Component | `src/components/ChatInput.tsx` | `@team` in mention dropdown, `selectTeam()`, keyboard nav with team offset |
| Service | `src/services/remoteApi.ts` | `notifyLeadAgent()`, `executeRemoteTask()`, `fetchRemoteAgents()` |
| Model/Type | `src/types.ts` | `AgentSession.leadSessionId` — drives auto-done logic |
| Logic | `src/App.tsx` | `@team` content enrichment, `remote-execute` listener (`[Team]` prefix), auto-done in completion block |
| Backend | `src-tauri/src/remote_api.rs` | `ExecuteRequest.lead_session_id`, passed through `remote-execute` event |
| Skill | `~/.claude/skills/quack-remote/SKILL.md` | Documents `leadSessionId` in POST /api/execute |

### Data Flow

#### Delegation (outbound)
```
User types "@team do X" → sendMessageForAgent enriches with [TEAM DELEGATION MODE] hint
→ lead agent reads hint → uses quack-remote skill → GET /api/agents → POST /api/execute {leadSessionId}
→ Rust emits remote-execute → App.tsx listener → createSession({leadSessionId, title: "[Team]..."})
→ daemon starts for teammate
```

#### Auto-done + notification (inbound)
```
Teammate stream finish → completion block checks capturedSession.leadSessionId
→ YES: updateSession({status:'done', completedAt}) + notifyLeadAgent() fire-and-forget
→ NO: session stays in_progress (direct delegation, no callback)
```

### Key Functions
- `selectTeam()` — inserts `@team ` at cursor position in ChatInput
- `showTeamOption` — computed: shows @team in dropdown when filter matches
- Content enrichment (App.tsx sendMessageForAgent): prepends `[TEAM DELEGATION MODE]` + quack-remote instructions + current `activeSessionId`
- `notifyLeadAgent(leadSessionId, session)` — POST /api/sessions/:leadSessionId/send with completion message
- `handle_execute(payload)` — Rust: accepts `lead_session_id`, includes in emitted event

### State
- `showTeamOption`: `boolean` — computed in ChatInput, controls dropdown visibility
- `leadSessionId`: `string | undefined` — on AgentSession, drives auto-done + notification

### Single Decision Rule
```
session.leadSessionId exists?
  YES → auto-done + POST /api/sessions/:leadSessionId/send
  NO  → stays in_progress, manual completion
```
Title prefixes `[Team]` vs `[Remote]` are COSMETIC ONLY — never checked in logic.

### Known Limitation
The `remote-execute` listener uses `setActiveId()` + `pendingAutoStartRef` to auto-start teammate sessions. When the lead agent triggers delegation mid-stream, this can race with the active stream. The session IS created, but the daemon may not start automatically. Workaround: user can click on the teammate's session in the sidebar to activate it.
