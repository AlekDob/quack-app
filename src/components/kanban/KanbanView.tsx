/**
 * KanbanView Component
 *
 * Main container for the Kanban board.
 * Displays three columns (TODO, In Progress, Done) and handles drag-drop.
 *
 * Now shows ALL tasks from ALL projects (cross-project view).
 * Uses @dnd-kit for drag-and-drop functionality.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import { KanbanCardOverlay } from './KanbanCard';
import AddKanbanTaskModal, { type KanbanTaskInitialValues, type KanbanTaskDraft } from './AddKanbanTaskModal';
import KanbanShellDrawer from './KanbanShellDrawer';
import { useKanbanStore } from '../../stores/kanbanStore';
import { useKanbanShellTask } from '../../hooks/useKanbanShellTask';
import { useKanbanPolling } from '../../hooks/useKanbanPolling';
import type { KanbanTask, KanbanStatus, TerminalInfo, KanbanAssignedAgent, ChatMessage, ChatAttachment } from '../../types';
import type { ChatSendOptions } from '../../hooks/useClaudeChat';
import { toast } from 'sonner';
import { confirm } from '@tauri-apps/plugin-dialog';
import './KanbanView.css';

interface KanbanViewProps {
  terminals: TerminalInfo[];
  onExitKanban?: () => void;
  // Chat integration from App.tsx
  chatSessions: Map<string, ChatMessage[]>;
  chatLoadingMap: Map<string, boolean>;
  onSendMessage: (agentId: string, content: string, options?: ChatSendOptions) => Promise<void>;
  onAbortStream: (agentId: string) => void;
  onClearConversation: (agentId: string) => void;
  onCompactConversation: (agentId: string) => void;
  getLastPrompt: (agentId: string) => string | null;
  sessionTokensMap: Map<string, { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; totalCost: number }>;
  // New Agent creation
  onCreateNewAgent?: (projectPath: string) => void;
  // Default settings from global settings
  defaultModel?: 'opus' | 'sonnet' | 'haiku';
  defaultThinkingMode?: 'auto' | 'think' | 'hard' | 'harder' | 'ultra';
  defaultPermissionMode?: 'plan' | 'bypass';
  defaultEffort?: 'low' | 'medium' | 'high';
  // 🦆 Load saved chat sessions from sessionIds
  onLoadChatSessions?: () => Promise<void>;
  // Open side panel when clicking on project name
  onProjectClick?: (projectPath: string) => void;
  // Diff drawer handler (passed to ChatView via task tab)
  onDiffClick?: (filePath: string, status: 'created' | 'modified' | 'deleted') => void;
  // Open session in terminal handler (for claude --resume)
  onOpenSessionInTerminal?: (taskId: string) => void;
  // Side panel toggle (for "Agents" button in header)
  onToggleSidePanel?: () => void;
  sidePanelExpanded?: boolean;
  // Mini panel toggle - exits Kanban to Chat with mini panel in sidebar
  onToggleMiniPanel?: () => void;
  showMiniPanel?: boolean;
  // Open task in new tab
  onOpenTaskTab?: (task: KanbanTask) => void;
  // Open terminal in specified directory (for worktree tasks)
  onOpenTerminal?: (path: string, label?: string) => void;
}

export default function KanbanView({
  terminals,
  onExitKanban,
  chatSessions,
  chatLoadingMap,
  onSendMessage,
  onAbortStream,
  onClearConversation,
  onCompactConversation,
  getLastPrompt,
  sessionTokensMap,
  onCreateNewAgent,
  defaultModel,
  defaultThinkingMode,
  defaultPermissionMode,
  defaultEffort,
  onLoadChatSessions,
  onProjectClick,
  onDiffClick,
  onOpenSessionInTerminal,
  onToggleSidePanel,
  sidePanelExpanded = false,
  onToggleMiniPanel,
  showMiniPanel = false,
  onOpenTaskTab,
  onOpenTerminal,
}: KanbanViewProps) {
  const {
    tasks,
    isLoading,
    loadTasks,
    addTask,
    moveTask,
    deleteTask,
    updateTask,
    isNewTaskModalRequested,
    clearNewTaskModalRequest,
    // Pagination for Done column
    getVisibleDoneTasks,
    hasMoreDoneTasks,
    loadMoreDone,
    isLoadingMoreDone,
  } = useKanbanStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  // Initial values for modal when agent is dragged from sidebar
  const [modalInitialValues, setModalInitialValues] = useState<KanbanTaskInitialValues | null>(null);
  // Draft state - persists when modal is closed accidentally
  const [modalDraft, setModalDraft] = useState<KanbanTaskDraft | null>(null);
  // Shell drawer state (separate from chat drawer)
  const [isShellDrawerOpen, setIsShellDrawerOpen] = useState(false);
  const [selectedShellTaskId, setSelectedShellTaskId] = useState<string | null>(null);

  // Shell task management hook
  const {
    outputs: shellOutputs,
    startShellTask,
    killShellTask,
    getTaskOutput,
    isTaskRunning,
    clearOutput,
  } = useKanbanShellTask();

  // Track which shell tasks we've already started to avoid double-starting
  const startedShellTasksRef = useRef<Set<string>>(new Set());

  // Custom collision detection that prioritizes columns over cards
  // This makes dropping on columns much easier
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // First, check if we're over a column using pointerWithin (more forgiving)
    const pointerCollisions = pointerWithin(args);

    // Find column collisions (prioritize these)
    const columnCollisions = pointerCollisions.filter(
      collision => ['todo', 'in_progress', 'done'].includes(collision.id as string)
    );

    // If we're over a column, return that
    if (columnCollisions.length > 0) {
      return columnCollisions;
    }

    // Fallback to rectIntersection for better detection
    const rectCollisions = rectIntersection(args);
    const columnRectCollisions = rectCollisions.filter(
      collision => ['todo', 'in_progress', 'done'].includes(collision.id as string)
    );

    if (columnRectCollisions.length > 0) {
      return columnRectCollisions;
    }

    // Last resort: any collision
    return rectCollisions;
  }, []);

  // Show ALL tasks (cross-project view)
  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  // Use paginated Done tasks for infinite scroll
  const visibleDoneTasks = getVisibleDoneTasks();
  const totalDoneTasks = tasks.filter((t) => t.status === 'done').length;
  const hasMoreDone = hasMoreDoneTasks();

  // Load tasks on mount, then load chat sessions from saved sessionIds
  useEffect(() => {
    const initializeKanban = async () => {
      await loadTasks();
      // 🦆 Load saved chat sessions after tasks are loaded
      if (onLoadChatSessions) {
        await onLoadChatSessions();
      }
    };
    initializeKanban();
  }, [loadTasks, onLoadChatSessions]);

  // 🦆 MCP SYNC: Poll for task changes from external sources (MCP server, other windows)
  // This ensures the Kanban UI stays in sync when tasks are created/modified via MCP tools
  useKanbanPolling({ enabled: true, interval: 5000 }); // 5 second interval for low overhead

  // Handle keyboard shortcut request to open new task modal
  useEffect(() => {
    if (isNewTaskModalRequested) {
      setIsModalOpen(true);
      clearNewTaskModalRequest();
    }
  }, [isNewTaskModalRequested, clearNewTaskModalRequest]);

  // Auto-start shell tasks that are in_progress but not yet running
  useEffect(() => {
    const shellTasksToStart = tasks.filter(task =>
      task.type === 'shell' &&
      task.status === 'in_progress' &&
      task.command &&
      !task.pid && // No PID means not started yet
      !task.completedAt && // Not already completed
      !startedShellTasksRef.current.has(task.id) &&
      !isTaskRunning(task.id)
    );

    shellTasksToStart.forEach(task => {
      console.log(`[KanbanView] Auto-starting shell task: ${task.id} - ${task.command}`);
      startedShellTasksRef.current.add(task.id);
      startShellTask(task.id);
    });
  }, [tasks, isTaskRunning, startShellTask]);


  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  // Handle drag over - track which column we're hovering
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && ['todo', 'in_progress', 'done'].includes(over.id as string)) {
      setOverColumnId(over.id as string);
    } else {
      setOverColumnId(null);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnId(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    if (['todo', 'in_progress', 'done'].includes(overId)) {
      const newStatus = overId as KanbanStatus;
      const task = tasks.find((t) => t.id === taskId);

      if (task && task.status !== newStatus) {
        // 🦆 Block moving to TODO if task has chat messages (conversation started)
        if (newStatus === 'todo') {
          const taskMessages = chatSessions.get(taskId) || [];
          if (taskMessages.length > 0) {
            toast.warning('This task has an active conversation and cannot be moved back to TODO. Move it to Done instead, or clear the conversation first.');
            return;
          }
        }

        moveTask(taskId, newStatus);

        // If moved to in_progress, open task in new tab
        if (newStatus === 'in_progress' && onOpenTaskTab) {
          onOpenTaskTab(task);
        }
      }
    }
  };

  // Handle card click - different behavior for agent vs shell/watch tasks
  const handleTaskClick = useCallback((task: KanbanTask) => {
    const taskType = task.type || 'agent';

    if (taskType === 'shell' || taskType === 'watch') {
      // Open shell drawer for shell/watch tasks
      setSelectedShellTaskId(task.id);
      setIsShellDrawerOpen(true);
    } else {
      // Open task in new tab for agent tasks
      if (onOpenTaskTab) {
        onOpenTaskTab(task);
      }
      // Close shell drawer if open
      setIsShellDrawerOpen(false);
      setSelectedShellTaskId(null);
    }
  }, [onOpenTaskTab]);

  // Handle Start button click - move to in_progress, open chat, send prompt
  const handleStartTask = useCallback(async (task: KanbanTask) => {
    // 1. Move task to in_progress
    await moveTask(task.id, 'in_progress');

    // 2. Open task in new tab
    if (onOpenTaskTab) {
      onOpenTaskTab(task);
    }

    // 3. Send the initial prompt after a short delay to ensure tab is open
    if (task.prompt) {
      setTimeout(() => {
        onSendMessage(task.id, task.prompt);
      }, 100);
    }
  }, [moveTask, onOpenTaskTab, onSendMessage]);

  // Handle task deletion with async Tauri dialog
  const handleTaskDelete = useCallback(async (taskId: string) => {
    const confirmed = await confirm('Are you sure you want to delete this task?', {
      title: 'Delete Task',
      kind: 'warning',
    });

    if (confirmed) {
      deleteTask(taskId);
      // Also clear shell output if this was a shell task
      clearOutput(taskId);
      // Close shell drawer if this task was selected
      if (selectedShellTaskId === taskId) {
        setIsShellDrawerOpen(false);
        setSelectedShellTaskId(null);
      }
    }
  }, [deleteTask, clearOutput, selectedShellTaskId]);

  // Handle clearing all done tasks (uses ALL done tasks, not just visible ones)
  const handleClearDone = useCallback(async () => {
    const allDoneTasks = tasks.filter((t) => t.status === 'done');
    const doneCount = allDoneTasks.length;
    if (doneCount === 0) return;

    const confirmed = await confirm(
      `Delete all ${doneCount} completed task${doneCount > 1 ? 's' : ''}? This action cannot be undone.`,
      {
        title: 'Clear Completed Tasks',
        kind: 'warning',
      }
    );

    if (confirmed) {
      // Delete all done tasks
      for (const task of allDoneTasks) {
        deleteTask(task.id);
        clearOutput(task.id);
      }
      toast.success(`Cleared ${doneCount} completed task${doneCount > 1 ? 's' : ''}`);
    }
  }, [tasks, deleteTask, clearOutput]);

  // Handle task edit (open modal in edit mode)
  const handleTaskEdit = useCallback((task: KanbanTask) => {
    setEditingTask(task);
    setIsModalOpen(true);
  }, []);


  // Handle task creation or update
  const handleCreateOrUpdateTask = useCallback(async (
    title: string,
    prompt: string,
    projectPath: string,
    projectName: string,
    branch: string | undefined,
    agent: KanbanAssignedAgent | undefined,
    attachments: ChatAttachment[],
    useWorktree?: boolean
  ) => {
    if (editingTask) {
      // Update existing task
      await updateTask(editingTask.id, {
        title,
        prompt,
        projectPath,
        projectName,
        branch,
        assignedAgent: agent,
        attachments,
        useWorktree,
      });
    } else {
      // Create new task (default to agent type)
      await addTask({
        title,
        prompt,
        status: 'todo',
        projectPath,
        projectName,
        branch,
        assignedAgent: agent,
        attachments,
        type: 'agent',
        useWorktree,
      });
    }
    setIsModalOpen(false);
    setEditingTask(null);
    setModalInitialValues(null);
    // Clear draft after successful creation
    setModalDraft(null);
  }, [addTask, updateTask, editingTask]);

  // Handle modal close - keeps draft intact for accidental closes
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingTask(null);
    // Clear initialValues but keep draft - user can reopen with "New Task" button
    setModalInitialValues(null);
  }, []);

  // Handle agent drop from sidebar (native HTML5 drag-and-drop)
  const handleSidebarAgentDrop = useCallback((
    agentId: string,
    targetColumn: KanbanStatus
  ) => {
    // Find the agent/terminal by id
    const agent = terminals.find(t => t.id === agentId);
    if (!agent) {
      console.warn('[KanbanView] Agent not found for drag:', agentId);
      return;
    }

    // Extract project name from path
    const pathParts = agent.cwd.split('/');
    const projectName = pathParts[pathParts.length - 1];

    // Pre-populate modal with agent data
    const initialValues: KanbanTaskInitialValues = {
      projectPath: agent.cwd,
      projectName,
      branch: agent.branch,
      agentId: agent.id,
      agentName: agent.label,
      agentAvatar: agent.avatar,
      agentColor: agent.color,
      targetStatus: targetColumn,
    };

    // Clear draft when dragging a new agent (starting fresh)
    setModalDraft(null);
    setModalInitialValues(initialValues);
    setEditingTask(null);
    setIsModalOpen(true);
  }, [terminals]);

  // Handle shell drawer close
  const handleShellDrawerClose = useCallback(() => {
    setIsShellDrawerOpen(false);
    setSelectedShellTaskId(null);
  }, []);

  // Handle shell task start
  const handleShellStart = useCallback(async (taskId: string) => {
    await startShellTask(taskId);
  }, [startShellTask]);

  // Handle shell task kill
  const handleShellKill = useCallback(async (taskId: string) => {
    await killShellTask(taskId);
  }, [killShellTask]);

  // Handle shell output clear
  const handleShellClearOutput = useCallback((taskId: string) => {
    clearOutput(taskId);
  }, [clearOutput]);

  // Handle kill from card (without opening drawer)
  const handleCardKill = useCallback(async (taskId: string) => {
    await killShellTask(taskId);
  }, [killShellTask]);

  // Convert shell outputs to format expected by columns
  const shellOutputsForColumns = new Map<string, { output: string; isRunning: boolean }>();
  shellOutputs.forEach((value, key) => {
    shellOutputsForColumns.set(key, {
      output: value.output,
      isRunning: value.isRunning,
    });
  });

  if (isLoading) {
    return (
      <div className="kanban-loading">
        <div className="kanban-loading-spinner" />
        <span>Loading tasks...</span>
      </div>
    );
  }

  return (
    <div className="kanban-view">
      {/* Header with Add Task button - draggable region */}
      <div className="kanban-header" data-tauri-drag-region>
        {/* Title - also draggable */}
        <h1 className="kanban-title" data-tauri-drag-region>Kanban Board</h1>

        {/* Spacer - main drag area */}
        <div style={{ flex: 1 }} data-tauri-drag-region />

        {/* Add Task button */}
        <button
          className="kanban-add-button"
          onClick={() => setIsModalOpen(true)}
          disabled={terminals.length === 0}
          title={terminals.length === 0 ? 'Create an agent first' : 'Add a new task'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Task
        </button>

        {/* Mini Panel toggle button - returns to chat with mini panel in sidebar */}
        {onToggleMiniPanel && (
          <button
            className={`kanban-mini-panel-toggle ${showMiniPanel ? 'active' : ''}`}
            onClick={onToggleMiniPanel}
            title={showMiniPanel ? 'Hide sidebar panel' : 'Show in sidebar and return to chat'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Sidebar with panel icon */}
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="9" y1="9" x2="21" y2="9" />
              <line x1="9" y1="15" x2="21" y2="15" />
            </svg>
            {showMiniPanel ? 'Hide Panel' : 'Sidebar View'}
          </button>
        )}
      </div>

      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-columns">
          <KanbanColumn
            id="todo"
            title="TODO"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            }
            tasks={todoTasks}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={handleTaskEdit}
            onTaskKill={handleCardKill}
            onTaskStart={handleStartTask}
            onProjectClick={onProjectClick}
            onOpenTerminal={onOpenTerminal}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
            shellOutputs={shellOutputsForColumns}
            isDropTarget={overColumnId === 'todo'}
            onSidebarAgentDrop={handleSidebarAgentDrop}
          />

          <KanbanColumn
            id="in_progress"
            title="In Progress"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            tasks={inProgressTasks}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={handleTaskEdit}
            onTaskKill={handleCardKill}
            onProjectClick={onProjectClick}
            onOpenTerminal={onOpenTerminal}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
            shellOutputs={shellOutputsForColumns}
            isDropTarget={overColumnId === 'in_progress'}
            onSidebarAgentDrop={handleSidebarAgentDrop}
          />

          <KanbanColumn
            id="done"
            title="Done"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            tasks={visibleDoneTasks}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={handleTaskEdit}
            onTaskKill={handleCardKill}
            onProjectClick={onProjectClick}
            onOpenTerminal={onOpenTerminal}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
            shellOutputs={shellOutputsForColumns}
            isDropTarget={overColumnId === 'done'}
            onSidebarAgentDrop={handleSidebarAgentDrop}
            onClearAll={handleClearDone}
            // Infinite scroll props
            hasMore={hasMoreDone}
            isLoadingMore={isLoadingMoreDone}
            onLoadMore={loadMoreDone}
            totalCount={totalDoneTasks}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeTask && <KanbanCardOverlay task={activeTask} />}
        </DragOverlay>
      </DndContext>

      {/* Add/Edit Task Modal */}
      <AddKanbanTaskModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleCreateOrUpdateTask}
        terminals={terminals}
        onCreateNewAgent={onCreateNewAgent}
        editTask={editingTask}
        initialValues={modalInitialValues}
        draft={modalDraft}
        onDraftChange={setModalDraft}
      />

      {/* Shell Drawer - for shell/watch tasks */}
      <KanbanShellDrawer
        task={selectedShellTaskId ? tasks.find(t => t.id === selectedShellTaskId) || null : null}
        isOpen={isShellDrawerOpen}
        onClose={handleShellDrawerClose}
        output={selectedShellTaskId ? getTaskOutput(selectedShellTaskId) : ''}
        isRunning={selectedShellTaskId ? isTaskRunning(selectedShellTaskId) : false}
        onKill={() => selectedShellTaskId && handleShellKill(selectedShellTaskId)}
        onStart={() => selectedShellTaskId && handleShellStart(selectedShellTaskId)}
        onClearOutput={() => selectedShellTaskId && handleShellClearOutput(selectedShellTaskId)}
      />
    </div>
  );
}
