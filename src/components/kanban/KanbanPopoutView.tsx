/**
 * KanbanPopoutView Component
 *
 * @deprecated This component is deprecated in favor of KanbanMiniPanel which shows
 * a compact Kanban view in the sidebar. The popout window approach has been replaced
 * with the "Kanban Tab + Mini Panel in Sidebar" pattern for better UX and performance.
 *
 * This component is kept for backward compatibility with existing popout windows
 * but should not be used for new features. Use KanbanMiniPanel + KanbanTabView instead.
 *
 * Legacy description:
 * Standalone Kanban board for popout windows.
 * Includes full chat drawer functionality with standalone chat system.
 * Uses usePopoutKanbanChat hook for chat operations (send, abort, clear).
 * Uses useKanbanChatSync hook for synced state from main window (Working/Ready status).
 */

import { useState, useEffect, useCallback } from 'react';
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
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import KanbanColumn from './KanbanColumn';
import { KanbanCardOverlay } from './KanbanCard';
import { useKanbanStore } from '../../stores/kanbanStore';
import { usePopoutKanbanChat } from '../../hooks/usePopoutKanbanChat';
import { useKanbanChatSync } from '../../hooks/useKanbanChatSync';
import { useKanbanPolling } from '../../hooks/useKanbanPolling';
import type { KanbanTask, KanbanStatus } from '../../types';
import { toast } from 'sonner';
import './KanbanView.css';

export default function KanbanPopoutView() {
  const {
    getAllTasks,
    isLoading,
    loadTasks,
    moveTask,
    deleteTask,
    updateTask,
    selectedTaskId,
    isDrawerOpen,
    selectTask,
    openDrawer,
    closeDrawer,
  } = useKanbanStore();
  const tasks = getAllTasks();

  // 🦆 SYNC: Get synced loading state from main window (for Working/Ready status on cards)
  // Also listen for task changes to reload the board
  // LIGHTWEIGHT: Only syncs loading status, not full chat sessions
  const { chatLoadingMap: syncedLoadingMap } = useKanbanChatSync({
    onTasksChanged: useCallback((changeType: string, _taskId?: string) => {
      // Silent reload to avoid showing loading indicator
      loadTasks({ silent: true });
    }, [loadTasks]),
  });

  // Standalone chat system for popout (for chat drawer operations)
  const {
    chatSessions,
    chatLoadingMap: localLoadingMap,
    sessionTokensMap,
    loadChatSession,
    sendMessage,
    abortStream,
    clearConversation,
    compactConversation,
    getLastPrompt,
  } = usePopoutKanbanChat();

  // Use synced loading state for cards (from main window), local for fallback
  const chatLoadingMap = syncedLoadingMap.size > 0 ? syncedLoadingMap : localLoadingMap;

  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Get selected task object
  const selectedTask = selectedTaskId ? tasks.find((t: KanbanTask) => t.id === selectedTaskId) : null;

  // Filter tasks by status
  const todoTasks = tasks.filter((t: KanbanTask) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t: KanbanTask) => t.status === 'in_progress');
  const doneTasks = tasks.filter((t: KanbanTask) => t.status === 'done');

  // Load chat session when task is selected
  useEffect(() => {
    if (selectedTaskId && isDrawerOpen) {
      const task = tasks.find((t: KanbanTask) => t.id === selectedTaskId);
      loadChatSession(selectedTaskId, task?.sessionId);
    }
  }, [selectedTaskId, isDrawerOpen, tasks, loadChatSession]);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // 🦆 MCP SYNC: Poll for task changes from external sources (MCP server)
  useKanbanPolling({ enabled: true, interval: 5000 }); // 5 second interval for low overhead

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

  // Custom collision detection
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return rectIntersection(args);
  }, []);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t: KanbanTask) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  // Handle drag over
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

    if (['todo', 'in_progress', 'done'].includes(overId)) {
      const newStatus = overId as KanbanStatus;
      const task = tasks.find((t: KanbanTask) => t.id === taskId);

      if (task && task.status !== newStatus) {
        moveTask(taskId, newStatus);
        toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
      }
    }
  };

  // Handle task click - open drawer in popout window
  const handleTaskClick = useCallback((task: KanbanTask) => {
    selectTask(task.id);
    openDrawer();
  }, [selectTask, openDrawer]);

  // Handle drawer close
  const handleCloseDrawer = useCallback(() => {
    closeDrawer();
    selectTask(null);
  }, [closeDrawer, selectTask]);

  // Handle send message - wrapper for usePopoutKanbanChat
  const handleSendMessage = useCallback(async (agentId: string, content: string, options?: Parameters<typeof sendMessage>[2]) => {
    await sendMessage(agentId, content, options);
  }, [sendMessage]);

  // Handle abort stream
  const handleAbortStream = useCallback((agentId: string) => {
    abortStream(agentId);
  }, [abortStream]);

  // Handle clear conversation
  const handleClearConversation = useCallback((agentId: string) => {
    clearConversation(agentId);
  }, [clearConversation]);

  // Handle compact conversation
  const handleCompactConversation = useCallback((agentId: string) => {
    compactConversation(agentId);
  }, [compactConversation]);

  // Handle task update
  const handleTaskUpdate = useCallback(async (id: string, updates: Partial<KanbanTask>) => {
    await updateTask(id, updates);
  }, [updateTask]);

  // Handle task delete
  const handleTaskDelete = useCallback(async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteTask(taskId);
      toast.success('Task deleted');
    }
  }, [deleteTask]);

  // Handle return to tab bar
  const handleReturnToTab = useCallback(async () => {
    try {
      // Get tab data from URL params
      const params = new URLSearchParams(window.location.search);
      const tabDataParam = params.get('tabData');
      if (tabDataParam) {
        const tab = JSON.parse(decodeURIComponent(tabDataParam));
        await emit('tab-popout-dragback', { tab });
      }
      // Close this window
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (error) {
      console.error('[KanbanPopoutView] Failed to return to tab:', error);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="kanban-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>Loading tasks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="kanban-view">
      {/* Drag region for macOS traffic lights area */}
      <div
        data-tauri-drag-region
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '36px',
          zIndex: 10,
        }}
      />
      {/* Header - extra padding for macOS traffic lights in popout */}
      <div className="kanban-header" data-tauri-drag-region style={{ paddingTop: '36px' }}>
        <h1 className="kanban-title" data-tauri-drag-region>Kanban Board</h1>
        <div style={{ flex: 1 }} data-tauri-drag-region />
        <span style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '12px',
          padding: '4px 8px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '4px'
        }}>
          Popout Mode - Drag tasks to move
        </span>
        {/* Return to tab button */}
        <button
          type="button"
          onClick={handleReturnToTab}
          title="Return to tab bar"
          aria-label="Return to tab bar"
          style={{
            marginLeft: '12px',
            padding: '6px 8px',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3H10C11.1046 3 12 3.89543 12 5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 10L12 8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 3V12C3 12.5523 3.44772 13 4 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Return to Tab
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
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            isDropTarget={overColumnId === 'todo'}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
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
            isDropTarget={overColumnId === 'in_progress'}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
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
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            isDropTarget={overColumnId === 'done'}
            chatLoadingMap={chatLoadingMap}
            chatSessions={chatSessions}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <KanbanCardOverlay task={activeTask} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Chat Drawer - Removed, use tab-based chat system instead */}
    </div>
  );
}
