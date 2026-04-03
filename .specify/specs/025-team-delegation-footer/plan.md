# Implementation Plan: Team Delegation from Chat Footer

## Architecture Overview

### Two Delegation Patterns, One API

```
PATTERN 1: Direct Delegation (quack-remote skill)
  Agent Jack → POST /api/execute { agentId, prompt }
  → Session created: [Remote] {prompt}
  → No leadSessionId → no auto-done, no callback
  → User switches to work with target agent directly

PATTERN 2: Managed Delegation (team footer icon)
  User clicks Team icon → TeamDelegationPopover
  → Selects agents + writes task → "Delega"
  → POST /api/execute { agentId, prompt, leadSessionId, projectPath }
  → Session created: [Team] {prompt}
  → Has leadSessionId → on finish: auto-done + notify lead
  → Lead agent receives completion message inline
```

### Single Decision Rule

```
session.leadSessionId exists?
  YES → auto-done + POST /api/sessions/:leadSessionId/send
  NO  → stays in_progress, manual completion
```

No title prefix checks. No source field checks. One field, one rule.

## Component Design

### 1. TeamDelegationPopover (NEW)

**File**: `src/components/TeamDelegationPopover.tsx`
**Responsibility**: Lightweight popover for managed team delegation
**Trigger**: Team icon button in `chat-view-footer-controls`

**UI**:
- Agent list with checkboxes (ALL agents, including those without projects)
- Exclude current active agent from list
- Task prompt textarea
- "Delega" button
- Uses existing popover/dropdown pattern (like ChatSettingsMenu)

**Data flow**:
1. Read agents from Quack Remote API: `GET /api/agents`
2. Read remote config via Tauri command `get_remote_config`
3. On submit: for each selected agent:
   ```
   POST /api/execute {
     agentId: agent.id,
     prompt: taskText,
     leadSessionId: currentActiveSessionId,
     projectPath: agent.projectPath || currentProjectPath
   }
   ```
4. Close popover, show toast "Task delegati a N agenti"

### 2. Session Type Extension

**File**: `src/types.ts`
**Change**: Add `leadSessionId?: string` to `AgentSession` interface

### 3. leadSessionId-Driven Completion (App.tsx)

**File**: `src/App.tsx` (sendMessageForAgent completion block, ~line 2940)
**Logic**:
```typescript
// After streaming completes:
const completionUpdate = {
  claudeSessionId: response.session_id,
  messageCount: finalMessages.length,
  updatedAt: Date.now(),
};

// leadSessionId-driven auto-done (not title-based)
if (capturedSession?.leadSessionId) {
  completionUpdate.status = 'done';
  completionUpdate.completedAt = Date.now();
}
await updateSession(messageKey, completionUpdate);

// Notify lead agent
if (capturedSession?.leadSessionId) {
  notifyLeadAgent(capturedSession.leadSessionId, capturedSession, messageKey);
}
```

### 4. Lead Notification Function (NEW)

**File**: `src/App.tsx` or `src/services/remoteApi.ts`
**Responsibility**: Send completion message to lead agent's session

```typescript
async function notifyLeadAgent(
  leadSessionId: string,
  session: AgentSession,
  completedSessionId: string
) {
  const config = await invoke('get_remote_config');
  const message = `🦆 [Team Complete] Agent ${session.agentName} ha completato il task assegnato.\n\nTask: ${session.title?.replace(/^\[Team\]\s*/, '')}\nStatus: Completato`;
  
  await fetch(`http://127.0.0.1:${config.port}/api/sessions/${leadSessionId}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
}
```

### 5. Remote Execute Enhancement (Rust)

**File**: `src-tauri/src/remote_api.rs`
**Changes**:
- Add `leadSessionId` optional field to `ExecuteRequest`
- Pass it through in the `remote-execute` Tauri event payload
- When `leadSessionId` is present, use `[Team]` title prefix instead of `[Remote]`

**File**: `src/App.tsx` (remote-execute listener, ~line 5499)
**Changes**:
- Read `leadSessionId` from event payload
- Store it on created session
- Use `[Team]` prefix when `leadSessionId` present

## Technology

- **Frontend**: React 18, Zustand, existing CSS patterns
- **API**: Quack Remote HTTP API (already exists)
- **Rust**: Minor change to ExecuteRequest struct (1 new optional field)

## Data Model Change

```typescript
// In AgentSession (src/types.ts)
export interface AgentSession {
  // ... existing fields
  leadSessionId?: string;  // Session ID of lead agent to notify on completion
}
```

## Error Handling

- Remote config not available → toast "Remote API non abilitata"
- API call fails for one agent → continue with others, show error per agent
- Lead session no longer exists → skip notification (log warning, don't crash)
- Agent without project + no projectPath override → toast warning per agent
