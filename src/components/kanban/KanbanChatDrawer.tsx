/**
 * KanbanChatDrawer Component
 *
 * A drawer that displays the ChatView for a selected Kanban task.
 * Uses the chat system from App.tsx (Tauri backend) instead of direct SDK calls.
 *
 * - New task in_progress → Auto-send initial prompt
 * - Existing session → Resume conversation
 * - Done tasks → View history (read-only mode possible)
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import ChatView from '../ChatView';
import type { KanbanTask, ChatMessage } from '../../types';
import type { ChatSendOptions, ThinkingMode, PermissionMode } from '../../hooks/useClaudeChat';
import type { EffortLevel } from '../../types';
import { getCustomAvatarUrl, isCustomAvatar } from '../../utils/customAvatarStorage';

interface KanbanChatDrawerProps {
  task: KanbanTask | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate: (id: string, updates: Partial<KanbanTask>) => Promise<void>;
  // Chat integration from App.tsx
  chatSessions: Map<string, ChatMessage[]>;
  chatLoadingMap: Map<string, boolean>;
  onSendMessage: (agentId: string, content: string, options?: ChatSendOptions) => Promise<void>;
  onAbortStream: (agentId: string) => void;
  onClearConversation: (agentId: string) => void;
  getLastPrompt: (agentId: string) => string | null;
  sessionTokensMap: Map<string, { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; totalCost: number }>;
  // Default settings from global settings
  defaultModel?: 'opus' | 'sonnet' | 'haiku';
  defaultThinkingMode?: ThinkingMode;
  defaultPermissionMode?: PermissionMode;
  defaultEffort?: EffortLevel;
  // Diff drawer handler (passed to ChatView)
  onDiffClick?: (filePath: string, status: 'created' | 'modified' | 'deleted') => void;
  // Open session in terminal handler (for claude --resume)
  onOpenSessionInTerminal?: (taskId: string) => void;
}

// Helper function to get avatar image URL
function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset');
  }
  return `/images/ducks/new-avatars/${avatarName}`;
}

export default function KanbanChatDrawer({
  task,
  isOpen,
  onClose,
  onTaskUpdate,
  chatSessions,
  chatLoadingMap,
  onSendMessage,
  onAbortStream,
  onClearConversation,
  getLastPrompt,
  sessionTokensMap,
  defaultModel = 'sonnet',
  defaultThinkingMode = 'auto',
  defaultPermissionMode = 'bypass',
  defaultEffort = 'medium',
  onDiffClick,
  onOpenSessionInTerminal,
}: KanbanChatDrawerProps) {
  // Avatar URL state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Track last initialized task to avoid resetting draft unnecessarily
  const lastInitializedTaskIdRef = useRef<string | null>(null);

  // Chat settings state - initialized from task settings, falling back to global defaults
  const [inputDraft, setInputDraft] = useState('');
  const [model, setModel] = useState<'opus' | 'sonnet' | 'haiku'>(
    task?.chatModel || defaultModel
  );
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(
    task?.chatThinkingMode || defaultThinkingMode
  );
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    task?.chatPermissionMode || defaultPermissionMode
  );
  const [effort, setEffort] = useState<EffortLevel>(
    task?.chatEffort || defaultEffort
  );

  // Get working directory from task
  const workingDirectory = task?.projectPath || '/';

  // Use task.id as the agentId for chat sessions
  // This allows each Kanban task to have its own chat session
  const agentId = task?.id || '';

  // Get messages and loading state for this task
  const messages = chatSessions.get(agentId) || [];
  const isLoading = chatLoadingMap.get(agentId) || false;
  const sessionTokens = sessionTokensMap.get(agentId) || {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalCost: 0,
  };

  // Load avatar URL
  useEffect(() => {
    async function loadAvatar() {
      const avatar = task?.assignedAgent?.avatar;
      if (!avatar) {
        setAvatarUrl(getAvatarUrl('duck15.jpeg'));
        return;
      }

      if (isCustomAvatar(avatar)) {
        try {
          const url = await getCustomAvatarUrl(avatar);
          setAvatarUrl(url);
        } catch (err) {
          console.error('Failed to load custom avatar:', err);
          setAvatarUrl(getAvatarUrl('duck15.jpeg'));
        }
      } else {
        setAvatarUrl(getAvatarUrl(avatar));
      }
    }

    loadAvatar();
  }, [task?.assignedAgent?.avatar]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 🦆 Initialize input draft ONLY when task actually changes (not on every re-render)
  // Uses ref to track if we've already initialized for this task
  useEffect(() => {
    const currentTaskId = task?.id || null;

    // Only initialize draft if task actually changed
    if (currentTaskId !== lastInitializedTaskIdRef.current) {
      lastInitializedTaskIdRef.current = currentTaskId;

      if (task) {
        // Pre-populate with task prompt only if chat is empty
        if (messages.length === 0 && task.prompt) {
          setInputDraft(task.prompt);
        } else {
          // Clear draft when switching to a task with existing messages
          setInputDraft('');
        }
      } else {
        setInputDraft('');
      }
    }
  }, [task?.id, task?.prompt, messages.length]);

  // Load chat settings from task (separate from draft init to avoid conflicts)
  useEffect(() => {
    if (task) {
      setModel(task.chatModel || defaultModel);
      setThinkingMode(task.chatThinkingMode || defaultThinkingMode);
      setPermissionMode(task.chatPermissionMode || defaultPermissionMode);
      setEffort(task.chatEffort || defaultEffort);
    }
  }, [task?.id, task?.chatModel, task?.chatThinkingMode, task?.chatPermissionMode, task?.chatEffort, defaultModel, defaultThinkingMode, defaultPermissionMode, defaultEffort]);

  // Save chat settings to task when they change
  const handleModelChange = useCallback((newModel: 'opus' | 'sonnet' | 'haiku') => {
    setModel(newModel);
    if (task) {
      onTaskUpdate(task.id, { chatModel: newModel });
    }
  }, [task, onTaskUpdate]);

  const handleThinkingModeChange = useCallback((newMode: ThinkingMode) => {
    setThinkingMode(newMode);
    if (task) {
      onTaskUpdate(task.id, { chatThinkingMode: newMode });
    }
  }, [task, onTaskUpdate]);

  const handlePermissionModeChange = useCallback((newMode: PermissionMode) => {
    setPermissionMode(newMode);
    if (task) {
      onTaskUpdate(task.id, { chatPermissionMode: newMode });
    }
  }, [task, onTaskUpdate]);

  const handleEffortChange = useCallback((newEffort: EffortLevel) => {
    setEffort(newEffort);
    if (task) {
      onTaskUpdate(task.id, { chatEffort: newEffort });
    }
  }, [task, onTaskUpdate]);

  // Handle sending messages - auto-change to in_progress on first send
  const handleSendMessage = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!agentId || !task) return;

    // 🦆 Auto-change status to in_progress on first message (if currently todo)
    if (task.status === 'todo' && messages.length === 0) {
      console.log('[KanbanChatDrawer] First message sent, changing status to in_progress');
      await onTaskUpdate(task.id, { status: 'in_progress' });
    }

    await onSendMessage(agentId, content, {
      ...options,
      workingDirectory,
      model: options?.model || model,
      thinkingMode: options?.thinkingMode || thinkingMode,
      permissionMode: options?.permissionMode || permissionMode,
      effort: options?.effort || effort,
    });
  }, [agentId, task, messages.length, onTaskUpdate, onSendMessage, workingDirectory, model, thinkingMode, permissionMode, effort]);

  // Handle abort stream
  const handleAbortStream = useCallback(() => {
    if (agentId) {
      onAbortStream(agentId);
    }
  }, [agentId, onAbortStream]);

  // Handle clear conversation
  const handleClearConversation = useCallback(() => {
    if (confirm('Are you sure you want to clear this conversation? This cannot be undone.')) {
      if (agentId) {
        onClearConversation(agentId);
      }
      if (task) {
        onTaskUpdate(task.id, {
          sessionId: undefined,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        });
      }
    }
  }, [agentId, onClearConversation, task, onTaskUpdate]);

  // Get last prompt for this task
  const lastPrompt = agentId ? getLastPrompt(agentId) : null;

  // Get accent color from task
  const accentColor = task?.assignedAgent?.color || '#f28c52';

  // Handler to open session in terminal (wraps taskId for ChatView)
  const handleOpenSessionInTerminal = useCallback(() => {
    if (task?.id && onOpenSessionInTerminal) {
      onOpenSessionInTerminal(task.id);
    }
  }, [task?.id, onOpenSessionInTerminal]);

  // Use portal to ensure drawer is always positioned relative to viewport
  // This fixes issues with parent transforms affecting position: fixed
  const drawerContent = (
    <div className={`kanban-drawer ${isOpen ? 'open' : ''}`}>
      {/* Backdrop */}
      <div className="kanban-drawer-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="kanban-drawer-panel">
        {/* Header */}
        <div className="kanban-drawer-header">
          <div className="kanban-drawer-header-info">
            {task?.assignedAgent && (
              <div className="kanban-drawer-agent">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={task.assignedAgent.name}
                    className="kanban-drawer-avatar"
                  />
                ) : (
                  <div
                    className="kanban-drawer-avatar"
                    style={{
                      background: accentColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '12px',
                    }}
                  >
                    {task.assignedAgent.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="kanban-drawer-agent-name">
                  {task.assignedAgent.name}
                </span>
              </div>
            )}
            {task && (
              <span className="kanban-drawer-title" title={task.title}>
                {task.title}
              </span>
            )}
            {/* Session ID - clickable to copy */}
            {task?.sessionId && (
              <button
                type="button"
                className="kanban-drawer-session-id"
                onClick={() => {
                  navigator.clipboard.writeText(task.sessionId!);
                }}
                title="Click to copy session ID"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Session: {task.sessionId}</span>
              </button>
            )}
          </div>
          <button className="kanban-drawer-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="kanban-drawer-content">
          {task ? (
            <ChatView
              key={task.id} // 🦆 Force remount on task change to reset internal state (attachments, etc.)
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              basePath={workingDirectory}
              // Chat settings
              inputDraft={inputDraft}
              onInputDraftChange={setInputDraft}
              model={model}
              onModelChange={handleModelChange}
              thinkingMode={thinkingMode}
              onThinkingModeChange={handleThinkingModeChange}
              permissionMode={permissionMode}
              onPermissionModeChange={handlePermissionModeChange}
              effort={effort}
              onEffortChange={handleEffortChange}
              // Streaming control
              onAbortStream={handleAbortStream}
              lastPrompt={lastPrompt ?? undefined}
              // Conversation management
              onClearConversation={handleClearConversation}
              // Token usage
              sessionTokens={{
                inputTokens: sessionTokens.inputTokens,
                outputTokens: sessionTokens.outputTokens,
                cacheCreationTokens: sessionTokens.cacheCreationTokens,
                cacheReadTokens: sessionTokens.cacheReadTokens,
                totalCost: task.totalCost ?? sessionTokens.totalCost ?? 0,
              }}
              // Agent display
              agentName={task.assignedAgent?.name || 'Kanban Task'}
              agentAvatar={task.assignedAgent?.avatar}
              projectName={task.projectName}
              // Initial attachments - only show if chat is empty (not yet sent)
              initialAttachments={messages.length === 0 ? task.attachments : undefined}
              // Diff drawer handler
              onDiffClick={onDiffClick}
              // Open session in terminal
              onOpenSessionInTerminal={task?.sessionId ? handleOpenSessionInTerminal : undefined}
            />
          ) : (
            <div className="kanban-drawer-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <p>Select a task to view its conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render drawer in portal to ensure it's always at viewport right edge
  return createPortal(drawerContent, document.body);
}
