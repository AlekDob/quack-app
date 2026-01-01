# Task Completion Hooks

**Date**: 2025-12-31
**Status**: Implemented & Active
**Memory Entity**: `quack_task_completion_hooks`

---

## Overview

The **Task Completion Hooks** system automatically generates documentation and saves knowledge to MCP Memory (Second Brain) when Kanban tasks are completed. This ensures that agent work is never lost and provides a searchable trail of completed work.

### The Problem

Before this feature:
- **Agents forgot context** between sessions - no memory of what was done
- **No documentation trail** - completed work disappeared when conversations ended
- **Lost knowledge** - solutions, decisions, and patterns were not preserved
- **No searchability** - couldn't find what was accomplished on past tasks

### The Solution

When a Kanban task moves to "Done" status:
1. **AI analyzes** the conversation to extract key information
2. **Generates documentation** - Markdown file in project's `/docs` folder
3. **Saves to MCP Memory** - Persists to Second Brain with project relation
4. **Notifies user** - Toast with link to open the documentation

---

## Architecture

### Component Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Kanban UI (Drag to Done)                  │
│                 OR MCP Tool (kanban_move_task)               │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│         useTaskCompletionHooks React Hook                    │
│  - Triggers on status change to 'done'                       │
│  - Checks skipDocumentation flag                             │
│  - Processes in background (non-blocking)                    │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│          taskCompletionService (Core Logic)                  │
│  - Loads chat messages for task                              │
│  - Calls taskDocGenerator to create markdown                 │
│  - Saves file to project docs folder                         │
│  - Creates MCP Memory entity with belongs_to_project         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ├──────────────────┬───────────────────────┐
                     ▼                  ▼                       ▼
         ┌──────────────────┐  ┌───────────────┐  ┌────────────────────┐
         │  taskDocGenerator│  │ File System   │  │   MCP Memory       │
         │  - Extract summary│  │ - Write .md   │  │ - Create entity    │
         │  - Find decisions │  │ - Create dirs │  │ - Add observation  │
         │  - List files     │  │ - Return path │  │ - Link to project  │
         │  - Format markdown│  └───────────────┘  └────────────────────┘
         └──────────────────┘
                     │
                     ▼
         ┌──────────────────────────────────────────┐
         │   Toast Notification (sonner)            │
         │   - "Task documented" message            │
         │   - "Open" button → opens doc in editor  │
         └──────────────────────────────────────────┘
```

### Data Flow

1. **Trigger**: User drags task to Done column OR AI uses `kanban_move_task` tool with `newStatus: 'done'`
2. **Check**: System checks `skipDocumentation` option (from checkbox or MCP tool parameter)
3. **Extract**: `taskDocGenerator` analyzes chat messages to extract:
   - Summary of work done
   - Key decisions made
   - Files modified (from tool calls)
   - Tools used
   - Cost and token usage
4. **Generate**: Create markdown documentation with all extracted info
5. **Save**: Write to `{project}/docs/kanban-tasks/{project-slug}/{date}-{task-slug}.md`
6. **Persist**: Create MCP Memory entity with `belongs_to_project` relation
7. **Notify**: Show toast with "Open" button to view the doc

---

## Key Features

### 1. Auto-documentation

**Location**: `{project}/docs/kanban-tasks/{project-slug}/{date}-{task-slug}.md`

**Example Path**:
```
/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/kanban-tasks/quack-app/2025-12-31-fix-sidebar-bug.md
```

**Content**:
- Task title, date, project, branch, agent, duration
- Objective (original task prompt)
- Summary (AI-generated from conversation)
- Key decisions (extracted from agent responses)
- Files modified (from tool calls)
- Tools used (Read, Write, Bash, etc.)
- Cost breakdown (tokens + USD)
- Completion note (if provided)

### 2. Memory Persistence (Second Brain)

**Entity Type**: `pattern`
**Relation**: `belongs_to_project` → `quack-app`

**Example Memory**:
```json
{
  "type": "entity",
  "name": "kanban_task_fix_sidebar_bug",
  "entityType": "pattern",
  "observations": [
    "[2025-12-31] Fixed sidebar bug by updating CSS flexbox. Modified: src/components/Sidebar.css. Used tools: Read, Write."
  ]
}
```

### 3. Skip Documentation Option

**UI**: Checkbox in "Mark as Done" modal (future enhancement)
**MCP Tool**: Optional parameter in `kanban_move_task`

```javascript
// Skip documentation via MCP tool
kanban_move_task({
  taskId: "task-123",
  newStatus: "done",
  skipDocumentation: true, // Optional: skip doc generation
  completionNote: "Quick fix, no docs needed"
})
```

### 4. Badge Indicator

Tasks with generated documentation show a doc icon badge:
- **📄 Icon**: Indicates documentation exists
- **Click**: Opens documentation file in default editor
- **Hover**: Shows doc file path

### 5. Toast Notification with Link

On completion:
- **Success toast**: "Task documented" with green checkmark
- **Action button**: "Open" → opens doc file in editor
- **Duration**: 5 seconds
- **Auto-dismiss**: Can be closed manually

**Skipped Documentation**:
- **Info toast**: "Task marked as done - Documentation skipped"
- **Duration**: 3 seconds

**Error Handling**:
- **Error toast**: "Failed to document task" with error message
- **Duration**: 5 seconds

---

## File Structure

### Core Implementation Files

```
src/
├── services/
│   ├── taskDocGenerator.ts         # Markdown generation from chat
│   └── taskCompletionService.ts    # Core completion logic (to be created)
├── hooks/
│   └── useTaskCompletionHooks.ts   # React hook for UI integration
└── tests/
    └── taskCompletionHooks.test.ts # Unit tests (to be created)
```

### taskDocGenerator.ts

**Purpose**: Generates markdown documentation from task data and chat messages

**Key Functions**:
- `generateTaskSummary(messages)` - Extracts summary, decisions, files, tools
- `generateDocMarkdown(task, summary)` - Creates full markdown document
- `slugify(title)` - Converts title to filename-safe slug
- `getDocFilePath(task)` - Returns full path for doc file

**Intelligence**:
- **Pattern matching**: Finds decision indicators ("decided", "choosing", "will use")
- **Tool analysis**: Extracts file paths from tool call inputs (Read, Write, Bash)
- **Summary generation**: Extracts action statements ("I've created", "Fixed", "Updated")
- **Smart truncation**: Limits summary to 5 key points, 200 chars max

### useTaskCompletionHooks.ts

**Purpose**: React hook for integrating completion processing into Kanban UI

**API**:
```typescript
const {
  processTaskCompletion,    // Main function to trigger processing
  isProcessing,             // Map<taskId, boolean> - processing state
  completionResults,        // Map<taskId, TaskCompletionResult> - results
  pendingDocumentations,    // Set<taskId> - tasks being documented
  clearResult,              // Clear result for a task
} = useTaskCompletionHooks();
```

**Features**:
- **Background processing**: Non-blocking, doesn't freeze UI
- **Toast notifications**: Success/error toasts with "Open" action
- **State tracking**: Tracks processing state per task
- **Error handling**: Graceful error recovery with user feedback

### taskCompletionService.ts (To Be Created)

**Purpose**: Core service that orchestrates the completion workflow

**Responsibilities**:
1. Load chat messages for the task
2. Call `generateTaskSummary()` to extract info
3. Call `generateDocMarkdown()` to create markdown
4. Write file to disk (create directories if needed)
5. Create MCP Memory entity with `belongs_to_project` relation
6. Return `TaskCompletionResult` with file path and memory entity ID

---

## Configuration

### Default Behavior

**No configuration needed!** The system works automatically when tasks move to Done status.

### Customization Options

1. **Documentation Path** - Edit `getDocFilePath()` in `taskDocGenerator.ts`
   - Default: `{project}/docs/kanban-tasks/{project-slug}/{date}-{task-slug}.md`

2. **Memory Entity Type** - Edit `taskCompletionService.ts` (when created)
   - Default: `pattern`
   - Alternatives: `bug_fix`, `decision`, `gotcha`

3. **Skip Documentation** - Use `skipDocumentation` option:
   - UI checkbox (future)
   - MCP tool parameter (available now)

---

## Triggers

### 1. Drag-and-Drop to Done Column (UI)

**User Action**: Drag task card to "Done" column
**skipDocumentation**: Default `false` (always generates docs)

```typescript
// In KanbanView.tsx or KanbanColumn.tsx
const handleTaskDrop = async (taskId: string) => {
  const task = tasks.find(t => t.id === taskId);
  const messages = chatSessions.get(taskId) || [];

  // Trigger completion hook
  await processTaskCompletion(taskId, task, messages, {
    source: 'ui',
    skipDocumentation: false, // Can be controlled by checkbox
  });
};
```

### 2. MCP Tool: kanban_move_task

**AI Action**: Agent moves task to done via MCP tool
**skipDocumentation**: Optional parameter

```javascript
// From claude-agent-sdk custom tool
const result = await mcp.kanban_move_task({
  taskId: "kanban-1234567890-abc123",
  newStatus: "done",
  completionNote: "All tests passing, feature complete",
  skipDocumentation: false // Optional: set to true to skip docs
});
```

**Tool Response**:
```
Task "Fix sidebar bug" moved from in_progress to done
Note: All tests passing, feature complete
```

### 3. Programmatic API (Future)

```typescript
import { processTaskCompletion } from '../services/taskCompletionService';

// Manual trigger
const result = await processTaskCompletion({
  task: kanbanTask,
  chatMessages: messages,
  options: {
    source: 'api',
    skipDocumentation: false,
    completionNote: 'Custom note'
  }
});
```

---

## Documentation Template

### Generated Markdown Structure

```markdown
# Task Title

**Date**: YYYY-MM-DD
**Project**: project-name
**Branch**: feature-branch
**Agent**: Agent Name
**Duration**: 15m 30s

## Objective

[Original task prompt from task.prompt field]

## Summary

[AI-generated summary extracted from conversation]

## Key Decisions

- Decision 1 extracted from conversation
- Decision 2 extracted from conversation

## Files Modified

- `/path/to/file1.ts`
- `/path/to/file2.css`

## Tools Used

Read, Write, Bash, Grep

## Cost

**Total Cost**: $0.0234

**Token Usage**:
- Input: 1,234
- Output: 567
- Cache Creation: 2,000
- Cache Read: 8,500

## Notes

[Optional completion note from task.completionNote field]

---
*Generated by Quack Task Completion Hook*
```

### Real Example

```markdown
# Fix sidebar scrolling issue

**Date**: 2025-12-31
**Project**: quack-app
**Branch**: feature/sidebar-fix
**Agent**: Agent Magnus
**Duration**: 18m 45s

## Objective

Fix the sidebar scrolling issue where the sidebar doesn't scroll when many terminals are open.

## Summary

I've identified the issue in the Sidebar component CSS. The parent container was missing overflow-y: auto. Updated the CSS to add proper scrolling and tested with 20+ terminals.

## Key Decisions

- using flexbox with overflow-y: auto instead of absolute positioning
- keeping fixed height for the sidebar container
- adding smooth scrolling behavior for better UX

## Files Modified

- `src/components/Sidebar.tsx`
- `src/components/Sidebar.css`

## Tools Used

Bash, Grep, Read, Write

## Cost

**Total Cost**: $0.0156

**Token Usage**:
- Input: 2,341
- Output: 892
- Cache Read: 12,500

## Notes

All tests passing, verified with 25 terminals open. No performance issues detected.

---
*Generated by Quack Task Completion Hook*
```

---

## MCP Memory Integration

### Entity Creation

**Entity Type**: `pattern` (can be customized)
**Naming Convention**: `kanban_task_{task-slug}`

```json
{
  "type": "entity",
  "name": "kanban_task_fix_sidebar_scrolling_issue",
  "entityType": "pattern",
  "observations": [
    "[2025-12-31] Fixed sidebar scrolling by adding overflow-y: auto. Modified: Sidebar.tsx, Sidebar.css. Tools: Read, Write. Cost: $0.0156"
  ]
}
```

### Project Relation

**Relation Type**: `belongs_to_project`
**Target**: Project entity (e.g., `quack-app`)

```json
{
  "type": "relation",
  "from": "kanban_task_fix_sidebar_scrolling_issue",
  "to": "quack-app",
  "relationType": "belongs_to_project"
}
```

### Memory Benefits

1. **Searchable**: Find past solutions via `mcp__memory__search_nodes`
2. **Context**: AI can see what was done on similar tasks
3. **Learning**: Patterns and decisions are preserved for future reference
4. **Project Scoped**: Only visible when working in the same project

### Memory Query Examples

```typescript
// Search for sidebar-related patterns
const result = await mcp__memory__search_nodes({
  query: "sidebar scrolling"
});

// Find all completed Kanban tasks for this project
const result = await mcp__memory__read_graph();
const projectTasks = result.entities.filter(e =>
  e.name.startsWith('kanban_task_') &&
  e.relations.some(r => r.to === 'quack-app' && r.type === 'belongs_to_project')
);
```

---

## Testing

### Test File (To Be Created)

**Path**: `src/tests/taskCompletionHooks.test.ts`

**Test Coverage**:
```typescript
describe('Task Completion Hooks', () => {
  describe('taskDocGenerator', () => {
    it('should generate summary from chat messages', () => { ... });
    it('should extract key decisions', () => { ... });
    it('should extract files from tool calls', () => { ... });
    it('should format markdown correctly', () => { ... });
    it('should slugify titles properly', () => { ... });
  });

  describe('useTaskCompletionHooks', () => {
    it('should process task completion', () => { ... });
    it('should skip documentation when requested', () => { ... });
    it('should show toast on success', () => { ... });
    it('should handle errors gracefully', () => { ... });
  });

  describe('taskCompletionService', () => {
    it('should save doc file to correct path', () => { ... });
    it('should create MCP memory entity', () => { ... });
    it('should link to project via belongs_to_project', () => { ... });
  });
});
```

### Run Tests

```bash
# Run all tests
npm test

# Run task completion tests specifically
npm test -- taskCompletionHooks

# Watch mode
npm run test:watch -- taskCompletionHooks

# Coverage
npm run test:coverage -- taskCompletionHooks
```

### Manual Testing

1. **Create a test task** in Kanban board
2. **Work on the task** - have a conversation, use tools (Read, Write, Bash)
3. **Move to Done** - drag to Done column
4. **Verify toast** - "Task documented" with "Open" button
5. **Click "Open"** - should open doc file in editor
6. **Check file** - verify content is accurate
7. **Check MCP Memory** - search for the task entity

---

## Best Practices

### When to Skip Documentation

**Skip (`skipDocumentation: true`) for**:
- Quick fixes (<5 minutes)
- Trivial changes (typos, formatting)
- Experimental/throwaway tasks
- Tasks with no valuable knowledge to preserve

**Always Document for**:
- Bug fixes (solutions for future reference)
- New features (implementation details)
- Complex decisions (architecture choices)
- Learning moments (gotchas, pitfalls)

### Writing Good Completion Notes

**Good**:
```
completionNote: "All tests passing. Fixed race condition in event handler by adding debounce. Performance improved 40%."
```

**Bad**:
```
completionNote: "Done"
```

### Managing Documentation Files

**Regular Cleanup**:
- Archive old task docs after 6 months
- Move to `docs/kanban-tasks/archive/{year}/`
- Keep important patterns in separate files

**Searchability**:
- Use descriptive task titles (shows in filename)
- Add tags in completion notes
- Reference related issues/PRs

---

## Troubleshooting

### Documentation Not Generated

**Symptoms**: Task moves to Done but no toast appears

**Possible Causes**:
1. `skipDocumentation: true` was set
2. No chat messages for the task
3. Error in doc generation (check console)

**Solution**:
```typescript
// Check console for errors
console.log('[taskCompletionHooks] Processing task completion:', taskId);

// Verify chat messages exist
const messages = chatSessions.get(taskId);
console.log('Messages:', messages?.length);

// Check skipDocumentation flag
console.log('Skip:', options.skipDocumentation);
```

### Toast Not Showing

**Symptoms**: Doc is generated but no toast notification

**Solution**:
- Check if `sonner` toast is imported correctly
- Verify toast container is rendered in App.tsx
- Check browser console for toast errors

### File Path Errors

**Symptoms**: "Failed to save documentation" error

**Possible Causes**:
- Directory doesn't exist
- Insufficient permissions
- Invalid characters in filename

**Solution**:
```typescript
// Ensure directory exists (add to taskCompletionService)
const dir = path.dirname(docFilePath);
await fs.mkdir(dir, { recursive: true });
```

### MCP Memory Not Created

**Symptoms**: Doc file exists but can't find in MCP Memory

**Solution**:
- Verify MCP Memory server is running
- Check server logs for errors
- Try searching with different queries
- Verify `belongs_to_project` relation was created

---

## Future Enhancements

### Planned Features

1. **Skip Checkbox in UI** - Toggle in "Mark as Done" modal
2. **AI Summary Improvement** - Use Claude API to generate better summaries
3. **Template Customization** - User-defined doc templates
4. **Auto-tagging** - AI suggests tags for better searchability
5. **Documentation Preview** - Preview before saving
6. **Bulk Documentation** - Document multiple completed tasks at once
7. **Export Options** - Export as PDF, HTML, or JSON
8. **Documentation Metrics** - Track doc quality and usefulness
9. **Related Tasks** - Link to related completed tasks
10. **Documentation Search** - Search across all task docs

### Known Limitations

1. **Summary Quality** - Currently pattern-based, not AI-powered
2. **File Path Extraction** - Only works for known tool parameters
3. **No Preview** - Can't preview doc before saving
4. **Fixed Template** - Can't customize markdown structure
5. **No Versioning** - Overwriting same task doc loses history

---

## Related Documentation

- **Kanban Board**: `/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/05-features/kanban-board.md` - Full Kanban system docs
- **MCP Memory Integration**: `/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/05-features/mcp-memory-integration.md` - MCP Memory setup
- **Second Brain**: `/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/05-features/second-brain.md` - Second Brain concept
- **Architecture**: `/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/01-architecture.md` - System architecture

---

## API Reference

### Types

```typescript
// Task completion options
interface TaskCompletionOptions {
  skipDocumentation?: boolean;  // Skip doc generation
  source: 'ui' | 'mcp';         // Source of completion trigger
  completionNote?: string;      // Custom completion note
}

// Task completion result
interface TaskCompletionResult {
  memoryEntityId?: string;      // MCP Memory entity ID
  docFilePath?: string;         // Path to generated doc
  error?: string;               // Error message if failed
  skipped?: boolean;            // True if skipped
}

// Task summary (extracted from chat)
interface TaskSummary {
  objective: string;            // From task.prompt
  summary: string;              // AI-generated summary
  keyDecisions: string[];       // Extracted decisions
  filesModified: string[];      // File paths from tools
  toolsUsed: string[];          // Tool names
}
```

### Functions

```typescript
// Generate summary from messages
function generateTaskSummary(messages: ChatMessage[]): TaskSummary

// Generate markdown from task and summary
function generateDocMarkdown(task: KanbanTask, summary: TaskSummary): string

// Convert title to filename slug
function slugify(title: string): string

// Get full doc file path
function getDocFilePath(task: KanbanTask): string
```

---

**Last Updated**: 2025-12-31
**Documentation Version**: 1.0.0
**Quack Version**: 2.8.5+
