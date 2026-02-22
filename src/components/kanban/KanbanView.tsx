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
import { useKanbanStore } from '../../stores/kanbanStore';
import { useChatStore } from '../../stores/chatStore';
import type { KanbanTask, KanbanStatus, TerminalInfo, KanbanAssignedAgent, ChatMessage, ChatAttachment, EffortLevel } from '../../types';
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
  defaultModel?: string;
  defaultThinkingMode?: 'auto' | 'think' | 'hard' | 'harder' | 'ultra';
  defaultPermissionMode?: 'plan' | 'bypass';
  defaultEffort?: EffortLevel;
  // 🦆 Load saved chat sessions from sessionIds
  onLoadChatSessions?: () => Promise<void>;
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
  // Open task in new tab (legacy)
  onOpenTaskTab?: (task: KanbanTask) => void;
  // 🦆 SESSIONS-FIRST: Open session directly (preferred)
  onSessionClick?: (sessionId: string) => void;
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
  onDiffClick,
  onOpenSessionInTerminal,
  onToggleSidePanel,
  sidePanelExpanded = false,
  onToggleMiniPanel,
  showMiniPanel = false,
  onOpenTaskTab,
  onSessionClick,
  onOpenTerminal,
}: KanbanViewProps) {
  // 🦆 SESSIONS-FIRST: Use getters instead of direct tasks array
  const {
    getTasksByStatus, // NEW: getter that reads from sessionStore
    isLoading,
    loadTasks,
    addTask,
    moveTask,
    deleteTask,
    updateTask,
    isNewTaskModalRequested,
    clearNewTaskModalRequest,
    pendingTaskInitialValues,
    clearPendingTaskInitialValues,
    agentDropRequest,
    clearAgentDropRequest,
    updateAgentInfo, // NEW: to update agent rendering info
    // Pagination for Done column
    getVisibleDoneTasks,
    hasMoreDoneTasks,
    loadMoreDone,
    isLoadingMoreDone,
    // Manual Human Review tracking
    addToHumanReview,
    removeFromHumanReview,
    isManualHumanReview,
  } = useKanbanStore();

  // 🦆 SESSIONS-FIRST: Sync agentInfoMap with terminals for proper avatar/color display
  useEffect(() => {
    terminals.forEach((terminal) => {
      updateAgentInfo(terminal.id, {
        name: terminal.label,
        avatar: terminal.avatar,
        color: terminal.color,
      });
    });
  }, [terminals, updateAgentInfo]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  // Initial values for modal when agent is dragged from sidebar
  const [modalInitialValues, setModalInitialValues] = useState<KanbanTaskInitialValues | null>(null);
  // Draft state - persists when modal is closed accidentally
  const [modalDraft, setModalDraft] = useState<KanbanTaskDraft | null>(null);
  // Shell drawer state (separate from chat drawer)
  // Reopen done task confirmation dialog
  const [reopenTaskDialog, setReopenTaskDialog] = useState<KanbanTask | null>(null);


  // Custom collision detection that prioritizes columns over cards
  // This makes dropping on columns much easier
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // First, check if we're over a column using pointerWithin (more forgiving)
    const pointerCollisions = pointerWithin(args);

    // Find column collisions (prioritize these)
    const columnIds = ['todo', 'in_progress', 'human_review', 'done'];
    const columnCollisions = pointerCollisions.filter(
      collision => columnIds.includes(collision.id as string)
    );

    // If we're over a column, return that
    if (columnCollisions.length > 0) {
      return columnCollisions;
    }

    // Fallback to rectIntersection for better detection
    const rectCollisions = rectIntersection(args);
    const columnRectCollisions = rectCollisions.filter(
      collision => columnIds.includes(collision.id as string)
    );

    if (columnRectCollisions.length > 0) {
      return columnRectCollisions;
    }

    // Last resort: any collision
    return rectCollisions;
  }, []);

  // 🦆 SESSIONS-FIRST: Get tasks from sessionStore via getters
  const todoTasks = getTasksByStatus('todo');
  const allInProgressTasks = getTasksByStatus('in_progress');

  // 🦆 Split in_progress: tasks with pending questions OR manually placed → Human Review column
  const hasPendingQuestion = useChatStore((s) => s.hasPendingQuestion);
  const humanReviewTasks = allInProgressTasks.filter(task =>
    hasPendingQuestion(task.id) || isManualHumanReview(task.id)
  );
  const inProgressTasks = allInProgressTasks.filter(task =>
    !hasPendingQuestion(task.id) && !isManualHumanReview(task.id)
  );

  // Create a combined array for find operations (used in drag handlers and drawer)
  const visibleDoneTasks = getVisibleDoneTasks();
  const allTasks = [...todoTasks, ...inProgressTasks, ...humanReviewTasks, ...visibleDoneTasks];
  // 🦆 SESSIONS-FIRST: Get total done count from getter
  const allDoneTasks = getTasksByStatus('done');
  const totalDoneTasks = allDoneTasks.length;
  const hasMoreDone = hasMoreDoneTasks();

  // Load tasks on mount
  // Note: Chat sessions are now loaded at app startup (App.tsx), not here
  // This prevents formatting loss when navigating to/from Kanban view
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);


  // Handle keyboard shortcut or context menu request to open new task modal
  useEffect(() => {
    if (isNewTaskModalRequested) {
      // If there are pending initial values (from context menu), use them
      if (pendingTaskInitialValues) {
        setModalInitialValues(pendingTaskInitialValues);
        setModalDraft(null); // Clear draft when opening with initial values
        clearPendingTaskInitialValues();
      }
      setIsModalOpen(true);
      clearNewTaskModalRequest();
    }
  }, [isNewTaskModalRequested, clearNewTaskModalRequest, pendingTaskInitialValues, clearPendingTaskInitialValues]);

  // Auto-start shell tasks that are in_progress but not yet running


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
    const task = allTasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  // Handle drag over - track which column we're hovering
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && ['todo', 'in_progress', 'human_review', 'done'].includes(over.id as string)) {
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
    const validColumns = ['todo', 'in_progress', 'human_review', 'done'];
    if (validColumns.includes(overId)) {
      // human_review is a virtual column — underlying status is 'in_progress'
      const newStatus: KanbanStatus = overId === 'human_review' ? 'in_progress' : overId as KanbanStatus;
      const task = allTasks.find((t) => t.id === taskId);

      if (task) {
        // 🦆 Block moving to TODO if task has chat messages (conversation started)
        if (newStatus === 'todo') {
          const taskMessages = chatSessions.get(taskId) || [];
          if (taskMessages.length > 0) {
            toast.warning('This task has an active conversation and cannot be moved back to TODO. Move it to Done instead, or clear the conversation first.');
            return;
          }
        }

        // Track manual Human Review placement
        if (overId === 'human_review') {
          addToHumanReview(taskId);
        } else {
          // Moving OUT of human_review → clear manual flag
          removeFromHumanReview(taskId);
        }

        // Only call moveTask if actual status changes
        if (task.status !== newStatus) {
          moveTask(taskId, newStatus);

          // If moved to in_progress, open task in new tab
          if (newStatus === 'in_progress' && onOpenTaskTab) {
            onOpenTaskTab(task);
          }
        }
      }
    }
  };

  // Handle card click
  const handleTaskClick = useCallback((task: KanbanTask) => {
    // 🦆 Done tasks require confirmation to reopen
    if (task.status === 'done') {
      setReopenTaskDialog(task);
      return;
    }

    // 🦆 SESSIONS-FIRST: Open session directly (task.id = session.id)
    if (onSessionClick) {
      onSessionClick(task.id);
    } else if (onOpenTaskTab) {
      // Legacy fallback
      onOpenTaskTab(task);
    }
    // Close Kanban and return to chat view
    if (onExitKanban) {
      onExitKanban();
    }
  }, [onSessionClick, onOpenTaskTab, onExitKanban]);

  // Handle reopen done task - move to in_progress and open
  const handleReopenTask = useCallback(async () => {
    if (!reopenTaskDialog) return;
    
    // Move task to in_progress
    await moveTask(reopenTaskDialog.id, 'in_progress');
    
    // Open the session
    if (onSessionClick) {
      onSessionClick(reopenTaskDialog.id);
    } else if (onOpenTaskTab) {
      onOpenTaskTab(reopenTaskDialog);
    }
    
    // Close dialog and exit kanban
    setReopenTaskDialog(null);
    if (onExitKanban) {
      onExitKanban();
    }
  }, [reopenTaskDialog, moveTask, onSessionClick, onOpenTaskTab, onExitKanban]);

  // Handle Start button click - move to in_progress, open chat, send prompt
  const handleStartTask = useCallback(async (task: KanbanTask) => {
    // 1. Move task to in_progress
    await moveTask(task.id, 'in_progress');

    // 2. 🦆 SESSIONS-FIRST: Open session directly
    if (onSessionClick) {
      onSessionClick(task.id);
    } else if (onOpenTaskTab) {
      onOpenTaskTab(task);
    }

    // 3. Send the initial prompt after a short delay to ensure tab is open
    if (task.prompt) {
      setTimeout(() => {
        onSendMessage(task.id, task.prompt);
      }, 100);
    }
  }, [moveTask, onSessionClick, onOpenTaskTab, onSendMessage]);

  // Handle task deletion with async Tauri dialog
  const handleTaskDelete = useCallback(async (taskId: string) => {
    const confirmed = await confirm('Are you sure you want to delete this task?', {
      title: 'Delete Task',
      kind: 'warning',
    });

    if (confirmed) {
      deleteTask(taskId);
    }
  }, [deleteTask]);

  // Handle clearing all done tasks (uses ALL done tasks, not just visible ones)
  // 🦆 SESSIONS-FIRST: Use getter for all done tasks
  const handleClearDone = useCallback(async () => {
    const doneTasks = getTasksByStatus('done');
    const doneCount = doneTasks.length;
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
      for (const task of doneTasks) {
        deleteTask(task.id);
      }
      toast.success(`Cleared ${doneCount} completed task${doneCount > 1 ? 's' : ''}`);
    }
  }, [getTasksByStatus, deleteTask]);

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

  // Handle agent drop from sidebar cross-boundary drag (dnd-kit boundary detection)
  useEffect(() => {
    if (agentDropRequest) {
      handleSidebarAgentDrop(agentDropRequest.agentId, 'todo');
      clearAgentDropRequest();
    }
  }, [agentDropRequest, clearAgentDropRequest, handleSidebarAgentDrop]);

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
      {/* Header - draggable region */}
      <div className="kanban-header" data-tauri-drag-region>
        <h1 className="kanban-title" data-tauri-drag-region>Kanban Board</h1>
        <div style={{ flex: 1 }} data-tauri-drag-region />
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

            onTaskStart={handleStartTask}
                        onOpenTerminal={onOpenTerminal}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
            pendingQuestionsChecker={hasPendingQuestion}

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

                        onOpenTerminal={onOpenTerminal}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
            pendingQuestionsChecker={hasPendingQuestion}

            isDropTarget={overColumnId === 'in_progress'}
            onSidebarAgentDrop={handleSidebarAgentDrop}
          />

          <KanbanColumn
            id={'human_review' as KanbanStatus}
            title="Human Review"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            tasks={humanReviewTasks}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={handleTaskEdit}

                        onOpenTerminal={onOpenTerminal}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
            pendingQuestionsChecker={hasPendingQuestion}

            isDropTarget={overColumnId === 'human_review'}
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

                        onOpenTerminal={onOpenTerminal}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
            pendingQuestionsChecker={hasPendingQuestion}

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


      {/* Reopen Done Task Confirmation Dialog */}
      {reopenTaskDialog && (
        <div
          className="kanban-reopen-dialog-overlay"
          onClick={() => setReopenTaskDialog(null)}
        >
          <div
            className="kanban-reopen-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="kanban-reopen-dialog-title">Reopen Task?</h3>
            <p className="kanban-reopen-dialog-message">
              This task is marked as done. Would you like to move it back to In Progress and open it?
            </p>
            <div className="kanban-reopen-dialog-actions">
              <button
                className="kanban-reopen-dialog-cancel"
                onClick={() => setReopenTaskDialog(null)}
              >
                Cancel
              </button>
              <button
                className="kanban-reopen-dialog-confirm"
                onClick={handleReopenTask}
              >
                Move to In Progress
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
