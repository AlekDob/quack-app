import { memo, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { AgentSession, ChatMessage } from '../types';
import { formatRelativeTime } from '../utils/timeFormat';
import { getActivityDotColor, getTimeColor } from '../utils/sessionStatus';
import './AgentSessionItem.css';

interface AgentSessionItemProps {
  session: AgentSession;
  onClick: (sessionId: string) => void;
  isActive?: boolean;
  agentColor?: string;
  /** Whether this is the last session in the list (for metro line termination) */
  isLast?: boolean;
  /** Chat messages for this session (to determine badge/status) */
  chatMessages?: ChatMessage[];
  /** Whether the session is currently loading (streaming response) */
  isLoading?: boolean;
  /** Whether the session has a pending AskUserQuestion (awaiting user response) */
  hasPendingQuestion?: boolean;
  /** Callback to mark session as done (moves to Kanban done column) */
  onMarkDone?: (sessionId: string) => void;
  /** Callback to delete session */
  onDelete?: (sessionId: string) => void;
  /** Callback to rename session */
  onRename?: (sessionId: string) => void;
  /** Agent's default branch (fallback when session has no branch) */
  agentBranch?: string;
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
  isLast = false,
  chatMessages = [],
  isLoading = false,
  hasPendingQuestion = false,
  onMarkDone,
  onDelete,
  onRename,
  agentBranch,
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
  // Priority: Awaiting (purple) > Working (yellow) > Ready (green) > Empty (gray)
  const dotColor = getActivityDotColor(hasPendingQuestion, isActuallyLoading, isAgentReady, isChatEmpty || isDormant);

  // Check if there are unread messages (used for pulse animation on dot)
  const hasUnreadMessages = isAgentReady && !isActive;

  // Determine dot CSS class based on state priority
  const getDotClassName = (): string => {
    if (hasPendingQuestion) return 'session-dot awaiting';
    if (isActuallyLoading) return 'session-dot working';
    if (hasUnreadMessages) return 'session-dot ready';
    return 'session-dot';
  };

  return (
    <div
      className={`session-item-wrapper${isActuallyLoading ? ' has-pulse' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        // Pass agent color for CSS animations
        '--pulse-color': agentColor,
      } as React.CSSProperties}
    >
      {/* Metro horizontal connector line - uses agent color */}
      <div
        className="metro-horizontal-line"
        style={{
          position: 'absolute',
          left: '-12px',
          top: '50%',
          width: '10px',
          height: '2px',
          background: agentColor,
          opacity: 0.4,
          transform: 'translateY(-50%)',
        }}
      />
      {/* Metro station dot - positioned at the end of horizontal line */}
      <div
        className="metro-station-dot"
        style={{
          position: 'absolute',
          left: '-4px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: isActive ? agentColor : '#1a1a2e',
          border: `2px solid ${agentColor}`,
          zIndex: 5,
          transition: 'all 0.2s ease',
          boxShadow: isActive ? `0 0 6px ${agentColor}` : 'none',
        }}
      />
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
          gap: '6px',
          padding: '4px 8px',
          marginBottom: isLast ? '16px' : '6px', // Extra margin for last session
          flex: 1,
          background: isActive ? `${agentColor}55` : `${agentColor}15`,
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '10px',
          color: isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.7)',
          transition: 'all 0.2s ease',
          border: isActive ? `1px solid ${agentColor}` : '1px solid transparent',
          boxShadow: isActive ? `0 0 10px ${agentColor}60, inset 0 0 8px ${agentColor}20` : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = `${agentColor}25`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = `${agentColor}15`;
          }
        }}
      >
      {/* Activity Indicator Dot - Color based on time recency */}
      {/* Green (<5min), Yellow (5-30min), Gray (>30min) */}
      {/* Exception: Purple with ? when awaiting user response */}
      <div style={{ position: 'relative', flexShrink: 0, width: '10px', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className={getDotClassName()}
          style={{
            width: hasPendingQuestion ? '10px' : '6px',
            height: hasPendingQuestion ? '10px' : '6px',
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 4px ${dotColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Question mark for awaiting state */}
          {hasPendingQuestion && (
            <span className="session-dot-question">?</span>
          )}
        </div>
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
            {(session.title || 'Untitled').length > 25 ? (session.title || 'Untitled').substring(0, 25) + '...' : (session.title || 'Untitled')}
          </span>

          {/* Branch badge — only when session has explicit branch different from agent's */}
          {session.branch && session.branch !== agentBranch && (
            <span
              className="session-branch-badge"
              title={session.branch}
              style={{
                fontSize: '8px',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                padding: '1px 4px',
                borderRadius: '3px',
                background: 'rgba(255, 107, 53, 0.15)',
                color: 'rgba(255, 107, 53, 0.85)',
                border: '1px solid rgba(255, 107, 53, 0.2)',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {session.branch.length > 12
                ? session.branch.replace(/^(feature|hotfix|bugfix|release)\//, '').substring(0, 10) + '..'
                : session.branch}
            </span>
          )}
        </div>

        {/* Progress Bar when loading */}
        {isActuallyLoading && (
          <div className="session-progress-bar">
            <div className="session-progress-indicator" />
          </div>
        )}
      </div>

      {/* Relative Time - color based on recency */}
      <span
        style={{
          fontSize: '9px',
          color: getTimeColor(session.updatedAt),
          flexShrink: 0,
          fontWeight: session.updatedAt && (Date.now() - session.updatedAt) < 5 * 60 * 1000 ? 500 : 400,
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
    </div>
  );
}

export default memo(AgentSessionItem);
