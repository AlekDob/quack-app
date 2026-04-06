---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-06
last_verified: 2026-04-06
tags: [plan-delegate-remote, plan-mode, delegation, agent-picker, remote-execute, tauri-invoke]
---

## Plan Delegate Remote
**Purpose:** Delegate an agent's plan to another project agent via Tauri invoke + remote-execute event. The lead agent receives a reject with delegation feedback so it exits plan mode without executing.
**Stack:** React 18, TypeScript strict, Tauri v2, Rust

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/PlanWidget.tsx` | Plan display with Approve/Reject/Delegate buttons + inline agent picker; calls `invoke('delegate_plan_to_agent')` |
| Component | `src/components/PlanWidget.css` | Styles for plan widget, approval row, agent picker, delegate button |
| Service | `src/services/remoteApi.ts` | `executeRemoteTask(params)`, `fetchRemoteAgents()`, `notifyLeadAgent()` — Remote API client (used by TeamDelegationPopover, not PlanWidget) |
| Service | `src/services/backgroundAgentService.ts` | `createBackgroundTask(config)` — background task queue and execution (not used by plan delegation flow) |
| Store/State | `src/stores/backgroundAgentStore.ts` | Zustand store for background task queue, status, logs (related infrastructure) |
| Store/State | `src/stores/terminalStore.ts` | Zustand store synced from App.tsx; provides `terminals` and `activeId` for agent picker filtering |
| Component | `src/components/TeamDelegationPopover.tsx` | Multi-agent delegation popover (related — uses `executeRemoteTask` HTTP path) |
| Model/Type | `src/types.ts` | `BackgroundTaskConfig`, `RemoteApiConfig`, `BackgroundTask`, `BackgroundTaskResult` |
| Service (Rust) | `src-tauri/src/remote_api.rs` | `delegate_plan_to_agent` Tauri command — resolves agent, emits `remote-execute` event |
| Config (Rust) | `src-tauri/src/lib.rs` | Registers `remote_api::delegate_plan_to_agent` in Tauri command list |

### Data Flow
```
[PlanWidget] → handleDelegateToAgent(agentId)
  → Tauri invoke('delegate_plan_to_agent') → [Rust] emit("remote-execute")
  → [App.tsx listener] creates session for target agent + autoSend plan
  → onApprovalResponse(requestId, false, "Plan delegated to X. Do not execute.")
  → [App.tsx respondToPlanApproval] sends reject via stdin → lead agent exits plan mode
```

### Key Functions
- `handleDelegateToAgent(agentId: string) → void` — PlanWidget callback; invokes Tauri command, then rejects plan locally so lead agent exits plan mode without executing
- `delegate_plan_to_agent(app, agent_id, prompt, lead_session_id, project_path) → Result<String>` — Rust command; reads agent storage, builds `remote-execute` event payload, emits to frontend
- `createBackgroundTask(config: BackgroundTaskConfig) → string` — queues task and triggers immediate processing (background agent infrastructure, not used by plan delegation)
- `executeRemoteTask(params) → Promise<{ success: boolean; sessionId?: string; error?: string }>` — HTTP POST to Remote API `/api/execute` (used by TeamDelegationPopover, not PlanWidget)
- `notifyLeadAgent(leadSessionId, session) → Promise<void>` — notifies lead agent when team member completes task

### State
- `isResponded`: `boolean` — prevents double-click on approval buttons (component)
- `approvalResult`: `'approved' | 'rejected' | 'delegated' | null` — controls post-response UI state (component)
- `delegatedTo`: `string | null` — agent label shown in "Delegated to {name}" confirmation (component)
- `showAgentPicker`: `boolean` — toggles inline agent picker list (component)
- `showFeedbackInput`: `boolean` — toggles reject-with-feedback input row (component)
- `feedback`: `string` — rejection feedback text (component)
- `terminals` (from `terminalStore`): list of all agent terminals, filtered by same `cwd` for picker (global)
- `backgroundAgentStore.tasks`: `BackgroundTask[]` — all background tasks with status/logs (global, related)

### External Dependencies
- Tauri command: `delegate_plan_to_agent` — Rust backend resolves agent + emits `remote-execute` event
- Tauri event: `remote-execute` — consumed by App.tsx to create a new agent session
- `AGENT_STATUS` RwLock: Rust global; sets agent to "busy" on delegation
- `agents-storage` file: JSON file read by Rust to resolve agent metadata (id, label, cwd)

### Config
- `RemoteApiConfig.enabled`: whether Remote API is active (default: `false`)
- `RemoteApiConfig.port`: HTTP port for Remote API (default: `3131`)
- `RemoteApiConfig.token`: Bearer auth token for API calls
