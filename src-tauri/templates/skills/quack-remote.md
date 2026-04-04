---
name: quack-remote
version: 1.0.0
description: Control Quack agents remotely via the Quack Remote API. This skill should be used when you need to interact with Quack from any project — list agents, execute prompts, manage sessions, read chat messages, fire automation jobs, or check Quack status. Works from any Claude Code session on the same machine.
builtin: true
---

# Quack Remote API Skill

Control your Quack workspace remotely from any project. This skill lets any Claude agent interact with Quack's agents, sessions, and automations via the local REST API.

## Prerequisites

Quack must be running with Remote API enabled (Settings > Remote API > Enable).

## Configuration

The skill reads config automatically from:
- **macOS**: `~/Library/Application Support/com.quack.terminal/quack-remote.json`
- **Windows**: `%APPDATA%/com.quack.terminal/quack-remote.json`

Config format:
```json
{
  "enabled": true,
  "port": 6769,
  "token": "<hex-token>"
}
```

## How to Connect

Before making any API call, read the config file to get port and token:

```bash
# macOS
cat ~/Library/Application\ Support/com.quack.terminal/quack-remote.json
```

All API calls use:
- **Base URL**: `http://127.0.0.1:{port}/api`
- **Auth header**: `Authorization: Bearer {token}`
- **Content-Type**: `application/json`

## API Reference

### GET /api/status
Check if Quack is running and get basic info.

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$PORT/api/status
```

Response:
```json
{
  "version": "0.7.0",
  "uptimeSecs": 3600,
  "agentCount": 5,
  "activeSessionCount": 2,
  "remoteEnabled": true
}
```

### GET /api/agents
List all configured agents with their status, project, and role.

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$PORT/api/agents
```

Response:
```json
[
  {
    "id": "uuid-here",
    "name": "Agent Leo",
    "status": "busy",
    "avatar": "duck-avatar.jpeg",
    "role": "Quack Developer",
    "projectName": "quack-app",
    "projectPath": "/path/to/quack-app",
    "workingOn": "Implementing feature X",
    "branch": "main"
  }
]
```

### GET /api/agents/:id
Get detailed info for a specific agent.

### GET /api/sessions
List all sessions (sorted by creation time).

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$PORT/api/sessions
```

Response:
```json
[
  {
    "id": "session-uuid",
    "title": "Fix login bug",
    "agentId": "agent-uuid",
    "status": "in_progress",
    "createdAt": 1708900000000,
    "messageCount": 15,
    "claudeSessionId": "claude-sdk-session-id"
  }
]
```

### GET /api/sessions/:id
Get detailed info for a specific session.

### GET /api/sessions/:id/messages
Get the conversation messages for a session.

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$PORT/api/sessions/$SESSION_ID/messages
```

Response:
```json
[
  { "role": "user", "content": "Fix the login bug" },
  { "role": "assistant", "content": "I'll investigate the login flow..." }
]
```

### POST /api/sessions/:id/send
Send a message to an active session (continues the conversation).

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Now add tests for this fix"}' \
  http://127.0.0.1:$PORT/api/sessions/$SESSION_ID/send
```

Response: `{ "success": true }`

### POST /api/execute
Start a new session on a specific agent with a prompt. This is the main entry point for remote task execution.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-uuid",
    "prompt": "Analyze the test coverage and suggest improvements",
    "projectPath": "/optional/override/path",
    "leadSessionId": "session-id-of-lead-agent"
  }' \
  http://127.0.0.1:$PORT/api/execute
```

Response:
```json
{
  "success": true,
  "sessionId": "session-uuid-created"
}
```

**Fields**:
- `agentId` (required): Target agent ID from GET /api/agents
- `prompt` (required): Task to execute
- `projectPath` (optional): Override project path. If omitted, uses agent's configured path
- `leadSessionId` (optional): Session ID of the lead agent. When set, the created session auto-completes when finished and sends a notification to the lead via POST /api/sessions/:leadSessionId/send. Use this for managed team delegation.

### GET /api/jobs
List all automation jobs.

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$PORT/api/jobs
```

### POST /api/jobs
Create a new automation job.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily code review",
    "cronExpression": "0 9 * * 1-5",
    "agentId": "agent-uuid",
    "agentName": "Agent Leo",
    "projectPath": "/path/to/project",
    "projectName": "my-project",
    "promptTemplate": "Review recent commits and suggest improvements",
    "model": "claude-sonnet-4-20250514",
    "enabled": true,
    "timeoutMinutes": 15,
    "skipIfRunning": true
  }' \
  http://127.0.0.1:$PORT/api/jobs
```

Required fields: `name`, `cronExpression`, `agentId`, `agentName`, `projectPath`, `projectName`, `promptTemplate`.
Optional: `model`, `enabled` (default: true), `timeoutMinutes` (default: 10), `skipIfRunning` (default: true).

### PUT /api/jobs/:id
Update an existing automation job. Only include the fields you want to change.

### DELETE /api/jobs/:id
Delete an automation job permanently.

### POST /api/jobs/:id/fire
Manually fire an automation job immediately.

### POST /api/jobs/:id/toggle
Enable/disable an automation job.

### DELETE /api/sessions/:id
Delete a session permanently.

### POST /api/teams
Create a team and launch sessions for all members.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Feature Sprint",
    "leadAgentId": "lead-agent-uuid",
    "members": [
      { "agentId": "agent-uuid-1", "role": "backend", "task": "Implement REST endpoints" },
      { "agentId": "agent-uuid-2", "role": "frontend", "task": "Build React components" }
    ]
  }' \
  http://127.0.0.1:$PORT/api/teams
```

Members are launched with a 500ms stagger to avoid race conditions.

### GET /api/teams
List all teams.

### GET /api/teams/:id
Get team status with auto-synced member statuses. Use for polling team progress (every 10-15s).

### DELETE /api/teams/:id
Disband a team (soft delete — sessions remain active).

## Common Workflows

### Execute a task on a Quack agent and monitor it

```bash
# 1. Read config
CONFIG=$(cat ~/Library/Application\ Support/com.quack.terminal/quack-remote.json)
PORT=$(echo $CONFIG | jq -r '.port')
TOKEN=$(echo $CONFIG | jq -r '.token')

# 2. Find the right agent
AGENTS=$(curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$PORT/api/agents)
AGENT_ID=$(echo $AGENTS | jq -r '.[0].id')

# 3. Execute
RESULT=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"agentId\": \"$AGENT_ID\", \"prompt\": \"Your task here\"}" \
  http://127.0.0.1:$PORT/api/execute)
SESSION_ID=$(echo $RESULT | jq -r '.sessionId')

# 4. Poll for messages
sleep 10
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:$PORT/api/sessions/$SESSION_ID/messages | jq
```

### Check which agents are busy

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:$PORT/api/agents \
  | jq '.[] | select(.status == "busy") | {name, workingOn}'
```

## WebSocket (Real-time Updates)

Connect to `ws://127.0.0.1:{port}/ws?token={token}` for live events:
- `AgentStatus`, `SessionCreated`, `SessionCompleted`, `JobFired`

## Error Handling

All errors return standard HTTP codes with JSON:
- `401` — Invalid/missing token
- `404` — Agent/session/job not found
- `503` — Auth not initialized (Quack starting up)

## Tips

- **Agent IDs are UUIDs** — use `/api/agents` to discover them by name
- **Sessions have a `status` field** — filter for `in_progress` to find active ones
- **Execute creates a session on Quack's UI** — the user will see it in their workspace
- **The API is local-only** — `127.0.0.1`, not exposed to the internet (unless configured for LAN)
