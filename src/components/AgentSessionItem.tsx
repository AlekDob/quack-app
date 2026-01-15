import { memo, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { AgentSession, ChatMessage } from '../types';
import { formatRelativeTime } from '../utils/timeFormat';
import './AgentSessionItem.css';

interface AgentSessionItemProps {
  session: AgentSession;
  onClick: (sessionId: string) => void;
  isActive?: boolean;
  agentColor?: string;
  /** Chat messages for this session (to determine badge/status) */
  chatMessages?: ChatMessage[];
  /** Whether the session is currently loading (streaming response) */
  isLoading?: boolean;
  /** Callback to mark session as done (moves to Kanban done column) */
  onMarkDone?: (sessionId: string) => void;
  /** Callback to delete session */
  onDelete?: (sessionId: string) => void;
  /** Callback to rename session */
  onRename?: (sessionId: string) => void;
}

/**
 * Get status dot color based on activity state
 * - Gray: no conversation (empty)
 * - Yellow/Orange: working (loading)
 * - Green: ready (agent responded, waiting for user)
 */
function getActivityDotColor(isLoading: boolean, hasUnread: boolean, isEmpty: boolean): string {
  if (isLoading) return '#f59e0b'; // Yellow/Orange - working
  if (hasUnread) return '#22c55e'; // Green - ready (agent responded)
  if (isEmpty) return '#6b7280'; // Gray - no conversation
  return '#6b7280'; // Default gray
}

/**
 * Compact session item following TaskItem pattern.
 * Single row: status dot + title + badge + relative time
 *
 * Features (matching TerminalActivityBar):
 * - Status dot (gray=todo, orange=in_progress, green=done)
 * - Activity badge: ⚡ busy, 💬 unread/waiting, 💤 dormant
 * - Progress bar when loading
 * - Pulse animation when waiting for user
 */
function AgentSessionItem({
  session,
  onClick,
  isActive = false,
  agentColor = '#00D4FF',
  chatMessages = [],
  isLoading = false,
  onMarkDone,
  onDelete,
  onRename,
}: AgentSessionItemProps) {
  const relativeTime = formatRelativeTime(session.updatedAt);
  const itemRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef<number>(0);
  
  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  // 🦆 Auto-scroll into view when session becomes active
  // But NOT when clicked directly from sidebar (within 500ms)
  useEffect(() => {
    if (isActive && itemRef.current) {
      const timeSinceClick = Date.now() - lastClickTime.current;
      // If clicked directly within last 500ms, skip scroll
      if (timeSinceClick < 500) {
        return;
      }
      // External activation (from Kanban) - scroll to center
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isActive]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showContextMenu) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [showContextMenu]);

  // Record click timestamp before calling onClick
  const handleDirectClick = () => {
    lastClickTime.current = Date.now();
    onClick(session.id);
  };

  // Check if chat is empty (no messages)
  const isChatEmpty = chatMessages.length === 0;

  // Check if session is dormant (no user interaction yet)
  const isDormant = useMemo(() => {
    if (chatMessages.length === 0) return true;
    const hasUserMessage = chatMessages.some(msg => msg.role === 'user');
    return !hasUserMessage;
  }, [chatMessages]);

  // 🦆 Check if the session is actually loading/streaming
  // This catches both: isLoading prop from chatLoadingMap AND message status === 'streaming'
  const isActuallyLoading = useMemo(() => {
    if (isLoading) return true;
    if (chatMessages.length === 0) return false;

    const lastMessage = chatMessages[chatMessages.length - 1];
    // If last message is from assistant and is streaming, we're loading
    if (lastMessage?.role === 'assistant' && lastMessage.status === 'streaming') {
      return true;
    }
    return false;
  }, [isLoading, chatMessages]);

  // Check if the last message is from assistant and complete (for green dot)
  // This is independent of isActive - the dot should be green when assistant has responded
  const isAgentReady = useMemo(() => {
    if (isActuallyLoading || chatMessages.length === 0 || isDormant) {
      return false;
    }
    const lastMessage = chatMessages[chatMessages.length - 1];
    if (lastMessage?.role !== 'assistant') {
      return false;
    }
    // Only ready if the message is complete (not streaming)
    return lastMessage.status === 'complete' || lastMessage.status === undefined;
  }, [chatMessages, isDormant, isActuallyLoading]);

  // Get dot color based on activity state
  // Green when agent is ready (regardless of isActive), yellow when loading, gray otherwise
  const dotColor = getActivityDotColor(isActuallyLoading, isAgentReady, isChatEmpty || isDormant);
  
  // Check if there are unread messages (used for pulse animation on dot)
  const hasUnreadMessages = isAgentReady && !isActive;

  return (
    <div
      ref={itemRef}
      className="session-item"
      onClick={handleDirectClick}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleDirectClick();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        marginBottom: '4px',
        background: isActive ? `${agentColor}35` : `${agentColor}15`,
        border: isActive
          ? `2px solid ${agentColor}`
          : `1px solid ${agentColor}33`,
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        color: isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.85)',
        transition: 'all 0.2s ease',
        boxShadow: isActive ? `0 0 8px ${agentColor}55` : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = `${agentColor}25`;
          e.currentTarget.style.borderColor = `${agentColor}55`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = `${agentColor}15`;
          e.currentTarget.style.borderColor = `${agentColor}33`;
        }
      }}
    >
      {/* Activity Indicator Dot - Gray (empty), Yellow (working), Green (ready) */}
      {/* NOTE: "Quack quack..." tooltip removed - shown at AGENT level, not session level */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          className={isActuallyLoading ? 'session-dot working' : hasUnreadMessages ? 'session-dot ready' : 'session-dot'}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
          }}
        />
      </div>

      {/* Session Content - title + progress bar */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Session Title */}
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.title.length > 25 ? session.title.substring(0, 25) + '...' : session.title}
          </span>
        </div>

        {/* Progress Bar when loading */}
        {isActuallyLoading && (
          <div className="session-progress-bar">
            <div className="session-progress-indicator" />
          </div>
        )}
      </div>

      {/* Relative Time */}
      <span
        style={{
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.5)',
          flexShrink: 0,
        }}
      >
        {relativeTime}
      </span>

      {/* Context Menu - rendered via Portal */}
      {showContextMenu && createPortal(
        <div
          className="session-context-menu"
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onMarkDone && session.status !== 'done' && (
            <button
              className="session-context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                onMarkDone(session.id);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Mark as Done
            </button>
          )}
          {onRename && (
            <button
              className="session-context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                onRename(session.id);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Rename Session
            </button>
          )}
          {onDelete && (
            <button
              className="session-context-menu-item delete"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                onDelete(session.id);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete Session
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default memo(AgentSessionItem);
