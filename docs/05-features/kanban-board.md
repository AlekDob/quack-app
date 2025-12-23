# Kanban Board Feature

> **Date**: 2025-12-23
> **Status**: Implemented
> **Memory Entity**: `kanban_feature_quack`

## Overview

The Kanban Board is an alternative view to the standard chat interface in Quack. It allows users to manage AI tasks visually across three columns (TODO, In Progress, Done) with drag-and-drop functionality.

## Key Features

- **Cross-project view**: Displays ALL tasks from ALL projects (not filtered by single project)
- **Agent selection**: Uses `TerminalInfo` (active terminals with avatars), not droids
- **Drag-and-drop**: Powered by `@dnd-kit/core` and `@dnd-kit/sortable`
- **Session persistence**: Tasks and chat sessions persist across app restarts
- **New Agent creation**: "+ New Agent" button opens NewTerminalModal with pre-selected project

## Architecture

### Layout

```
+---------------------------------------------------------------+----------+
|                     KANBAN BOARD (full width)                  |  ASIDE   |
| [<- Agents] Kanban Board                       [+ Add Task]    |          |
+---------------------------------------------------------------+          |
|  +--------------+  +--------------+  +--------------+          |          |
|  |    TODO      |  |  In Progress |  |     Done     |          |          |
|  |   [Card]     |  |   [Card]     |  |   [Card]     |          |          |
|  +--------------+  +--------------+  +--------------+          |          |
+---------------------------------------------------------------+----------+
```

- **Sidebar**: Hidden when Kanban is active (`gridTemplateColumns: "0px..."`)
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

## User Flow

1. **Open Kanban**: Click "Board" button in toolbar (Trello-style icon)
2. **Create Task**: Click "Add Task" -> Select Project -> Select Branch -> Select Agent (or "+ New Agent") -> Enter Title & Prompt
3. **Move to In Progress**: Drag card or click on it -> Drawer opens, chat auto-starts with prompt
4. **Complete Task**: Drag to Done when satisfied
5. **View History**: Click on Done tasks to view chat history

## Related Memory Entities

- `kanban_feature_quack` - Main feature entity
- `kanban_files_created` - File structure documentation
- `kanban_chat_integration` - Critical chat integration pattern

## Future Improvements

- [ ] Task filtering by project/agent
- [ ] Task priority levels
- [ ] Due dates
- [ ] Task templates
- [ ] Bulk operations
