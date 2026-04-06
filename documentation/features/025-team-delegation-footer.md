---
type: feature-doc
project: quack-app
stack: Tauri v2 (Rust) + React 18 (TypeScript)
created: 2026-04-03
last_verified: 2026-04-06
tags: [025-team-delegation-footer, team, delegation, remote-api, mention]
---

## 025 Team Delegation Footer
**Purpose:** Let users delegate tasks to project agents via `@team` mention in chat, with auto-done + lead notification on completion.
**Stack:** Tauri v2 (Rust backend) + React 18 (TypeScript frontend)

### UX Flow
1. User types `@` in chat — autocomplete shows project teammates (sibling terminals in same cwd)
2. Teammates are sourced from `projectTerminals` prop (filtered in App.tsx: same cwd, different id)
3. User writes the task: `@leo fix the bug` or `@team delegate to Leo: fix the bug`
4. Teammate mention chips render below input (orange-branded, via `chat-input-team-chip` class)
5. On send, content is enriched with quack-remote instructions (hidden from UI)
6. Lead agent uses `quack-remote` skill to: list agents → choose who → POST /api/execute with `leadSessionId`
7. Teammate sessions auto-complete + notify lead when done

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/ChatView.tsx` | Team icon button in footer → inserts `@team ` via `onInsertAtCursor` |
| Component | `src/components/ChatInput.tsx` | `@team` in mention dropdown via `projectTerminals` prop, `selectTeammate()`, teammate mention chips |
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
- `selectTeammate(name)` — inserts teammate name at cursor position in ChatInput
- `filteredTeammates` — computed from `projectTerminals` prop (same cwd, different id), filtered by `@` mention text
- Content enrichment (App.tsx sendMessageForAgent): prepends `[TEAM DELEGATION MODE]` + quack-remote instructions + current `activeSessionId`
- `notifyLeadAgent(leadSessionId, session)` — POST /api/sessions/:leadSessionId/send with completion message
- `handle_execute(payload)` — Rust: accepts `lead_session_id`, includes in emitted event

### State
- `projectTerminals`: `TerminalInfo[]` — prop passed from App.tsx, sibling terminals with same cwd (global → component)
- `filteredTeammates`: `TerminalInfo[]` — computed from projectTerminals, filtered by @mention text (component)
- `leadSessionId`: `string | undefined` — on AgentSession, drives auto-done + notification (session)

### Single Decision Rule
```
session.leadSessionId exists?
  YES → auto-done + POST /api/sessions/:leadSessionId/send
  NO  → stays in_progress, manual completion
```
Title prefixes `[Team]` vs `[Remote]` are COSMETIC ONLY — never checked in logic.

### Teammate Source Change (2026-04-06)
Previously, team members were sourced from `useTeamStore` (remote team config). Now they come from `projectTerminals` — sibling terminals in the same working directory. This means delegation targets are always the actual running agents in the same project, not a static team config. The `useTeamStore` import was removed from ChatInput.tsx.

### Known Limitation
The `remote-execute` listener uses `setActiveId()` + `pendingAutoStartRef` to auto-start teammate sessions. When the lead agent triggers delegation mid-stream, this can race with the active stream. The session IS created, but the daemon may not start automatically. Workaround: user can click on the teammate's session in the sidebar to activate it.
