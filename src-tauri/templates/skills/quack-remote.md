---
name: quack-remote
version: 1.0.0
description: Control Quack agents remotely via the Quack Remote API. This skill should be used when you need to interact with Quack from any project — list agents, execute prompts, manage sessions, read chat messages, fire automation jobs, or check Quack status. Works from any Claude Code session on the same machine.
builtin: true
---

# Quack Remote API Skill

Control your Quack workspace remotely from any project. This skill lets any Claude agent interact with Quack's agents, sessions, and automations via the local REST API.

## CRITICAL: Terminals vs Agent Sessions

**Choose the right endpoint for the task:**

| Need | Endpoint | What happens in Quack |
|------|----------|-----------------------|
| **Run a shell command** (npm, cargo, git, docker, etc.) | `POST /api/terminals` + `POST /api/terminals/:id/write` | Opens a **CLI terminal** in Quack's Terminal Window (xterm.js + PTY). No AI agent involved. |
| **Ask an AI agent to do work** (analyze code, write tests, etc.) | `POST /api/execute` | Creates an **AI agent session** in Quack's sidebar. Claude/Codex processes the prompt. |

**Rule of thumb:** If you would run it in a shell (`bash`, `zsh`, `cmd`), use `/api/terminals`. If you need an AI agent to think about it, use `/api/execute`.

**NEVER use `/api/execute` to run shell commands.** That creates an AI session where the agent will try to interpret your shell command as a task. Use `/api/terminals` instead — it opens a real terminal visible in Quack's Terminal Window, executes instantly, and you can read the output.

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

## Terminal Management (Shell Commands)

**Use these endpoints whenever you need to run a CLI command** (npm, cargo, git, docker, python, etc.). This creates a real PTY terminal in Quack's Terminal Window — NOT an AI agent session. The user sees the terminal open and can watch the output live. The command executes instantly and you can poll the output later.

### POST /api/terminals
Create a new terminal session. Opens in Quack's Terminal Window and auto-focuses.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cwd": "/path/to/project",
    "label": "Dev Server",
    "color": "#4ecdc4",
    "workingOn": "Running dev server"
  }' \
  http://127.0.0.1:$PORT/api/terminals
```

Response: `TerminalInfo` object with `id`, `label`, `cwd`, `alive`, etc.

### GET /api/terminals
List all terminal sessions.

### GET /api/terminals/:id
Get info for a specific terminal.

### POST /api/terminals/:id/write
Send data (commands) to a terminal. Always include `\n` to execute.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": "npm run dev\n"}' \
  http://127.0.0.1:$PORT/api/terminals/$TERMINAL_ID/write
```

### GET /api/terminals/:id/output
Read the last N lines of terminal output. Use `strip_ansi=true` for clean text.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:$PORT/api/terminals/$TERMINAL_ID/output?lines=50&strip_ansi=true"
```

Response:
```json
{
  "terminalId": "uuid",
  "lines": ["$ npm run dev", "> ready on http://localhost:3000"],
  "totalLines": 42,
  "alive": true
}
```

### DELETE /api/terminals/:id
Close and remove a terminal session.

### Terminal workflow (non-blocking command execution)

```bash
# 1. Create terminal
TERM_RESULT=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"cwd\": \"$PROJECT_PATH\", \"label\": \"Build\"}" \
  http://127.0.0.1:$PORT/api/terminals)
TERMINAL_ID=$(echo $TERM_RESULT | jq -r '.id')

# 2. Execute command (non-blocking — returns immediately)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": "npm run build\n"}' \
  http://127.0.0.1:$PORT/api/terminals/$TERMINAL_ID/write

# 3. Continue other work... then check output later
sleep 5
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:$PORT/api/terminals/$TERMINAL_ID/output?lines=20&strip_ansi=true" | jq
```

## Common Workflows

### Run a shell command in a Quack terminal (most common)

Use this when you need to run npm, cargo, docker, git, or any CLI tool.
This opens a real terminal in Quack — NOT an AI agent session.

```bash
# 1. Read config
CONFIG=$(cat ~/Library/Application\ Support/com.quack.terminal/quack-remote.json)
PORT=$(echo $CONFIG | jq -r '.port')
TOKEN=$(echo $CONFIG | jq -r '.token')

# 2. Create a terminal (opens in Quack's Terminal Window)
TERM=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"cwd\": \"$(pwd)\", \"label\": \"Build\"}" \
  http://127.0.0.1:$PORT/api/terminals)
TID=$(echo $TERM | jq -r '.id')

# 3. Run a command (non-blocking — returns immediately)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": "npm run build\n"}' \
  http://127.0.0.1:$PORT/api/terminals/$TID/write

# 4. Check output later
sleep 10
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:$PORT/api/terminals/$TID/output?lines=30&strip_ansi=true" | jq '.lines[]'

# 5. Optionally close when done
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:$PORT/api/terminals/$TID
```

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
- `TerminalCreated`, `TerminalOutput`, `TerminalClosed`

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
