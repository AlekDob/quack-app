# Implementation Tasks: 025 Team Delegation Footer

## Phase 1: Data Model

- [x] 1.1 Add `leadSessionId` to AgentSession type
  - File: `src/types.ts`
  - Add `leadSessionId?: string` to AgentSession interface
  - **Depends on**: None

## Phase 2: Rust Backend — Remote Execute Enhancement

- [x] 2.1 Add `leadSessionId` to ExecuteRequest struct
  - File: `src-tauri/src/remote_api.rs` (find ExecuteRequest struct)
  - Add `lead_session_id: Option<String>` field with serde rename
  - Pass it through in the `remote-execute` Tauri event payload
  - **Depends on**: None

## Phase 3: Frontend — Remote Execute Listener

- [x] 3.1 Handle `leadSessionId` in remote-execute event listener
  - File: `src/App.tsx` (~line 5499, remote-execute handler)
  - Read `leadSessionId` from event payload
  - Store it on created session via `addSession()`
  - Use `[Team]` title prefix when `leadSessionId` present, `[Remote]` otherwise
  - **Depends on**: 1.1, 2.1

## Phase 4: Auto-Done + Notification Logic

- [x] 4.1 leadSessionId-driven auto-done in sendMessageForAgent
  - File: `src/App.tsx` (~line 2940, completion block)
  - Check `capturedSession?.leadSessionId` (NOT title prefix)
  - If present: set `status: 'done'` + `completedAt`
  - **Depends on**: 3.1

- [x] 4.2 Create notifyLeadAgent function
  - File: `src/services/remoteApi.ts` (NEW or existing remote service)
  - Read remote config via `invoke('get_remote_config')`
  - POST /api/sessions/:leadSessionId/send with formatted message
  - Handle errors gracefully (lead session gone, API down)
  - **Depends on**: None

- [x] 4.3 Call notifyLeadAgent on [Team] session completion
  - File: `src/App.tsx` (after auto-done in completion block)
  - Call `notifyLeadAgent(leadSessionId, agentName, sessionTitle)`
  - Fire-and-forget (don't block completion flow)
  - **Depends on**: 4.1, 4.2

## Phase 5: Footer UI

- [x] 5.1 Create TeamDelegationPopover component
  - File: `src/components/TeamDelegationPopover.tsx` (NEW, < 300 lines)
  - Fetch agents via GET /api/agents (using remote config)
  - Agent list with checkboxes (exclude current agent)
  - Show ALL agents including those without projects
  - Task prompt textarea
  - "Delega" button
  - On submit: POST /api/execute per agent with { leadSessionId, projectPath override }
  - Toast feedback on success/failure
  - **Depends on**: 2.1, 4.2

- [x] 5.2 Add Team icon to chat-view-footer-controls
  - File: `src/components/ChatView.tsx` (~line 868)
  - Add team icon button (Users/People icon) that toggles popover
  - Style consistent with existing footer controls (same size, hover, dark theme)
  - **Depends on**: 5.1

- [x] 5.3 CSS for TeamDelegationPopover
  - File: `src/components/TeamDelegationPopover.css` or inline in component
  - Popover positioning (above footer), agent list, dark theme
  - Consistent with existing popover patterns (ChatSettingsMenu)
  - **Depends on**: 5.1

## Notes

- **Single decision rule**: `leadSessionId` present → auto-done + notify. Nothing else.
- **Title prefix is cosmetic**: `[Team]` vs `[Remote]` for user clarity only, never checked in logic.
- Phase 1-4 = backend + logic (~1.5h), Phase 5 = UI (~1.5h)
- Total estimated effort: ~3 hours
