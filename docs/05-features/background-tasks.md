# Background Tasks System

**Date**: 2025-12-10
**Version**: 1.0.0
**Status**: Implemented & Active

---

## Overview

The Background Tasks system in Quack enables **non-blocking execution** of long-running operations such as builds, tests, agent tasks, and file watchers. Tasks are queued, prioritized, and executed with real-time progress tracking, log streaming, and desktop notifications.

### Key Capabilities

- **Non-blocking execution** - Run commands and agents without blocking the main UI
- **Priority queue management** - High/medium/low priority with intelligent scheduling
- **Real-time logging** - Stream stdout/stderr with ANSI color support
- **Progress tracking** - Track task progress with percentages and stages
- **Desktop notifications** - Get notified when tasks complete
- **Concurrency control** - Limit concurrent tasks (default: 5)
- **Retry logic** - Automatically retry failed tasks
- **Task dependencies** - Chain tasks with dependency tracking
- **File watching** - Monitor file changes and trigger tasks

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐    ┌──────────────────────┐     │
│  │ useBackgroundAgents│  │BackgroundTasksDrawer │     │
│  │      (Hook)        │  │      (UI Panel)      │     │
│  └──────────────────┘    └──────────────────────┘     │
│           │                        │                    │
│           └────────┬───────────────┘                    │
│                    │                                     │
│  ┌─────────────────▼──────────────────────────────┐   │
│  │      Background Agent Store (Zustand)          │   │
│  │  - Task queue                                   │   │
│  │  - Priority management                          │   │
│  │  - State persistence                            │   │
│  └─────────────────┬──────────────────────────────┘   │
│                    │                                     │
│  ┌─────────────────▼──────────────────────────────┐   │
│  │    Background Agent Service                     │   │
│  │  - Queue processor (1s interval)                │   │
│  │  - Event listeners                              │   │
│  │  - Task execution coordination                  │   │
│  └─────────────────┬──────────────────────────────┘   │
└────────────────────┼───────────────────────────────────┘
                     │ Tauri IPC
┌────────────────────▼───────────────────────────────────┐
│               Backend (Rust/Tauri)                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐ │
│  │    BackgroundTaskManager (Rust)                  │ │
│  │  - Process spawning (tokio::process::Command)    │ │
│  │  - Output streaming (stdout/stderr)              │ │
│  │  - Lifecycle management (pause/resume/cancel)    │ │
│  │  - Event emission                                │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Task Creation** → User triggers task via `/background` command or API
2. **Queue Addition** → Task added to store with `queued` status
3. **Queue Processing** → Service checks every 1s for available slots
4. **Execution Start** → Backend spawns process, streams output
5. **Real-time Updates** → Events emitted for logs, progress, completion
6. **Notification** → Desktop notification on completion/failure

---

## Task Types

### Agent Tasks (`type: 'agent'`)

Run AI agents (droids) in the background using Claude SDK.

**Configuration**:
```typescript
{
  type: 'agent',
  agentId: 'droid-123',
  prompt: 'Review the latest changes',
  model: 'sonnet', // 'opus' | 'sonnet' | 'haiku'
  workingDirectory: '/path/to/project',
  priority: 'high',
}
```

**Backend Implementation**: Uses `claude` CLI with `--no-interactive` and `--output-format json`

**Timeout**: Default 5 minutes (configurable)

### Build Tasks (`type: 'build'`)

Run build processes like `npm run build`, `cargo build`, etc.

**Auto-detection**: Commands containing `build`, `compile`, or `dev` (dev servers)

**Timeout**: Default 10 minutes

### Test Tasks (`type: 'test'`)

Execute test suites in the background.

**Auto-detection**: Commands containing `test`, `vitest`, `jest`, `cargo test`

**Timeout**: Default 10 minutes

### Analysis Tasks (`type: 'analysis'`)

Run code analysis, linting, security audits.

**Auto-detection**: Commands containing `lint`, `analyze`, `audit`, `eslint`

**Timeout**: Default 10 minutes

### Watch Tasks (`type: 'watch'`)

Monitor file changes and trigger actions.

**Configuration**:
```typescript
{
  type: 'watch',
  watchPatterns: ['src/**/*.ts', 'tests/**/*.test.ts'],
  debounceMs: 500,
  workingDirectory: '/path/to/project',
}
```

**Note**: File watcher implementation uses `notify` crate (future enhancement)

### Custom Tasks (`type: 'custom'`)

Any other shell command not matching specific types.

**Examples**: `git pull`, `npm install`, custom scripts

---

## Using the `/background` Command

### Syntax

```bash
/background <shell-command>
/background @<agent-name> <prompt>
```

### Examples

#### Shell Commands
```bash
# Run build in background
/background npm run build

# Run tests in background
/background npm test

# Run linting in background
/background npm run lint

# Run custom script
/background ./scripts/deploy.sh
```

#### Agent Tasks
```bash
# Run code review agent
/background @code-reviewer Review the latest changes

# Run test engineer agent
/background @test-engineer Write tests for auth module

# Run documentation agent
/background @doc-writer Update API documentation
```

### Task Type Detection

The system automatically detects task type based on command keywords:

- **build** → Commands with `build`, `compile`, `dev`
- **test** → Commands with `test`, `vitest`, `jest`
- **analysis** → Commands with `lint`, `analyze`, `audit`
- **agent** → Commands starting with `@agentname`
- **custom** → All other commands (including `watch`)

---

## Developer API

### Using the Hook

```typescript
import { useBackgroundAgents } from '../hooks/useBackgroundAgents';

function MyComponent() {
  const {
    tasks,
    runCommand,
    runDroid,
    cancelTask,
    retryTask,
    // ... other actions
  } = useBackgroundAgents();

  // Run a command
  const handleBuild = () => {
    const taskId = runCommand('npm run build', {
      name: 'Build Project',
      priority: 'high',
      type: 'build',
    });
    console.log(`Task created: ${taskId}`);
  };

  // Run a droid
  const handleCodeReview = () => {
    const taskId = runDroid(
      'droid-id-123',
      'Code Reviewer',
      'Review recent changes in src/components',
      {
        model: 'sonnet',
        priority: 'medium',
      }
    );
  };

  return (
    <div>
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
```

### Direct Service API

```typescript
import {
  createBackgroundTask,
  cancelTask,
  retryTask,
  getQueueStats,
} from '../services/backgroundAgentService';

// Create a task
const taskId = createBackgroundTask({
  type: 'test',
  name: 'Run Unit Tests',
  priority: 'high',
  command: 'npm test',
  workingDirectory: '/path/to/project',
  notifyOnComplete: true,
  showLogsInRealtime: true,
});

// Cancel a task
await cancelTask(taskId);

// Retry a failed task
retryTask(taskId);

// Get queue statistics
const stats = getQueueStats();
console.log(stats);
// { totalTasks: 5, queued: 2, running: 1, completed: 2, ... }
```

### Listening to Task Events

```typescript
import { useBackgroundTaskCompletion } from '../hooks/useBackgroundAgents';

function ChatView() {
  useBackgroundTaskCompletion((taskId, result) => {
    console.log(`Task ${taskId} completed:`, result);
    if (result.success) {
      showSuccessMessage(`Task completed in ${result.duration_ms}ms`);
    } else {
      showErrorMessage(`Task failed: ${result.error}`);
    }
  });

  return <div>...</div>;
}
```

---

## Task Configuration

### BackgroundTaskConfig Interface

```typescript
interface BackgroundTaskConfig {
  // Required fields
  type: BackgroundTaskType;
  priority: BackgroundTaskPriority;
  name: string;

  // Optional fields
  description?: string;

  // Agent-specific
  agentId?: string;
  prompt?: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  workingDirectory?: string;

  // Command-specific
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // Watch-specific
  watchPatterns?: string[];
  debounceMs?: number;

  // Advanced options
  timeout_ms?: number;
  maxRetries?: number;
  dependsOn?: string[];
  notifyOnComplete?: boolean;
  showLogsInRealtime?: boolean;
}
```

### Priority Levels

- **high** (weight: 3) - Executes first, user-critical tasks
- **medium** (weight: 2) - Normal priority, most common
- **low** (weight: 1) - Background tasks, non-urgent

Tasks are sorted by:
1. Priority (high → medium → low)
2. Creation time (older first)

### Task Status Flow

```
queued → running → completed
              ↓
            paused → running
              ↓
           failed/cancelled → (retry) → queued
```

---

## Queue Management

### Concurrency Control

**Default**: 5 concurrent tasks
**Configurable**: Via `setMaxConcurrent(n)`

```typescript
const { setMaxConcurrent } = useBackgroundAgents();
setMaxConcurrent(3); // Limit to 3 concurrent tasks
```

### Queue Operations

```typescript
const {
  pauseQueue,    // Pause all task execution
  resumeQueue,   // Resume queue processing
  updateTaskPriority, // Change task priority
  clearCompletedTasks, // Remove completed tasks
} = useBackgroundAgents();

// Pause the queue
pauseQueue();

// Update task priority
updateTaskPriority('task-id', 'high');

// Clear completed tasks
clearCompletedTasks();
```

### Task Dependencies

Chain tasks by specifying dependencies:

```typescript
const buildTaskId = createBackgroundTask({
  type: 'build',
  name: 'Build Project',
  command: 'npm run build',
  priority: 'high',
});

const testTaskId = createBackgroundTask({
  type: 'test',
  name: 'Run Tests',
  command: 'npm test',
  priority: 'high',
  dependsOn: [buildTaskId], // Wait for build to complete
});
```

---

## UI Components

### BackgroundTasksDrawer

**Main UI Panel** - Accessible via sidebar button

**Features**:
- Real-time task list with status indicators
- Search and filter tasks (status, type, priority)
- Expandable task cards with logs
- Action buttons (pause, resume, cancel, retry, remove)
- Queue statistics dashboard

**Opening the Drawer**:
```typescript
import { useState } from 'react';
import BackgroundTasksDrawer from './BackgroundTasksDrawer';

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <button onClick={() => setDrawerOpen(true)}>
        Background Tasks
      </button>
      <BackgroundTasksDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
```

### BackgroundTaskCard

**Individual Task Display** - Shows task info, progress, logs

**Features**:
- Task name, description, status badge
- Progress bar with percentage
- Expandable logs with ANSI color support
- Action buttons (pause/resume, cancel, retry)
- Duration and timing info

### BackgroundTasksSidebarButton

**Sidebar Button** - Shows badge with active task count

**Features**:
- Badge shows `running + queued` count
- Orange dot for running tasks
- Red dot for failed tasks
- Click to open drawer

---

## Real-time Features

### Log Streaming

Logs are streamed in real-time from backend to frontend:

```typescript
// Backend (Rust) emits logs
emit_task_log(&app, &task_id, BackgroundTaskLog {
  level: "info",
  message: line.clone(),
  source: Some("stdout"),
});

// Frontend receives logs via event listener
listen('background-task-log', (event) => {
  const { taskId, log } = event.payload;
  store.addTaskLog(taskId, log);
});
```

**Log Levels**: `info`, `warn`, `error`, `debug`

**Max Logs Per Task**: 500 (prevents memory bloat)

### Progress Updates

Track task progress with percentages and stages:

```typescript
store.updateTaskProgress(taskId, {
  current: 45,
  total: 100,
  percentage: 45.0,
  stage: 'Building components',
});
```

### Desktop Notifications

Automatic notifications on task completion:

```typescript
// Success notification
await sendNotification({
  title: 'Task Completed',
  body: 'Build completed successfully',
});

// Failure notification
await sendNotification({
  title: 'Task Failed',
  body: 'Build failed: missing dependencies',
});

// Quack sound on success
playQuackSound(); // Plays /quack.mp3 at 30% volume
```

---

## State Management

### Zustand Store

**File**: `src/stores/backgroundAgentStore.ts`

**State Structure**:
```typescript
interface BackgroundAgentState {
  // Core state
  tasks: BackgroundTask[];
  maxConcurrent: number;
  isPaused: boolean;
  lastUpdated: number;

  // Watch triggers
  watchTriggers: WatchTrigger[];
  droidAutoTriggers: DroidAutoTrigger[];

  // UI state
  filters: BackgroundTaskFilters;
  expandedTaskIds: Set<string>;
  selectedTaskId: string | null;

  // Actions & selectors (60+ methods)
}
```

**State Persistence**:
- Tasks persisted to localStorage (via Zustand persist middleware)
- Logs NOT persisted for storage efficiency (only for running tasks)
- Filters, maxConcurrent, triggers persisted

**DevTools Integration**: Redux DevTools support for debugging

---

## Backend Implementation

### Rust Commands

**File**: `src-tauri/src/background_tasks.rs`

#### execute_background_agent
Executes Claude CLI agent in background:

```rust
#[tauri::command]
pub async fn execute_background_agent(
    app: AppHandle,
    task_id: String,
    prompt: String,
    model: Option<String>,
    working_directory: Option<String>,
    agent_id: Option<String>,
    timeout: Option<u64>,
) -> Result<BackgroundTaskResult, String>
```

**Implementation**:
- Spawns `claude` CLI with `--no-interactive` flag
- Streams stdout/stderr with tokio async readers
- Emits log events in real-time
- Handles timeouts (default: 5 min)
- Returns structured result with success/error

#### execute_background_command
Executes shell command in background:

```rust
#[tauri::command]
pub async fn execute_background_command(
    app: AppHandle,
    task_id: String,
    command: String,
    args: Option<Vec<String>>,
    working_directory: Option<String>,
    env: Option<HashMap<String, String>>,
    timeout: Option<u64>,
) -> Result<BackgroundTaskResult, String>
```

**Implementation**:
- Cross-platform command execution (`sh -c` on Unix, `cmd /C` on Windows)
- Environment variable support
- Output streaming
- Timeout handling (default: 10 min)

#### Lifecycle Commands
- `pause_background_task` - Pause a running task
- `resume_background_task` - Resume a paused task
- `cancel_background_task` - Cancel and terminate task

**Note**: Full process control (kill) requires storing `Child` handle - currently marks as cancelled.

---

## Testing

### Test Files

**Unit Tests**:
- `src/tests/backgroundAgents.test.ts` - Store, service, queue logic
- `src/tests/backgroundTasksUI.test.ts` - UI component tests

**Test Coverage**:
- Task creation and lifecycle
- Priority queue management
- Task filtering and search
- UI layout and accessibility
- Event handling

**Run Tests**:
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test -- backgroundAgents  # Run specific test
```

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { useBackgroundAgentStore } from '../stores/backgroundAgentStore';

describe('Background Agent Queue', () => {
  it('should prioritize high priority tasks', () => {
    const store = useBackgroundAgentStore.getState();

    const lowId = store.createTask({
      type: 'custom',
      name: 'Low Priority',
      priority: 'low',
      command: 'echo "low"',
    });

    const highId = store.createTask({
      type: 'custom',
      name: 'High Priority',
      priority: 'high',
      command: 'echo "high"',
    });

    const nextTask = store.getNextTaskToRun();
    expect(nextTask?.id).toBe(highId);
  });
});
```

---

## Best Practices

### When to Use Background Tasks

✅ **Use for**:
- Long-running builds (>5s)
- Test suites (>10s)
- AI agent tasks (Claude SDK agents)
- Code analysis/linting
- Git operations (large repos)
- File monitoring/watching

❌ **Don't use for**:
- Quick commands (<2s)
- Interactive prompts
- Commands requiring user input
- Real-time debugging sessions

### Priority Guidelines

- **High**: User-initiated critical tasks (builds for deployment, urgent fixes)
- **Medium**: Normal development tasks (tests, linting)
- **Low**: Background maintenance (cleanup, caching)

### Performance Tips

1. **Limit concurrency** - Don't exceed 5-7 concurrent tasks
2. **Set timeouts** - Prevent runaway processes
3. **Clear completed tasks** - Regularly clean up finished tasks
4. **Use dependencies** - Chain related tasks properly
5. **Monitor logs** - Limit log retention (500 lines per task)

### Error Handling

```typescript
const { runCommand, retryTask } = useBackgroundAgents();

const taskId = runCommand('npm run build', {
  name: 'Build',
  priority: 'high',
  maxRetries: 3, // Retry up to 3 times on failure
});

// Listen for completion
useBackgroundTaskCompletion((id, result) => {
  if (id === taskId && !result.success) {
    console.error('Build failed:', result.error);

    // Optionally retry
    if (shouldRetry) {
      retryTask(taskId);
    }
  }
});
```

---

## Troubleshooting

### Task Stuck in "Queued"

**Cause**: Max concurrent tasks reached or queue paused

**Solution**:
```typescript
const { isPaused, resumeQueue, setMaxConcurrent } = useBackgroundAgents();

if (isPaused) {
  resumeQueue();
}

// Increase concurrency limit
setMaxConcurrent(10);
```

### Task Fails Immediately

**Cause**: Command not found, missing dependencies, or invalid config

**Solution**:
1. Check task logs for error messages
2. Verify command exists: `which <command>`
3. Check working directory is correct
4. Verify environment variables

### Logs Not Showing

**Cause**: `showLogsInRealtime: false` or logs exceeded max limit

**Solution**:
```typescript
createBackgroundTask({
  // ... other config
  showLogsInRealtime: true, // Enable real-time logs
});

// Or toggle logs manually
toggleTaskLogs(taskId);
```

### Notifications Not Appearing

**Cause**: Notification permissions not granted

**Solution**:
1. Check system notification permissions
2. Verify `notifyOnComplete: true` in task config
3. Check Tauri notification plugin is enabled

### High Memory Usage

**Cause**: Too many tasks with large log outputs

**Solution**:
1. Clear completed tasks regularly: `clearCompletedTasks()`
2. Limit log retention (already capped at 500 per task)
3. Reduce concurrent tasks

---

## Future Enhancements

### Planned Features

1. **File Watcher Implementation** - Full `notify` crate integration for watch tasks
2. **Process Control** - Full pause/resume with SIGSTOP/SIGCONT signals
3. **Task Groups** - Group related tasks together
4. **Task Scheduling** - Cron-like scheduled tasks
5. **Result Caching** - Cache and reuse results of identical tasks
6. **Task Templates** - Predefined task configurations
7. **Performance Metrics** - CPU/memory usage tracking
8. **Task History** - Persistent history beyond current session
9. **Export/Import** - Save/load task configurations
10. **Webhook Integration** - Trigger external webhooks on completion

### Known Limitations

1. **Process Control** - Cannot fully pause/resume processes (only mark as paused)
2. **File Watching** - Watch task implementation incomplete (requires `notify` crate)
3. **Cross-platform** - Some commands may behave differently on Windows vs Unix
4. **Token Usage** - Claude CLI JSON parsing not yet implemented for usage stats

---

## Related Documentation

- **Architecture**: `docs/01-architecture.md` - Full system architecture
- **Bug Fixes**: `docs/02-bug-fixes/background-tasks-drawer-ui-fixes.md` - UI improvements
- **Testing**: `docs/03-testing/TEST_RESULTS.md` - Test results
- **Claude SDK**: `docs/05-features/CLAUDE_SDK_054.md` - Agent SDK integration
- **Commands**: `.claude/commands/background.md` - `/background` command reference

---

## API Reference

### Store Actions

```typescript
// Task lifecycle
createTask(config: BackgroundTaskConfig): string
startTask(taskId: string): void
pauseTask(taskId: string): void
resumeTask(taskId: string): void
cancelTask(taskId: string): void
completeTask(taskId: string, result: BackgroundTaskResult): void
failTask(taskId: string, error: string): void
retryTask(taskId: string): void
removeTask(taskId: string): void
clearCompletedTasks(): void

// Task updates
updateTaskProgress(taskId: string, progress: BackgroundTaskProgress): void
addTaskLog(taskId: string, log: BackgroundTaskLogEntry): void
toggleTaskLogs(taskId: string): void

// Queue management
setMaxConcurrent(max: number): void
pauseQueue(): void
resumeQueue(): void
updateTaskPriority(taskId: string, priority: BackgroundTaskPriority): void

// UI actions
setFilters(filters: Partial<BackgroundTaskFilters>): void
toggleTaskExpanded(taskId: string): void
setSelectedTask(taskId: string | null): void
expandAllTasks(): void
collapseAllTasks(): void

// Selectors
getTask(taskId: string): BackgroundTask | undefined
getQueueStats(): BackgroundTaskQueueStats
getFilteredTasks(): BackgroundTask[]
getQueuedTasks(): BackgroundTask[]
getRunningTasks(): BackgroundTask[]
getNextTaskToRun(): BackgroundTask | undefined
canStartNewTask(): boolean
getTasksByStatus(status: BackgroundTaskStatus): BackgroundTask[]
getTasksByType(type: BackgroundTaskType): BackgroundTask[]
getTasksForChat(chatId: string): BackgroundTask[]
```

### Service Functions

```typescript
// Initialization
initBackgroundAgentService(): Promise<void>
cleanupBackgroundAgentService(): void

// Task creation
createBackgroundTask(config: BackgroundTaskConfig): string
runDroidInBackground(droidId: string, droidName: string, prompt: string, options?: {...}): string
runCommandInBackground(command: string, options?: {...}): string

// Task control
pauseTask(taskId: string): Promise<void>
resumeTask(taskId: string): Promise<void>
cancelTask(taskId: string): Promise<void>
retryTask(taskId: string): void

// Queries
getActiveTasks(): BackgroundTask[]
getQueueStats(): BackgroundTaskQueueStats
```

---

**Last Updated**: 2025-12-10
**Documentation Version**: 1.0.0
**Quack Version**: 2.8.5+
