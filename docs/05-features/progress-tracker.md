# Long-Running Agent Progress System

> Based on Anthropic's "Effective Harnesses for Long-Running Agents" research patterns.

## Overview

The Progress Tracker is a comprehensive system for managing long-running agent tasks in Quack. It provides visibility into task progress, feature tracking, diagnostic startup protocols, and Git checkpoint management for rollback capabilities.

## Key Features

### 1. Feature Checklist Tracking
- Prevents "early victory declaration" by tracking completion of each feature
- Priority-based feature ordering (high, medium, low)
- Status tracking: pending, in_progress, done, blocked
- Progress percentage calculation based on completed features

### 2. Diagnostic Startup Protocol
Pre-flight checks before resuming work:
- Working directory validation
- Git repository status check
- Branch drift detection
- Uncommitted changes detection
- Test status verification

### 3. Git Checkpoints
Safe rollback points during long tasks:
- Create checkpoint commits at stable states
- Soft rollback (revert commits) or hard rollback (git reset)
- Checkpoint history tracking

### 4. Action Logging
Complete audit trail of agent actions:
- Timestamped entries
- Success/error/warning status
- Feature association
- Tool name tracking

## Architecture

```
src/
  types/progress.ts          # Type definitions
  stores/progressStore.ts    # Zustand store with persistence
  services/
    progressService.ts       # Business logic & diagnostics
    progressStorage.ts       # Tauri Store persistence (optional)
    gitCheckpointService.ts  # Git checkpoint operations
  hooks/
    useProgressTab.ts        # Tab management hook
    useAgentProgress.ts      # Main progress management hook
  components/progress/
    ProgressViewer.tsx       # Main container
    ProgressHeader.tsx       # Task info & status
    ProgressFeatures.tsx     # Feature checklist
    ProgressActionLog.tsx    # Action history
    ProgressControls.tsx     # Control buttons
    ProgressEmpty.tsx        # Empty state
    Progress.css             # Styling
  views/
    ProgressTabView.tsx      # Tab wrapper
```

## Usage

### Opening Progress Tracker

Click the clipboard icon in the toolbar (ActionIcons) or use the `useProgressTab` hook:

```typescript
import { useProgressTab } from './hooks/useProgressTab';

const { openProgressTab } = useProgressTab();
const tab = openProgressTab('progress-id', 'Task Name');
```

### Creating a Progress Entry

```typescript
import { useAgentProgress } from './hooks/useAgentProgress';

const { createProgress } = useAgentProgress();

const progress = createProgress({
  taskName: 'Implement Feature X',
  agentId: 'agent-123',
  agentName: 'Feature Developer',
  workingDirectory: '/path/to/project',
  features: [
    { description: 'Create UI components', priority: 'high' },
    { description: 'Add API integration', priority: 'medium' },
    { description: 'Write tests', priority: 'high' },
    { description: 'Update documentation', priority: 'low' },
  ],
});
```

### Managing Features

```typescript
const {
  addFeature,
  startNextFeature,
  completeCurrentFeature,
  blockCurrentFeature,
  allFeaturesComplete,
} = useAgentProgress();

// Start the next pending feature
startNextFeature(progressId);

// Complete current feature with optional git commit
completeCurrentFeature(progressId, 'abc1234');

// Block a feature
blockCurrentFeature(progressId, 'Waiting for API access');

// Check completion
if (allFeaturesComplete(progressId)) {
  // Ready to complete progress
}
```

### Pause/Resume with Diagnostics

```typescript
const { pauseProgress, resumeProgress, runDiagnostics } = useAgentProgress();

// Pause and save state snapshot
await pauseProgress(progressId, true); // true = tests were passing

// Run diagnostics before resuming
const diagnostics = await runDiagnostics(progressId);
if (diagnostics.canResume) {
  await resumeProgress(progressId);
}
```

### Git Checkpoints

```typescript
const { createCheckpoint, rollbackToCheckpoint, getCheckpoints } = useAgentProgress();

// Create checkpoint at stable state
const checkpoint = await createCheckpoint(
  progressId,
  '/path/to/project',
  'Feature X completed'
);

// View available checkpoints
const checkpoints = getCheckpoints(progressId);

// Rollback to checkpoint
const result = await rollbackToCheckpoint(progressId, rootPath, checkpoint.id);
```

## Data Flow

```
User Action
    |
    v
useAgentProgress Hook
    |
    v
progressService (business logic)
    |
    v
progressStore (Zustand state)
    |
    v
localStorage (persistence via Zustand persist)
```

## Status Flow

```
planning -> in_progress <-> paused -> completed
                  |
                  v
                failed
```

## Diagnostic Checks

| Check | Code | Type | Description |
|-------|------|------|-------------|
| Directory exists | DIR_NOT_FOUND | error | Working directory must exist |
| Git repository | NOT_GIT_REPO | warning | Optional, disables checkpoints |
| Branch drift | BRANCH_CHANGED | warning | Branch changed since pause |
| Uncommitted changes | UNCOMMITTED_CHANGES | info | Suggest commit/stash |
| Tests status | CHECK_TESTS | info | Recommend running tests |

## UI Components

### ProgressHeader
Displays task name, agent info, status badge with color coding, and overall progress bar.

### ProgressFeatures
Interactive checklist with:
- Status icons (checkmark, clock, pause, lock)
- Priority badges (high=red, medium=yellow, low=gray)
- Inline add feature form
- Feature completion actions

### ProgressActionLog
Filterable action history:
- Filter by type (all, success, error, warning)
- Expandable details
- Timestamp and duration

### ProgressControls
Action buttons:
- Pause/Resume with diagnostic status
- Create Checkpoint (with message input)
- Complete (requires all features done)

## Testing

Unit tests are in `src/tests/progress/progressStore.test.ts`:

```bash
npm test -- --grep "Progress Store"
```

## Styling

The component uses glassmorphism design matching Quack's dark theme:
- Background: rgba(22, 27, 34, 0.9)
- Backdrop blur: 12px
- Border: rgba(48, 54, 61, 0.8)
- Primary accent: #58a6ff

## Related Files

- **Article Reference**: [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- **Tab System**: `src/components/TabBar.tsx`
- **ActionIcons**: `src/components/ActionIcons.tsx`
- **App Integration**: `src/App.tsx`

## Future Improvements

1. **Two-Agent Pattern**: Implement Initializer + Worker agent coordination
2. **Progress Files**: Markdown-based progress files synced with disk
3. **MCP Integration**: Expose progress to MCP servers for agent access
4. **Notifications**: Desktop notifications for status changes
5. **Progress Templates**: Pre-defined feature templates for common tasks
