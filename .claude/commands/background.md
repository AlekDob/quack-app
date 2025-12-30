---
name: background
description: Run a command or agent in the background (non-blocking)
parameters: [command]
---

# Background Task

This command creates a Kanban shell task that runs in the background.

## Usage

```
/background <shell-command>
```

## Examples

### Shell Commands
- `/background npm run build` - Run build in background
- `/background npm test` - Run tests in background
- `/background npm run lint` - Run linting in background
- `/background npm run dev` - Start dev server in background

## How It Works

When you run `/background <command>`:
1. A new **Shell Task** is created in the Kanban board
2. The task is automatically moved to **In Progress** and started
3. Output is streamed in real-time to the task drawer
4. When complete, the task moves to **Done** automatically

## Task Types

The system automatically detects task type for visual display:
- **build** - Commands with `build`, `compile`, `dev`
- **test** - Commands with `test`, `vitest`, `jest`
- **analysis** - Commands with `lint`, `analyze`, `audit`
- **custom** - All other commands

## Monitoring

View and manage background tasks in the **Kanban Board**:
- Click on a shell task to see real-time output
- Kill running tasks with the stop button
- View exit codes and duration when completed

## Instructions for Claude

When the user invokes `/background <command>`:

1. Create a shell task in Kanban using this approach:
   - The task should have `type: 'shell'`
   - Set the command in the `command` field
   - Set projectPath to the current working directory
   - Set status to 'in_progress' to auto-start

2. Inform the user that the task has been created in Kanban

Example response:
"I've created a shell task in the Kanban board for `npm run build`. You can monitor its progress by clicking on the task card. The output will stream in real-time."
