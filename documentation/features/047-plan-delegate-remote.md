---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-06
last_verified: 2026-04-06
tags: [plan-delegate-remote, plan-mode, delegation, background-agent, remote-api]
---

## Plan Delegate Remote
**Purpose:** Approve an agent's plan and delegate its execution to a background agent via Quack Remote, freeing the foreground session.
**Stack:** React 18, TypeScript strict, Tauri v2

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/PlanWidget.tsx` | Plan display with Approve/Reject/Delegate buttons; fires `__DELEGATE_REMOTE__` sentinel |
| Component | `src/components/PlanWidget.css` | Styles for plan widget, approval row, delegate button (cyan accent) |
| Route/Page | `src/App.tsx` (lines ~4540-4615) | `handlePlanApprovalResponse` — routes `__DELEGATE_REMOTE__` to background task creation |
| Service | `src/services/backgroundAgentService.ts` | `createBackgroundTask(config)` — queues and executes agent tasks in background |
| Service | `src/services/remoteApi.ts` | `executeRemoteTask(params)`, `fetchRemoteAgents()`, `notifyLeadAgent()` — Remote API client |
| Component | `src/components/TeamDelegationPopover.tsx` | Multi-agent delegation popover (related — uses same `executeRemoteTask` service) |
| Store/State | `src/stores/backgroundAgentStore.ts` | Zustand store for background task queue, status, logs |
| Model/Type | `src/types.ts` | `BackgroundTaskConfig`, `RemoteApiConfig`, `BackgroundTask`, `BackgroundTaskResult` |

### Data Flow
```
[PlanWidget] → onApprovalResponse('__DELEGATE_REMOTE__') → [App.handlePlanApprovalResponse]
  → abortStreamForTargetAgent(sessionKey) → [backgroundAgentService.createBackgroundTask]
  → [backgroundAgentStore queue] → [executeAgentTask] → Tauri invoke('execute_background_agent')
  → native notification on completion
```

### Key Functions
- `handleDelegateRemote() → void` — PlanWidget button handler; sets feedback to `__DELEGATE_REMOTE__` sentinel
- `handlePlanApprovalResponse(requestId: string, approved: boolean, feedback?: string) → void` — App.tsx; detects delegate sentinel, aborts local stream, spawns background task
- `createBackgroundTask(config: BackgroundTaskConfig) → string` — queues task and triggers immediate processing
- `executeAgentTask(task: BackgroundTask) → Promise<void>` — invokes Tauri backend to run Claude agent
- `executeRemoteTask(params) → Promise<{ success: boolean; sessionId?: string; error?: string }>` — HTTP POST to Remote API `/api/execute`
- `abortStreamForTargetAgent(key: string) → void` — kills the foreground agent session before delegation

### State
- `pendingPlanApprovals`: `Map<string, { agentId: string; sessionKey?: string; plan: unknown }>` — tracks plans awaiting user decision (component)
- `isDelegating`: `boolean` — local flag in PlanWidget to show "delegated" confirmation (component)
- `isResponded`: `boolean` — prevents double-click on approval buttons (component)
- `approvalResult`: `'approved' | 'rejected' | null` — controls post-response UI state (component)
- `backgroundAgentStore.tasks`: `Map<string, BackgroundTask>` — all background tasks with status/logs (global)

### External Dependencies
- Quack Remote API: `http://127.0.0.1:{port}/api/execute` — background agent execution endpoint
- Tauri command: `execute_background_agent` — Rust backend for spawning Claude SDK process
- Tauri command: `get_remote_config` — reads Remote API config (enabled, port, token)
- `@tauri-apps/plugin-notification`: native OS notification on task completion

### Config
- `RemoteApiConfig.enabled`: whether Remote API is active (default: `false`)
- `RemoteApiConfig.port`: HTTP port for Remote API (default: `3131`)
- `RemoteApiConfig.token`: Bearer auth token for API calls
- `BackgroundTaskConfig.timeout_ms`: max execution time (default: `600000` / 10min)
- `BackgroundTaskConfig.model`: LLM model for delegated execution (hardcoded: `opus46`)
