/**
 * KanbanChatDrawer Component
 *
 * A drawer that displays the ChatView for a selected Kanban task.
 * Handles session creation, resumption, and token tracking.
 *
 * - New task in_progress → Auto-send initial prompt
 * - Existing session → Resume conversation
 * - Done tasks → View history (read-only mode possible)
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import ChatView from '../ChatView';
import { useClaudeChat } from '../../hooks/useClaudeChat';
import type { KanbanTask } from '../../types';
import type { ChatSendOptions, ThinkingMode, PermissionMode } from '../../hooks/useClaudeChat';
import type { EffortLevel } from '../../types';
import { getCustomAvatarUrl, isCustomAvatar } from '../../utils/customAvatarStorage';

interface KanbanChatDrawerProps {
  task: KanbanTask | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate: (id: string, updates: Partial<KanbanTask>) => Promise<void>;
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
}: KanbanChatDrawerProps) {
  // Track if we've auto-sent the initial prompt for this task
  const hasAutoSentRef = useRef<string | null>(null);

  // Avatar URL state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Chat settings state
  const [inputDraft, setInputDraft] = useState('');
  const [model, setModel] = useState<'opus' | 'sonnet' | 'haiku'>('sonnet');
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('auto');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('bypass');
  const [effort, setEffort] = useState<EffortLevel>('medium');

  // Get working directory from task
  const workingDirectory = task?.projectPath || '/';

  // Initialize Claude chat hook with session resumption support
  const {
    messages,
    isLoading,
    sendMessage,
    clearConversation,
    getCurrentSessionId,
    sessionTokens,
    abortStream,
    getLastPrompt,
    loadHistoricalMessages,
  } = useClaudeChat({
    initialSessionId: task?.sessionId,
    initialTokens: task ? {
      inputTokens: task.inputTokens ?? 0,
      outputTokens: task.outputTokens ?? 0,
      cacheCreationTokens: task.cacheCreationTokens ?? 0,
      cacheReadTokens: task.cacheReadTokens ?? 0,
    } : undefined,
  });

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

  // Auto-send initial prompt when task moves to in_progress
  useEffect(() => {
    if (!task || !isOpen) return;

    // Only auto-send for in_progress tasks without a session
    if (
      task.status === 'in_progress' &&
      !task.sessionId &&
      hasAutoSentRef.current !== task.id
    ) {
      // Mark as sent to prevent duplicate sends
      hasAutoSentRef.current = task.id;

      console.log('[KanbanChatDrawer] Auto-sending initial prompt for task:', task.id);

      // Small delay to ensure UI is ready
      setTimeout(() => {
        sendMessage(task.prompt, {
          workingDirectory,
          model,
          thinkingMode,
          permissionMode,
          effort,
          onComplete: () => {
            // Capture session ID after first message
            const sessionId = getCurrentSessionId();
            if (sessionId && task.id) {
              console.log('[KanbanChatDrawer] Saving session ID:', sessionId);
              onTaskUpdate(task.id, { sessionId });
            }
          },
        });
      }, 100);
    }
  }, [task, isOpen, sendMessage, workingDirectory, model, thinkingMode, permissionMode, effort, getCurrentSessionId, onTaskUpdate]);

  // Update task tokens when they change
  useEffect(() => {
    if (!task || !isOpen) return;

    // Debounce token updates
    const timeout = setTimeout(() => {
      const currentSessionId = getCurrentSessionId();
      const hasTokenChanges =
        sessionTokens.inputTokens !== (task.inputTokens ?? 0) ||
        sessionTokens.outputTokens !== (task.outputTokens ?? 0);

      if (hasTokenChanges || (currentSessionId && !task.sessionId)) {
        onTaskUpdate(task.id, {
          sessionId: currentSessionId || task.sessionId,
          inputTokens: sessionTokens.inputTokens,
          outputTokens: sessionTokens.outputTokens,
          cacheCreationTokens: sessionTokens.cacheCreationTokens,
          cacheReadTokens: sessionTokens.cacheReadTokens,
        });
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [sessionTokens, task, isOpen, getCurrentSessionId, onTaskUpdate]);

  // Handle sending messages
  const handleSendMessage = useCallback(async (content: string, options?: ChatSendOptions) => {
    await sendMessage(content, {
      ...options,
      workingDirectory,
      model: options?.model || model,
      thinkingMode: options?.thinkingMode || thinkingMode,
      permissionMode: options?.permissionMode || permissionMode,
      effort: options?.effort || effort,
      onComplete: () => {
        // Update session ID if not already set
        const sessionId = getCurrentSessionId();
        if (sessionId && task && !task.sessionId) {
          onTaskUpdate(task.id, { sessionId });
        }
      },
    });
  }, [sendMessage, workingDirectory, model, thinkingMode, permissionMode, effort, getCurrentSessionId, task, onTaskUpdate]);

  // Handle clear conversation
  const handleClearConversation = useCallback(() => {
    if (confirm('Are you sure you want to clear this conversation? This cannot be undone.')) {
      clearConversation();
      if (task) {
        onTaskUpdate(task.id, {
          sessionId: undefined,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        });
      }
      hasAutoSentRef.current = null; // Allow re-send if needed
    }
  }, [clearConversation, task, onTaskUpdate]);

  // Get accent color from task
  const accentColor = task?.assignedAgent?.color || '#f28c52';

  return (
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
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              basePath={workingDirectory}
              // Chat settings
              inputDraft={inputDraft}
              onInputDraftChange={setInputDraft}
              model={model}
              onModelChange={setModel}
              thinkingMode={thinkingMode}
              onThinkingModeChange={setThinkingMode}
              permissionMode={permissionMode}
              onPermissionModeChange={setPermissionMode}
              effort={effort}
              onEffortChange={setEffort}
              // Streaming control
              onAbortStream={abortStream}
              lastPrompt={getLastPrompt()}
              // Conversation management
              onClearConversation={handleClearConversation}
              // Token usage
              sessionTokens={{
                inputTokens: sessionTokens.inputTokens,
                outputTokens: sessionTokens.outputTokens,
                cacheCreationTokens: sessionTokens.cacheCreationTokens,
                cacheReadTokens: sessionTokens.cacheReadTokens,
                totalCost: task.totalCost ?? 0,
              }}
              // Agent display
              agentName={task.assignedAgent?.name || 'Kanban Task'}
              agentAvatar={task.assignedAgent?.avatar}
              projectName={task.projectName}
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
}
