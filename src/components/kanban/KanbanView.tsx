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
import AddKanbanTaskModal, { type KanbanTaskInitialValues } from './AddKanbanTaskModal';
import KanbanChatDrawer from './KanbanChatDrawer';
import KanbanShellDrawer from './KanbanShellDrawer';
import { useKanbanStore } from '../../stores/kanbanStore';
import { useKanbanShellTask } from '../../hooks/useKanbanShellTask';
import type { KanbanTask, KanbanStatus, TerminalInfo, KanbanAssignedAgent, ChatMessage, ChatAttachment } from '../../types';
import type { ChatSendOptions } from '../../hooks/useClaudeChat';
import { toast } from 'sonner';
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
}

export default function KanbanView({
  terminals,
  onExitKanban,
  chatSessions,
  chatLoadingMap,
  onSendMessage,
  onAbortStream,
  onClearConversation,
  getLastPrompt,
  sessionTokensMap,
  onCreateNewAgent,
  defaultModel,
  defaultThinkingMode,
  defaultPermissionMode,
  defaultEffort,
  onLoadChatSessions,
  onProjectClick,
}: KanbanViewProps) {
  const {
    tasks,
    selectedTaskId,
    isDrawerOpen,
    isLoading,
    loadTasks,
    addTask,
    moveTask,
    deleteTask,
    selectTask,
    openDrawer,
    closeDrawer,
    getSelectedTask,
    updateTask,
  } = useKanbanStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  // Initial values for modal when agent is dragged from sidebar
  const [modalInitialValues, setModalInitialValues] = useState<KanbanTaskInitialValues | null>(null);
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
  const doneTasks = tasks.filter((t) => t.status === 'done');

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

        // If moved to in_progress, auto-select and open drawer
        if (newStatus === 'in_progress') {
          selectTask(taskId);
          openDrawer();
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
      // Close agent drawer if open
      closeDrawer();
    } else {
      // Open chat drawer for agent tasks
      selectTask(task.id);
      openDrawer();
      // Close shell drawer if open
      setIsShellDrawerOpen(false);
      setSelectedShellTaskId(null);
    }
  }, [selectTask, openDrawer, closeDrawer]);

  // Handle task deletion
  const handleTaskDelete = useCallback((taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
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

  // Handle task edit (open modal in edit mode)
  const handleTaskEdit = useCallback((task: KanbanTask) => {
    setEditingTask(task);
    setIsModalOpen(true);
  }, []);

  // Handle drawer close
  const handleDrawerClose = useCallback(() => {
    closeDrawer();
  }, [closeDrawer]);

  // Handle task creation or update
  const handleCreateOrUpdateTask = useCallback(async (
    title: string,
    prompt: string,
    projectPath: string,
    projectName: string,
    branch: string | undefined,
    agent: KanbanAssignedAgent | undefined,
    attachments: ChatAttachment[]
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
      });
    }
    setIsModalOpen(false);
    setEditingTask(null);
  }, [addTask, updateTask, editingTask]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingTask(null);
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

  // Get selected task for drawer
  const selectedTask = getSelectedTask();

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
            selectedTaskId={selectedTaskId}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={handleTaskEdit}
            onTaskKill={handleCardKill}
            onProjectClick={onProjectClick}
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
            selectedTaskId={selectedTaskId}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={handleTaskEdit}
            onTaskKill={handleCardKill}
            onProjectClick={onProjectClick}
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
            tasks={doneTasks}
            selectedTaskId={selectedTaskId}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={handleTaskEdit}
            onTaskKill={handleCardKill}
            onProjectClick={onProjectClick}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
            shellOutputs={shellOutputsForColumns}
            isDropTarget={overColumnId === 'done'}
            onSidebarAgentDrop={handleSidebarAgentDrop}
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
      />

      {/* Chat Drawer - for agent tasks */}
      <KanbanChatDrawer
        task={selectedTask}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        onTaskUpdate={updateTask}
        // Chat integration from App.tsx
        chatSessions={chatSessions}
        chatLoadingMap={chatLoadingMap}
        onSendMessage={onSendMessage}
        onAbortStream={onAbortStream}
        onClearConversation={onClearConversation}
        getLastPrompt={getLastPrompt}
        sessionTokensMap={sessionTokensMap}
        // Default settings from global settings
        defaultModel={defaultModel}
        defaultThinkingMode={defaultThinkingMode}
        defaultPermissionMode={defaultPermissionMode}
        defaultEffort={defaultEffort}
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
