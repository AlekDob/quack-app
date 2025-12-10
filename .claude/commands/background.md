---
name: background
description: Run a command or agent in the background (non-blocking)
parameters: [command]
---

# Background Task

This command creates a background task that runs independently from the main chat.

## Usage

```
/background <shell-command>
/background @<agent-name> <prompt>
```

## Examples

### Shell Commands
- `/background npm run build` - Run build in background
- `/background npm test` - Run tests in background
- `/background npm run lint` - Run linting in background

### Agent Tasks
- `/background @code-reviewer Review the latest changes`
- `/background @test-engineer Write tests for auth module`

## Task Types

The system automatically detects task type:
- **build** - Commands with `build`, `compile`, `dev` (dev servers)
- **test** - Commands with `test`, `vitest`, `jest`
- **analysis** - Commands with `lint`, `analyze`, `audit`
- **agent** - Tasks starting with `@agentname`
- **custom** - All other commands (including `watch`)

## Monitoring

View background tasks in the Background Tasks panel (sidebar).
