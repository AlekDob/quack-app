/**
 * SessionEmptyState Component
 *
 * Displays when an agent is selected but no session is active.
 * Shows the agent's active sessions and a button to create a new one.
 *
 * Following Quack Design System:
 * - Minimal modern design
 * - Orange accent (var(--accent-color))
 * - SVG icons (no emoji)
 * - General Sans typography
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import type { AgentSession, TerminalInfo } from '../types';
import type { AgentBackendKind } from '../types/agentBackend';
import { formatRelativeTime } from '../utils/timeFormat';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import NewSessionModal from './NewSessionModal';

function getAvatarUrl(avatarPath: string): string {
  if (!avatarPath) return '';
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://') || avatarPath.startsWith('data:')) {
    return avatarPath;
  }
  const avatarName = avatarPath.startsWith('/') ? avatarPath.slice(1) : avatarPath;
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset');
  }
  return `/images/ducks/new-avatars/${avatarName}`;
}

interface SessionEmptyStateProps {
  agent: TerminalInfo;
  onSessionClick: (sessionId: string) => void;
  onOpenPersonality?: () => void;
}

export default function SessionEmptyState({
  agent,
  onSessionClick,
  onOpenPersonality,
}: SessionEmptyStateProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Load avatar URL with proper Tauri handling
  useEffect(() => {
    async function loadAvatarUrl() {
      if (!agent.avatar) {
        // Default duck avatar
        if (window.__TAURI__) {
          setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset'));
        } else {
          setAvatarUrl('/images/ducks/new-avatars/duck15.jpeg');
        }
        return;
      }

      // Check if custom avatar
      if (isCustomAvatar(agent.avatar)) {
        const url = await getCustomAvatarUrl(agent.avatar);
        setAvatarUrl(url);
      } else {
        setAvatarUrl(getAvatarUrl(agent.avatar));
      }
    }
    loadAvatarUrl();
  }, [agent.avatar]);

  // Get sessions and createSession from store
  const { sessions: allSessions, createSession } = useSessionStore();
  const chatSessions = useChatStore((state) => state.chatSessions);
  const chatLoadingMap = useChatStore((state) => state.chatLoadingMap);

  // Filter sessions for this agent (non-done only)
  const agentSessions = useMemo(() => {
    return allSessions
      .filter((s) => s.agentId === agent.id && s.status !== 'done')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allSessions, agent.id]);

  // Handle new session creation
  const handleNewSession = useCallback(async (title: string, branch?: string, useWorktree?: boolean, backend?: AgentBackendKind) => {
    try {
      let worktreePath: string | undefined;

      // 🦆 BRANCH-PER-SESSION: Handle branch operations
      if (branch) {
        // Check if branch already exists
        let branchExists = false;
        try {
          const branches = await invoke<Array<{ name: string }>>('git_list_branches', {
            rootPath: agent.cwd,
          });
          branchExists = branches.some((b) => b.name === branch);
        } catch {
          // If we can't list branches, assume it doesn't exist
        }

        if (useWorktree) {
          // Check if a worktree already exists for this branch
          let existingWorktree: string | undefined;
          try {
            const worktrees = await invoke<Array<{ path: string; branch: string }>>('git_list_worktrees', {
              rootPath: agent.cwd,
            });
            const match = worktrees.find((w) => w.branch === branch);
            if (match) existingWorktree = match.path;
          } catch {
            // If listing fails, proceed with creation
          }

          if (existingWorktree) {
            // Reuse existing worktree
            worktreePath = existingWorktree;
            console.log(`[SessionEmptyState] Reusing existing worktree at ${worktreePath} for branch ${branch}`);
          } else {
            // Create new worktree (+ branch if new)
            const shortId = Date.now().toString(36);
            const safeBranch = branch.replace(/[^a-zA-Z0-9-_]/g, '-');
            worktreePath = `${agent.cwd}/.worktrees/session-${safeBranch}-${shortId}`;

            await invoke('git_add_worktree', {
              path: worktreePath,
              branchName: branch,
              createBranch: !branchExists,
              rootPath: agent.cwd,
            });

            console.log(`[SessionEmptyState] Worktree created at ${worktreePath} for branch ${branch}`);
          }
        } else if (!branchExists) {
          // Create new branch without worktree (switch to it in main repo)
          await invoke('git_create_branch', {
            branchName: branch,
            fromBranch: null,
            switch: true,
            rootPath: agent.cwd,
          });
          console.log(`[SessionEmptyState] Created and switched to new branch ${branch}`);
        } else {
          // Existing branch, no worktree — switch to it
          await invoke('git_switch_branch', {
            branchName: branch,
            rootPath: agent.cwd,
          });
          console.log(`[SessionEmptyState] Switched to existing branch ${branch}`);
        }
      }

      const newSession = await createSession({
        title,
        agentId: agent.id,
        projectPath: agent.cwd,
        projectName: agent.cwd.split('/').pop() || 'project',
        status: 'todo',
        messageCount: 0,
        branch,
        useWorktree,
        worktreePath,
        backend: backend ?? 'claude',
      });

      setIsModalOpen(false);
      onSessionClick(newSession.id);
    } catch (error) {
      console.error('[SessionEmptyState] Failed to create session:', error);
    }
  }, [createSession, agent.id, agent.cwd, onSessionClick]);

  // Get status indicator for session
  const getSessionStatus = (session: AgentSession): 'loading' | 'active' | 'idle' => {
    const isLoading = chatLoadingMap.get(session.id) ?? false;
    if (isLoading) return 'loading';

    const messages = chatSessions.get(session.id);
    const hasMessages = messages && messages.length > 0;
    return hasMessages ? 'active' : 'idle';
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      {/* Agent Avatar */}
      <div
        onClick={() => {
          console.log('[SessionEmptyState] Avatar clicked, onOpenPersonality:', !!onOpenPersonality);
          onOpenPersonality?.();
        }}
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '16px',
          border: `3px solid ${agent.color || '#00D4FF'}40`,
          background: `linear-gradient(135deg, ${agent.color || '#00D4FF'}15, ${agent.color || '#00D4FF'}05)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: onOpenPersonality ? 'pointer' : 'default',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (onOpenPersonality) {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = `0 8px 24px ${agent.color || '#00D4FF'}30`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={agent.label}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              // Fallback to default duck avatar on error
              const target = e.target as HTMLImageElement;
              if (window.__TAURI__) {
                target.src = convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset');
              } else {
                target.src = '/images/ducks/new-avatars/duck15.jpeg';
              }
            }}
          />
        ) : (
          <span
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: agent.color || '#00D4FF',
            }}
          >
            {agent.label.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Agent Name */}
      <div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '4px',
          }}
        >
          {agent.label}
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          {agent.workingOn || agent.personality?.role || 'Ready to help'}
        </div>
      </div>

      {/* Sessions List or Empty State */}
      {agentSessions.length > 0 ? (
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Section Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Active Sessions
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.3)',
              }}
            >
              {agentSessions.length} session{agentSessions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Session Cards */}
          {agentSessions.slice(0, 5).map((session) => {
            const status = getSessionStatus(session);
            const relativeTime = formatRelativeTime(session.updatedAt);

            return (
              <button
                key={session.id}
                onClick={() => onSessionClick(session.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor = `${agent.color || '#00D4FF'}40`;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Status Dot */}
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background:
                      status === 'loading'
                        ? 'var(--accent-color)'
                        : status === 'active'
                        ? '#22c55e'
                        : 'rgba(255, 255, 255, 0.3)',
                    animation: status === 'loading' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }}
                />

                {/* Session Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'rgba(255, 255, 255, 0.9)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {session.title}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginTop: '2px',
                    }}
                  >
                    {relativeTime}
                  </div>
                </div>

                {/* Arrow Icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'rgba(255, 255, 255, 0.3)', flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            );
          })}

          {/* Show more indicator */}
          {agentSessions.length > 5 && (
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.4)',
                textAlign: 'center',
                padding: '4px',
              }}
            >
              +{agentSessions.length - 5} more in sidebar
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '13px',
            maxWidth: '280px',
          }}
        >
          No active sessions yet. Create one to start chatting with this agent.
        </div>
      )}

      {/* New Session Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px 24px',
          background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-gradient-end) 100%)',
          border: 'none',
          borderRadius: '10px',
          color: 'white',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-gradient-end) 100%)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(var(--accent-rgb), 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-gradient-end) 100%)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--accent-rgb), 0.3)';
        }}
      >
        {/* Plus Icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Session
      </button>

      {/* Modal */}
      <NewSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleNewSession}
        agentName={agent.label}
        projectPath={agent.cwd}
        defaultBranch={agent.branch}
      />

      {/* Pulse animation for loading status */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}
      </style>
    </div>
  );
}
