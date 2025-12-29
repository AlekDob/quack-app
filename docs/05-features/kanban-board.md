# Kanban Board Feature

> **Date**: 2025-12-25 (Updated)
> **Status**: Implemented + MCP Integration
> **Memory Entity**: `kanban_feature_quack`, `quack_kanban_mcp_tools`

## Overview

The Kanban Board is an alternative view to the standard chat interface in Quack. It allows users to manage AI tasks visually across three columns (TODO, In Progress, Done) with drag-and-drop functionality. **Now with full MCP Tools integration for AI-driven task management.**

## Key Features

- **Cross-project view**: Displays ALL tasks from ALL projects (not filtered by single project)
- **Agent selection**: Uses `TerminalInfo` (active terminals with avatars), not droids
- **Drag-and-drop**: Powered by `@dnd-kit/core` and `@dnd-kit/sortable`
- **Session persistence**: Tasks and chat sessions persist across app restarts
- **New Agent creation**: "+ New Agent" button opens NewTerminalModal with pre-selected project
- **MCP Tools Integration**: 7 custom tools for AI-driven Kanban operations
- **Drag Agent to Kanban**: Drag agents from sidebar directly to Kanban board
- **Session Context Reading**: AI can read conversation history for coordinated operations
- **Side Panel**: Expandable sidebar in Kanban mode with `kanbanSidePanelExpanded` state

## Architecture

### Layout

```
+------------------+-----------------------------------------------+----------+
|    SIDE PANEL    |           KANBAN BOARD                        |  ASIDE   |
|   (Collapsible)  | [<- Agents] Kanban Board        [+ Add Task]  |          |
|                  +-----------------------------------------------+          |
|   [Agent 1]      |  +-----------+  +-----------+  +-----------+  |          |
|   [Agent 2]      |  |   TODO    |  |In Progress|  |   Done    |  |          |
|   [Agent 3]      |  |  [Card]   |  |  [Card]   |  |  [Card]   |  |          |
|   (Drag to add)  |  +-----------+  +-----------+  +-----------+  |          |
+------------------+-----------------------------------------------+----------+
```

- **Side Panel**: Visible and collapsible in Kanban mode via `kanbanSidePanelExpanded` state
- **ActionIcons & TabBar**: Hidden via conditional rendering
- **Header**: Draggable via `data-tauri-drag-region`, 70px left padding for macOS traffic lights

### File Structure

```
src/
├── components/kanban/
│   ├── KanbanView.tsx          # Main container, receives chat props from App.tsx
│   ├── KanbanView.css          # Dark theme styling
│   ├── KanbanColumn.tsx        # Droppable column
│   ├── KanbanCard.tsx          # Draggable card with project/branch/agent info
│   ├── KanbanChatDrawer.tsx    # Chat drawer (uses props, NOT useClaudeChat)
│   └── AddKanbanTaskModal.tsx  # Task creation modal
├── stores/
│   └── kanbanStore.ts          # Zustand store with devtools + persist
├── services/
│   └── kanbanStorage.ts        # Tauri Store persistence
└── types.ts                    # KanbanTask, KanbanStatus, KanbanAssignedAgent

src-tauri/node-sdk/
└── kanban-mcp-server.js        # MCP server with 7 Kanban tools
```

## MCP Tools Integration

The Kanban board is fully accessible to AI agents via **8 custom MCP tools**. This allows Claude to manage tasks, check workloads, and coordinate with other agents.

### Available Tools

| Tool | Description |
|------|-------------|
| `kanban_list_agents` | **NEW!** List available agents from sidebar (use FIRST to see who can be assigned) |
| `kanban_list_tasks` | List all tasks, optionally filtered by status/project |
| `kanban_create_task` | Create a new task with title, prompt, project, agent (supports fuzzy name matching!) |
| `kanban_move_task` | Move task between columns (todo → in_progress → done) |
| `kanban_update_task` | Update task properties (title, prompt, agent, tokens) |
| `kanban_delete_task` | Delete a task by ID |
| `kanban_get_workload` | Get workload summary per agent |
| `kanban_get_session_context` | Read conversation history for coordinated operations |

### Agent Assignment (Fuzzy Matching)

When creating a task, you can assign an agent by **name** (not just ID). The system supports fuzzy matching:

```javascript
// All these will find "Agent Magnus":
{ assignedAgentName: "Magnus" }
{ assignedAgentName: "magnus" }
{ assignedAgentName: "Agent Magnus" }

// Or use exact ID:
{ assignedAgentId: "uuid-here" }
```

**Recommended workflow:**
1. Use `kanban_list_agents` first to see available agents
2. Use `kanban_create_task` with `assignedAgentName: "Magnus"` (or whatever name)

### Session Context Tool

The `kanban_get_session_context` tool allows AI agents to read previous conversation history:

```javascript
// Tool: kanban_get_session_context
{
  agentId: "task-123",     // Required: Task/agent ID
  messageLimit: 10         // Optional: Number of recent messages (default: 10, max: 50)
}

// Returns:
{
  success: true,
  contextSummary: {
    totalMessages: 15,
    retrievedMessages: 10,
    conversation: [
      { role: "user", content: "Create a marketing article..." },
      { role: "assistant", content: "I'll help you with that...", toolCalls: [...] }
    ],
    quickSummary: "Last 10 messages from session"
  }
}
```

**Use Case**: Enables agents to coordinate based on previous results. For example, Agent Jack can check what Agent Marcus wrote before assigning the next task.

### MCP Server Architecture

The Kanban MCP server uses **stdio protocol** (not in-process SDK) to avoid stream issues:

```javascript
// kanban-mcp-server.js
const STORE_PATH = join(getTauriStorePath(), 'quack-kanban.json');
const CHAT_STORE_PATH = join(getTauriStorePath(), 'quack-chats.json');

// Uses store.reload() before reads to sync with external changes
async function loadTasks() {
  const { Store } = await getStoreModule();
  const store = await Store.load(STORE_PATH, { autoSave: false });
  await store.reload();  // Critical: sync with frontend changes
  // ...
}
```

## Drag Agent to Kanban

Users can **drag an agent from the sidebar directly onto the Kanban board** to create a task with that agent pre-assigned.

### Implementation

Uses native HTML5 drag-and-drop (not @dnd-kit):

```typescript
// TerminalListItem.tsx
const handleDragStart = (e: React.DragEvent) => {
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'terminal',
    terminal: terminal
  }));
};

// KanbanColumn.tsx
const handleDrop = (e: React.DragEvent) => {
  const data = JSON.parse(e.dataTransfer.getData('application/json'));
  if (data.type === 'terminal') {
    // Open AddKanbanTaskModal with pre-filled agent
    onAddTask({ prefilledAgent: data.terminal });
  }
};
```

## Critical Implementation Details

### Chat Integration (IMPORTANT)

**DO NOT use `useClaudeChat` hook in KanbanChatDrawer!**

The `useClaudeChat` hook tries to call Claude SDK directly, but Quack uses Tauri backend. This causes the error:
```
Error: Claude SDK should be called via Tauri backend, not directly from frontend
```

**Solution**: Pass chat functions from App.tsx as props:

```typescript
// App.tsx - Dedicated functions for Kanban
const sendMessageForTargetAgent = useCallback(async (targetAgentId: string, content: string, options?: ChatSendOptions) => {
  // Uses invoke() to call Tauri backend
});

const abortStreamForTargetAgent = useCallback((targetAgentId: string) => { ... });
const clearConversationForTargetAgent = useCallback((targetAgentId: string) => { ... });
const getLastPromptForTargetAgent = useCallback((targetAgentId: string) => { ... });

// Props chain: App.tsx -> KanbanView -> KanbanChatDrawer
<KanbanView
  chatSessions={chatSessions}
  chatLoadingMap={chatLoadingMap}
  onSendMessage={sendMessageForTargetAgent}
  onAbortStream={abortStreamForTargetAgent}
  onClearConversation={clearConversationForTargetAgent}
  getLastPrompt={getLastPromptForTargetAgent}
  sessionTokensMap={chatTokensMap}
/>
```

### Session Isolation

Each Kanban task uses `task.id` as `agentId` for isolated chat sessions:

```typescript
// KanbanChatDrawer.tsx
const agentId = task?.id || '';
const messages = chatSessions.get(agentId) || [];
const isLoading = chatLoadingMap.get(agentId) || false;
```

### Types

```typescript
export type KanbanStatus = 'todo' | 'in_progress' | 'done';

export interface KanbanAssignedAgent {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  projectPath: string;
  projectName: string;
  branch?: string;
  useWorktree?: boolean;
  worktreePath?: string;
  workingOn?: string;
  personality?: Record<string, unknown>;
}

export interface KanbanTask {
  id: string;
  title: string;
  prompt: string;
  status: KanbanStatus;
  assignedAgent?: KanbanAssignedAgent;
  projectPath: string;
  projectName: string;
  branch?: string;
  sessionId?: string;
  terminalId?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost?: number;
}
```

## Bug Fixes & Solutions

### 1. MCP Stream Closed Error

**Problem**: `write EPIPE` / `Stream closed` errors when using in-process SDK
**Solution**: Use stdio-based MCP server instead of in-process SDK

```javascript
// kanban-mcp-server.js - Uses stdio protocol
const server = new Server({ name: 'kanban-mcp-server', version: '1.0.0' }, { capabilities: {...} });
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 2. Tauri Store Race Condition

**Problem**: Tasks created from frontend not visible to MCP server
**Solution**: Call `store.reload()` before every read operation

```javascript
async function loadTasks() {
  const store = await Store.load(STORE_PATH, { autoSave: false });
  await store.reload();  // Sync with external file changes
  return await store.get('tasks') || [];
}
```

### 3. Chat Hanging in WORKING State

**Problem**: Chat stays in loading state when task status changes externally
**Solution**: Sync `chatLoadingMap` with Kanban task status changes

## User Flow

1. **Open Kanban**: Click "Board" button in toolbar (Trello-style icon)
2. **Create Task**:
   - Click "Add Task" -> Select Project -> Select Branch -> Select Agent -> Enter Title & Prompt
   - OR: Drag agent from sidebar to Kanban board (pre-fills agent)
3. **Move to In Progress**: Drag card or click on it -> Drawer opens, chat auto-starts with prompt
4. **Complete Task**: Drag to Done when satisfied
5. **View History**: Click on Done tasks to view chat history

## Related Memory Entities

- `kanban_feature_quack` - Main feature entity
- `quack_kanban_mcp_tools` - MCP tools documentation
- `kanban_files_created` - File structure documentation
- `kanban_chat_integration` - Critical chat integration pattern
- `bug_fix_mcp_stream_closed` - Stream closed error solution
- `bug_fix_tauri_store_race_condition` - Store sync solution
- `pattern_kanban_side_panel_in_kanban_mode` - Side panel behavior
- `pattern_drag_agent_to_kanban` - Drag-and-drop pattern
- `feature_kanban_session_context_tool` - Session context reading

## Future Improvements

- [ ] Task filtering by project/agent
- [ ] Task priority levels
- [ ] Due dates
- [ ] Task templates
- [ ] Bulk operations
- [x] ~~MCP Tools Integration~~ (Completed 2025-12-25)
- [x] ~~Drag Agent to Kanban~~ (Completed 2025-12-25)
- [x] ~~Session Context Reading~~ (Completed 2025-12-25)
