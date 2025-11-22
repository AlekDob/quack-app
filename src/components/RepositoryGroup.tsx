import { type MouseEvent, useState, useEffect, useCallback, useMemo, memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Store } from '@tauri-apps/plugin-store';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import TerminalActivityBar from './TerminalActivityBar';
import CommitHistoryModal from './CommitHistoryModal';
import RevealInFinderButton from './RevealInFinderButton';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
// import DragHandle from './DragHandle'; // 🦆 DISABLED - replaced with timestamp display
import type { TerminalInfo, ChatMessage, GitPullResult } from '../types';

interface RepositoryGroupProps {
  repoPath: string;
  repoName: string;
  mainAgents: TerminalInfo[];
  worktreeAgents: TerminalInfo[];
  isCollapsed: boolean;
  activeId: string | null;
  chatSessions?: Map<string, ChatMessage[]>;
  lastReadTimestamps?: Map<string, number>; // 🔵 Read-once notification system
  onToggle: () => void;
  onSelect: (terminal: TerminalInfo) => void;
  onClose: (id: string) => void;
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void;
  onOpenGitPanel?: () => void; // NEW: Function to open Git Panel drawer
  gitRefreshTrigger?: number; // NEW: Trigger to refresh git status after commit
}

// Helper function to get avatar image URL (works in both dev and production)
function getAvatarUrl(avatarName: string): string {
  // Check if we're in Tauri context
  if (window.__TAURI__) {
    // In production, use convertFileSrc with the expected resource path
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset')
  }
  // In dev mode, use standard public path
  return `/images/ducks/new-avatars/${avatarName}`
}

// Helper to extract repository name from path
function getRepoDisplayName(path: string): string {
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  if (lastPart.includes('-worktree-')) {
    return lastPart.split('-worktree-')[0];
  }
  return lastPart;
}

// Helper to extract branch name from worktree path or terminal info
function getBranchName(terminal: TerminalInfo): string {
  if (terminal.branch) return terminal.branch;
  const pathParts = terminal.cwd.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart.includes('-worktree-')) {
    const branchPart = lastPart.split('-worktree-')[1];
    return branchPart.replace(/-/g, '/');
  }
  return 'main';
}

// 🦆 Helper to calculate relative time string
function getRelativeTimeString(timestamp: number): { value: string; unit: string; minutes: number } | null {
  if (!timestamp || timestamp === 0) return null;

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return { value: '<1', unit: 'M', minutes: 0 };
  if (minutes < 60) return { value: String(minutes), unit: 'M', minutes };
  if (hours < 24) return { value: String(hours), unit: 'H', minutes };
  return { value: String(days), unit: 'D', minutes };
}

// 🦆 Helper to calculate color opacity based on freshness
function getTimestampOpacity(minutes: number): number {
  // Fresh (0-3 min): white full opacity (1.0)
  if (minutes <= 3) return 1.0;

  // Recent (3-30 min): gradual fade from 1.0 to 0.4
  if (minutes <= 30) {
    const fadeProgress = (minutes - 3) / 27; // 0 to 1 over 27 minutes
    return 1.0 - (fadeProgress * 0.6); // From 1.0 to 0.4
  }

  // Old (30+ min): dim gray (0.4)
  return 0.4;
}

// Sortable Agent Component with drag handle
interface SortableAgentProps {
  agent: TerminalInfo;
  isActive: boolean;
  chatSessions?: Map<string, ChatMessage[]>;
  lastReadTimestamps?: Map<string, number>; // 🔵 Read-once notification system
  onSelect: (terminal: TerminalInfo) => void;
  onClose: (id: string) => void;
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void;
  onGitMenuToggle: (agentId: string | null) => void;
  showGitMenu: boolean;
  handleGitOperation: (operation: string, terminal: TerminalInfo) => void;
  isWorktree?: boolean;
  isDraggingAny?: boolean;
}

function SortableAgent({
  agent,
  isActive,
  chatSessions,
  lastReadTimestamps,
  onSelect,
  onClose,
  onContextMenu,
  onGitMenuToggle,
  showGitMenu,
  handleGitOperation,
  isWorktree = false,
  isDraggingAny = false,
}: SortableAgentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // 🦆 Force re-render every minute to update relative time
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000); // Update every 60 seconds (1 minute)
    return () => clearInterval(interval);
  }, []);

  // 🎨 Load avatar URL from agent.avatar
  useEffect(() => {
    let isMounted = true;

    async function loadAvatarUrl() {
      // If no avatar specified, use duck30.jpeg fallback
      if (!agent.avatar) {
        if (isMounted) {
          if (window.__TAURI__) {
            setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset'));
          } else {
            setAvatarUrl('/duck30.jpeg');
          }
        }
        return;
      }

      // Check if it's a custom avatar (UUID format)
      if (isCustomAvatar(agent.avatar)) {
        try {
          const url = await getCustomAvatarUrl(agent.avatar);
          if (isMounted) {
            setAvatarUrl(url);
          }
        } catch (error) {
          console.error('Failed to load custom avatar:', error);
          if (isMounted) {
            // Fallback to duck30.jpeg if custom avatar fails
            if (window.__TAURI__) {
              setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset'));
            } else {
              setAvatarUrl('/duck30.jpeg');
            }
          }
        }
      } else {
        // Default avatar - use getAvatarUrl helper
        if (isMounted) {
          setAvatarUrl(getAvatarUrl(agent.avatar));
        }
      }
    }

    loadAvatarUrl();

    return () => {
      isMounted = false;
    };
  }, [agent.avatar]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agent.id });

  // Memoize drag style to prevent recreation on every render
  const style = useMemo(() => ({
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    willChange: isDragging ? 'transform' : 'auto',
  }), [transform, isDragging, transition]);

  // Check if agent is dormant (ONLY has "Previous conversation detected", no user interaction)
  const isDormant = useMemo(() => {
    if (!chatSessions) {
      console.log(`[${agent.label}] 💤 isDormant=false (no chatSessions)`)
      return false;
    }
    const messages = chatSessions.get(agent.id);
    if (!messages || messages.length === 0) {
      console.log(`[${agent.label}] 💤 isDormant=false (no messages)`)
      return false;
    }

    // Check if agent has any user messages (actual interaction)
    const hasUserMessage = messages.some(msg => msg.role === 'user');
    // Check if agent has any real assistant responses (not just "Previous conversation detected")
    const hasAssistantResponse = messages.some(msg =>
      msg.role === 'assistant' &&
      !msg.content?.includes('Previous conversation detected') &&
      !msg.content?.includes('**Previous conversation detected**')
    );

    const result = !hasUserMessage && !hasAssistantResponse
    console.log(`[${agent.label}] 💤 isDormant=${result} (hasUserMessage=${hasUserMessage}, hasAssistantResponse=${hasAssistantResponse})`)

    return result;
  }, [chatSessions, agent.id, agent.label]);

  // Check if agent is waiting for response (has unread messages)
  const hasUnreadMessages = useMemo(() => {
    if (!chatSessions || isActive) return false;
    const messages = chatSessions.get(agent.id);
    if (!messages || messages.length === 0) return false;

    // If agent is dormant, no unread messages
    if (isDormant) return false;

    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
    return lastAssistantMessage !== undefined;
  }, [chatSessions, agent.id, isActive, isDormant]);

  // 🦆 Get last assistant message timestamp for this agent
  const lastAssistantTimestamp = useMemo(() => {
    if (!chatSessions) return 0;
    const messages = chatSessions.get(agent.id);
    if (!messages || messages.length === 0) return 0;

    // Find LAST assistant message
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
    return lastAssistantMessage?.timestamp || 0;
  }, [chatSessions, agent.id]);

  // 🔵 Get last read timestamp for this agent
  const lastReadTimestamp = useMemo(() => {
    if (!lastReadTimestamps) return 0;
    return lastReadTimestamps.get(agent.id) || 0;
  }, [lastReadTimestamps, agent.id]);

  // Memoize agent card background style - NO highlight for waiting (badge dot instead!)
  const agentCardBg = useMemo(() => {
    if (isActive) return `${agent.color}28`; // Increased from 15 to 28 (2x opacity, ~16%)
    if (isHovered) return 'rgba(255, 255, 255, 0.03)';
    return 'transparent';
  }, [isActive, isHovered, agent.color]);

  // 🔵 Show notification badge dot when agent has NEW unread messages (read-once system)
  // Badge appears when: NOT active + agent responded AFTER last read
  const showNotificationBadge = useMemo(() => {
    if (isActive || isDormant) return false; // No badge when active or dormant

    // 🔵 TIMESTAMP COMPARISON: Badge shows ONLY if agent responded AFTER last read
    // This creates "read-once" behavior: badge disappears when clicked, only reappears for NEW messages
    return lastAssistantTimestamp > lastReadTimestamp;
  }, [isActive, isDormant, lastAssistantTimestamp, lastReadTimestamp]);

  // Memoize metro station style - DYNAMIC based on notification state (MUST be after showNotificationBadge)
  const metroStationStyle = useMemo(() => ({
    width: '10px',
    height: '10px',
    transform: isWorktree ? 'rotate(45deg)' : 'none',
    borderRadius: isWorktree ? '0' : '50%',
    // 🎨 Dynamic background: FULL agent color when unread, TRANSPARENT when read
    background: showNotificationBadge ? agent.color : 'transparent',
    // 🎨 Dynamic border: NO border when unread (full color), agent color BORDER when read
    border: showNotificationBadge ? 'none' : `2px solid ${agent.color}66`, // 66 = ~40% opacity
    boxShadow: showNotificationBadge ? `0 0 8px ${agent.color}99, 0 0 12px ${agent.color}66` : 'none',
    flexShrink: 0,
    transition: 'all 0.3s ease',
  }), [isWorktree, showNotificationBadge, agent.color]);

  // Memoize callbacks to prevent recreation
  const handleSelect = useCallback(() => onSelect(agent), [onSelect, agent]);
  const handleContextMenu = useCallback((e: MouseEvent) => onContextMenu(e, agent), [onContextMenu, agent]);
  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(agent.id);
  }, [onClose, agent.id]);
  const handleGitMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onGitMenuToggle(showGitMenu ? null : agent.id);
  }, [onGitMenuToggle, showGitMenu, agent.id]);

  // Get relative time string with opacity - re-calculate on tick change
  const relativeTime = useMemo(() => getRelativeTimeString(lastAssistantTimestamp), [lastAssistantTimestamp, tick]);

  // Calculate opacity based on freshness
  const timestampOpacity = useMemo(() => {
    if (!relativeTime) return 0.4;
    return getTimestampOpacity(relativeTime.minutes);
  }, [relativeTime]);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        marginBottom: '8px',
        position: 'relative' as const,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
      className="group"
    >
      {/* LEFT SECTION: Timing + Metro Station (OUTSIDE colored background) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '35px' }}>
        {/* 🦆 Relative Time - ALWAYS visible, positioned left of metro-station */}
        {relativeTime ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: 600,
              lineHeight: '1',
              pointerEvents: 'none',
              userSelect: 'none',
              minWidth: '20px',
            }}
          >
            {/* Value - agent color when <5 min, white otherwise */}
            <div style={{
              marginBottom: '1px',
              color: relativeTime.minutes < 5 ? agent.color : `rgba(255, 255, 255, ${timestampOpacity})`,
              transition: 'color 1s ease',
            }}>
              {relativeTime.value}
            </div>
            {/* Unit - agent color when <5 min, slightly dimmer white otherwise */}
            <div style={{
              fontSize: '7px',
              color: relativeTime.minutes < 5 ? agent.color : `rgba(255, 255, 255, ${timestampOpacity * 0.75})`,
              transition: 'color 1s ease',
            }}>
              {relativeTime.unit}
            </div>
          </div>
        ) : null}

        {/* Metro Station Dot/Diamond */}
        <div className="metro-station" style={metroStationStyle} />
      </div>

      {/* RIGHT SECTION: Colored Background with Avatar + Content */}
      <div
        className="agent-card flex items-center"
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => !isDraggingAny && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          flex: 1,
          padding: '8px 12px',
          paddingLeft: '8px',
          background: agentCardBg,
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'background 0.2s ease',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minHeight: '48px',
        }}
      >
        {/* 🎨 Avatar - Full height, squared with border-radius, with IMAGE */}
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '6px',
            border: `2px solid ${agent.color}66`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={agent.label}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.error('[RepositoryGroup] Image failed to load, using fallback duck30.jpeg:', avatarUrl)
                // Always fallback to duck30.jpeg on error
                if (window.__TAURI__) {
                  target.src = convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset')
                } else {
                  target.src = '/duck30.jpeg'
                }
              }}
            />
          ) : (
            // Fallback to letter while loading
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, ${agent.color}40, ${agent.color}20)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 700,
                color: agent.color,
              }}
            >
              {agent.label.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex w-full items-center justify-between">
          <div className="flex w-full items-center gap-2 flex-1">
            <TerminalActivityBar
              terminal={agent}
              chatSessions={chatSessions}
              hideBranch={true}
              isActive={isActive}
            />
          </div>

          {/* Action buttons */}
          <div
            className="icons-wrapper"
            style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: 'auto',
              gap: '4px',
            }}
          >
            {/* Git Branch Icon */}
            {agent.branch && (
              <div
                className="git-branch-icon"
                onClick={handleGitMenuToggle}
                style={{
                  opacity: isHovered ? 1 : 0,
                  visibility: isHovered ? 'visible' : 'hidden',
                  transition: 'opacity 0.2s ease, visibility 0.2s ease',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  pointerEvents: isHovered ? 'auto' : 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(78, 205, 196, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4ecdc4"
                  strokeWidth="2"
                >
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
              </div>
            )}

            {/* Close button */}
            <button
              type="button"
              className="terminal-close"
              onClick={handleClose}
              style={{
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.2s ease',
                background: 'transparent',
                border: 'none',
                color: '#e74c3c',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px 8px',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ×
            </button>
          </div>
        </div>
      </div>

      {/* Git Operations Menu */}
      {showGitMenu && (
        <div
          className="git-operations-menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: '8px',
            marginTop: '4px',
            background: 'rgba(20, 22, 28, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            minWidth: '200px',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          <div className="menu-items" style={{ padding: '4px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGitOperation('pull', agent);
                onGitMenuToggle(null);
              }}
              className="menu-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                <path d="M8 12L4 8h3V2h2v6h3l-4 4zm-6 2h12v2H2v-2z"/>
              </svg>
              Pull latest
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGitOperation('push', agent);
                onGitMenuToggle(null);
              }}
              className="menu-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                <path d="M8 4L4 8h3v6h2V8h3L8 4zM2 2h12v2H2V2z"/>
              </svg>
              Push to remote
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGitOperation('create-pr', agent);
                onGitMenuToggle(null);
              }}
              className="menu-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346z"/>
              </svg>
              Create PR
            </button>

            <div style={{
              height: '1px',
              background: 'rgba(255, 255, 255, 0.1)',
              margin: '4px 8px',
            }} />

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGitOperation('view-commits', agent);
                onGitMenuToggle(null);
              }}
              className="menu-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                <path d="M10.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z"/>
              </svg>
              View commits
            </button>

            {isWorktree && (
              <>
                <div style={{
                  height: '1px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  margin: '4px 8px',
                }} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGitOperation('delete-worktree', agent);
                    onGitMenuToggle(null);
                  }}
                  className="menu-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(231, 76, 60, 0.9)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                    <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/>
                  </svg>
                  Delete worktree
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize SortableAgent with custom comparison to prevent unnecessary re-renders during drag
const MemoizedSortableAgent = memo(SortableAgent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.agent.id === nextProps.agent.id &&
    prevProps.agent.label === nextProps.agent.label &&
    prevProps.agent.status === nextProps.agent.status &&
    prevProps.agent.color === nextProps.agent.color &&
    prevProps.agent.workingOn === nextProps.agent.workingOn &&
    prevProps.agent.waitingForResponse === nextProps.agent.waitingForResponse &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.showGitMenu === nextProps.showGitMenu &&
    prevProps.isDraggingAny === nextProps.isDraggingAny &&
    prevProps.isWorktree === nextProps.isWorktree &&
    prevProps.chatSessions === nextProps.chatSessions &&
    prevProps.lastReadTimestamps === nextProps.lastReadTimestamps
  )
});

export default function RepositoryGroup({
  repoPath,
  repoName,
  mainAgents,
  worktreeAgents,
  isCollapsed,
  activeId,
  chatSessions,
  lastReadTimestamps,
  onToggle,
  onSelect,
  onClose,
  onContextMenu,
  onOpenGitPanel,
  gitRefreshTrigger,
}: RepositoryGroupProps) {
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [showGitMenu, setShowGitMenu] = useState<string | null>(null);
  const [commitHistoryModal, setCommitHistoryModal] = useState<{
    branchName: string;
    rootPath: string;
  } | null>(null);
  const [branchModifiedFiles, setBranchModifiedFiles] = useState<Map<string, number>>(new Map());
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [agentOrder, setAgentOrder] = useState<Record<string, string[]>>({});
  const displayName = getRepoDisplayName(repoName);
  const isDraggingAny = activeAgentId !== null;

  // Cleanup: Ensure dragging class is removed on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('dragging-active');
    };
  }, []);

  // Configure drag sensors with optimized constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        tolerance: 5,
        delay: 100,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Load saved agent order on mount
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const store = await Store.load('.quack-agent-order.dat');
        const savedOrder = await store.get<Record<string, string[]>>(`agent-order-${repoPath}`);
        if (savedOrder) {
          setAgentOrder(savedOrder);
        }
      } catch (error) {
        console.error('Failed to load agent order:', error);
      }
    };
    loadOrder();
  }, [repoPath]);

  // Save agent order when it changes
  const saveOrder = useCallback(async (order: Record<string, string[]>) => {
    try {
      const store = await Store.load('.quack-agent-order.dat');
      await store.set(`agent-order-${repoPath}`, order);
      await store.save();
    } catch (error) {
      console.error('Failed to save agent order:', error);
    }
  }, [repoPath]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveAgentId(String(event.active.id));
    // Add class to disable animations for performance
    document.body.classList.add('dragging-active');
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    // Remove dragging class to re-enable animations
    document.body.classList.remove('dragging-active');
    
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveAgentId(null);
      return;
    }

    // Find which branch the agents belong to
    const allAgents = [...mainAgents, ...worktreeAgents];
    const activeAgent = allAgents.find(a => a.id === active.id);
    const overAgent = allAgents.find(a => a.id === over.id);

    if (!activeAgent || !overAgent) {
      setActiveAgentId(null);
      return;
    }

    const activeBranch = activeAgent.branch || getBranchName(activeAgent);
    const overBranch = overAgent.branch || getBranchName(overAgent);

    // Only allow reordering within the same branch
    if (activeBranch !== overBranch) {
      setActiveAgentId(null);
      document.body.classList.remove('dragging-active');
      return;
    }

    // Get agents for this branch
    const branchAgents = allAgents.filter(a => {
      const branch = a.branch || getBranchName(a);
      return branch === activeBranch;
    });

    // Apply custom order or use default
    const orderKey = `${activeBranch}-${activeAgent.worktreePath ? 'worktree' : 'main'}`;
    const currentOrder = agentOrder[orderKey] || branchAgents.map(a => a.id);

    const oldIndex = currentOrder.indexOf(String(active.id));
    const newIndex = currentOrder.indexOf(String(over.id));

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
      const updatedOrder = { ...agentOrder, [orderKey]: newOrder };
      setAgentOrder(updatedOrder);
      saveOrder(updatedOrder);
    }

    setActiveAgentId(null);
  };

  // Sort agents by last ASSISTANT message timestamp - most recent first (NO DRAG-AND-DROP)
  const applyCustomOrder = useCallback((agents: TerminalInfo[], branchName: string) => {
    // Get last ASSISTANT message timestamp (only when agent RESPONDS, not when user sends!)
    const getLastAssistantMessageTimestamp = (agent: TerminalInfo): number => {
      if (!chatSessions) return 0;
      const messages = chatSessions.get(agent.id);
      if (!messages || messages.length === 0) return 0;

      // Find LAST assistant message (when the agent responds, not when user sends)
      const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');

      if (!lastAssistantMessage?.timestamp) return 0;

      // console.log(`[SORT] ${agent.label} - last assistant msg timestamp: ${lastAssistantMessage.timestamp}`); // Performance: Disabled logging
      return lastAssistantMessage.timestamp;
    };

    // Simple sort: most recent ASSISTANT message first (sorting happens when agent RESPONDS)
    const sorted = [...agents].sort((a, b) => {
      const timestampA = getLastAssistantMessageTimestamp(a);
      const timestampB = getLastAssistantMessageTimestamp(b);

      // If both have assistant messages, sort by timestamp (most recent first)
      if (timestampA > 0 && timestampB > 0) {
        return timestampB - timestampA;
      }

      // Agents with assistant messages come before agents without
      if (timestampA > 0) return -1;
      if (timestampB > 0) return 1;

      // Both empty - maintain original order
      return 0;
    });

    // console.log(`[SORT] Branch ${branchName} sorted order:`, sorted.map(a => `${a.label} (${getLastAssistantMessageTimestamp(a)})`)); // Performance: Disabled logging
    return sorted;
  }, [chatSessions]);

  // Helper to generate PR URL - Memoized for performance
  const generatePRUrl = useCallback(async (rootPath: string, branchName: string): Promise<string | null> => {
    try {
      const remoteUrl = await invoke<string>('git_get_remote_url', { rootPath });

      if (remoteUrl.includes('github.com')) {
        const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          return `https://github.com/${owner}/${repo}/compare/${branchName}?expand=1`;
        }
      } else if (remoteUrl.includes('gitlab.com')) {
        const match = remoteUrl.match(/gitlab\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          return `https://gitlab.com/${owner}/${repo}/-/merge_requests/new?merge_request[source_branch]=${branchName}`;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to generate PR URL:', error);
      return null;
    }
  }, []);

  // Fetch git status for the ACTIVE terminal's branch ONLY - Memoized for performance
  const fetchActiveTerminalGitStatus = useCallback(async () => {
    if (!activeId) {
      // No active terminal, clear badge
      setBranchModifiedFiles(new Map());
      return;
    }

    // Find the active terminal from main agents or worktrees
    const activeTerminal = [...mainAgents, ...worktreeAgents].find(a => a.id === activeId);
    if (!activeTerminal) {
      setBranchModifiedFiles(new Map());
      return;
    }

    const branchName = activeTerminal.branch || getBranchName(activeTerminal);
    const rootPath = activeTerminal.worktreePath || activeTerminal.cwd;

    try {
      // Fetch ONLY for the active terminal's branch
      const count = await invoke<number>('git_uncommitted_files_count', { rootPath });
      // Store ONLY this branch in the map - badge will show only here!
      setBranchModifiedFiles(new Map([[branchName, count]]));
    } catch (error) {
      console.error(`Failed to fetch git status for active terminal:`, error);
      setBranchModifiedFiles(new Map([[branchName, 0]]));
    }
  }, [activeId, mainAgents, worktreeAgents]);

  // Intelligent Git Operations Handler - Memoized for performance
  const handleGitOperation = useCallback(async (operation: string, terminal: TerminalInfo) => {
    const rootPath = terminal.worktreePath || terminal.cwd;
    const branchName = terminal.branch || 'main';

    try {
      // Operations that need uncommitted changes check
      const needsCheck = ['pull', 'push', 'merge-to-main'];

      if (needsCheck.includes(operation)) {
        // Check for uncommitted changes
        const hasUncommitted = await invoke<boolean>('git_has_uncommitted_changes', { rootPath });

        if (hasUncommitted) {
          // Show alert and ask to open Git Panel
          const userConfirmed = window.confirm(
            `⚠️ Modifiche Non Committate\n\n` +
            `Hai modifiche non committate nel branch "${branchName}".\n\n` +
            `Vuoi aprire il Git Panel per committare le modifiche prima di procedere?`
          );

          if (userConfirmed && onOpenGitPanel) {
            onOpenGitPanel();
            return;
          } else {
            // User cancelled
            return;
          }
        }
      }

      // Handle different operations
      switch (operation) {
        case 'pull': {
          const result = await invoke<GitPullResult>('git_pull', {
            branchName,
            rootPath,
          });

          if (result.hasConflicts) {
            alert(`Pull has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join('\n')}`);
          } else {
            console.log(`✅ Pull successful: ${result.message}`);
          }
          break;
        }

        case 'push': {
          const result = await invoke<string>('git_push', {
            branchName,
            force: false,
            rootPath,
          });
          console.log(`✅ Push successful: ${result}`);
          break;
        }

        case 'merge-to-main': {
          const confirmed = window.confirm(
            `Vuoi mergeare il branch "${branchName}" in main?\n\n` +
            `Questa operazione:\n` +
            `1. Switcha a main\n` +
            `2. Mergia ${branchName} in main\n\n` +
            `Continua?`
          );

          if (!confirmed) return;

          await invoke('git_switch_branch', {
            branchName: 'main',
            rootPath,
          });

          const result = await invoke<{
            success: boolean;
            hasConflicts: boolean;
            conflictedFiles: string[];
            message: string;
          }>('git_merge_branch', {
            branchName,
            rootPath,
          });

          if (result.hasConflicts) {
            alert(`Merge has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join('\n')}`);
          } else {
            console.log(`✅ Merge successful: ${result.message}`);
          }
          break;
        }

        case 'create-pr': {
          const prUrl = await generatePRUrl(rootPath, branchName);
          if (prUrl) {
            window.open(prUrl, '_blank');
          } else {
            alert('Could not generate PR URL. Make sure the repository has a remote configured.');
          }
          break;
        }

        case 'view-commits': {
          setCommitHistoryModal({
            branchName,
            rootPath,
          });
          break;
        }

        case 'delete-worktree': {
          const confirmed = window.confirm(
            `Sei sicuro di voler eliminare il worktree per "${branchName}"?\n\n` +
            `Questo rimuoverà:\n` +
            `- ${rootPath}\n\n` +
            `Il branch continuerà ad esistere nel repository.`
          );

          if (confirmed) {
            await invoke('git_remove_worktree', {
              path: rootPath,
              force: false,
              rootPath: terminal.cwd,
            });
            console.log(`✅ Worktree deleted: ${rootPath}`);
            onClose(terminal.id);
          }
          break;
        }

        default:
          console.warn(`Unknown git operation: ${operation}`);
      }

      // Refresh git status after operation completes (only for active terminal)
      fetchActiveTerminalGitStatus();
    } catch (error) {
      console.error(`Git operation failed:`, error);
      alert(`Git operation failed: ${error}`);
    }
  }, [onOpenGitPanel, onClose, setCommitHistoryModal, generatePRUrl, fetchActiveTerminalGitStatus]);

  // Fetch git status when active terminal changes, or when triggered from Git Panel
  useEffect(() => {
    // Skip git status fetch if currently dragging to improve performance
    if (activeAgentId) return;

    fetchActiveTerminalGitStatus();

    // Auto-refresh every 60 seconds to catch commits from external sources
    const interval = setInterval(() => {
      fetchActiveTerminalGitStatus();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [activeId, mainAgents, worktreeAgents, gitRefreshTrigger, activeAgentId, fetchActiveTerminalGitStatus]);

  // Group and sort agents by branch - Memoized for performance
  const sortedBranches = useMemo(() => {
    const agentsByBranch = new Map<string, TerminalInfo[]>();

    // Process main repository agents
    mainAgents.forEach(agent => {
      const branchName = agent.branch || 'main';
      if (!agentsByBranch.has(branchName)) {
        agentsByBranch.set(branchName, []);
      }
      agentsByBranch.get(branchName)!.push(agent);
    });

    // Sort branches: main first, then others alphabetically
    return Array.from(agentsByBranch.entries()).sort(([a], [b]) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      return a.localeCompare(b);
    });
  }, [mainAgents]);

  return (
    <div className="repository-group">
      {/* Repository Header - Minimal and clean */}
      <div
        className="repository-header"
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          padding: '10px 12px',
          marginBottom: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '6px',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
        }}
      >
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold text-sm text-white/90">
              {displayName}
            </span>
          </div>

          {/* Reveal in Finder button */}
          <div onClick={(e) => e.stopPropagation()}>
            <RevealInFinderButton
              path={repoPath}
              iconOnly={true}
              className="opacity-60 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </div>

      {/* Expanded Content with Metro Map Design */}
      {!isCollapsed && (
        <div className="repository-content relative" style={{ position: 'relative' }}>

          {/* SINGLE CONTINUOUS LINE for entire repository */}
          <div
            className="continuous-metro-line"
            style={{
              position: 'absolute',
              left: '20px',
              top: '40px', // Start from first agent position
              bottom: '0',
              width: '2px',
              background: mainAgents[0]?.color || worktreeAgents[0]?.color || '#10b981',
              opacity: 0.3,
              zIndex: 1,
            }}
          />

          {/* Branch Groups with DnD Context */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {sortedBranches.map(([branchName, agents]) => {
              const orderedAgents = applyCustomOrder(agents, branchName);

              return (
                <div key={branchName} className="branch-group relative" style={{ marginBottom: '24px' }}>
                  {/* Branch Header */}
                  <div
                    className="branch-header mb-3"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginLeft: '32px',
                    }}
                  >
                    <span
                      className="text-white/60 font-mono"
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                      }}
                    >
                      {branchName} ({agents.length} agent{agents.length !== 1 ? 's' : ''})
                    </span>
                    {/* Modified Files Badge - Clickable to open Git Panel */}
                    {(branchModifiedFiles.get(branchName) || 0) > 0 && (
                      <div
                        className="modified-files-badge"
                        title={`${branchModifiedFiles.get(branchName)} files to commit - Click to open Git Panel`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenGitPanel) onOpenGitPanel();
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#d97706';  // Darker orange on hover
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f59e0b';  // Back to amber
                        }}
                        style={{
                          background: '#f59e0b',
                          color: '#fff',
                          borderRadius: '8px',
                          padding: '1px 6px',
                          fontSize: '9px',
                          fontWeight: 600,
                          cursor: 'pointer',  // Changed from 'default' to 'pointer'
                          userSelect: 'none',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        {branchModifiedFiles.get(branchName)}
                      </div>
                    )}
                  </div>

                  {/* Agents in this branch with Sortable Context */}
                  <SortableContext items={orderedAgents.map(a => a.id)} strategy={verticalListSortingStrategy}>
                    {orderedAgents.map((agent) => (
                      <MemoizedSortableAgent
                        key={agent.id}
                        agent={agent}
                        isActive={agent.id === activeId}
                        chatSessions={chatSessions}
                        lastReadTimestamps={lastReadTimestamps}
                        onSelect={onSelect}
                        onClose={onClose}
                        onContextMenu={onContextMenu}
                        onGitMenuToggle={setShowGitMenu}
                        showGitMenu={showGitMenu === agent.id}
                        handleGitOperation={handleGitOperation}
                        isWorktree={false}
                        isDraggingAny={isDraggingAny}
                      />
                    ))}
                  </SortableContext>
                </div>
              );
            })}

            {/* Drag Overlay - Ghost Preview */}
            <DragOverlay dropAnimation={null}>
              {activeAgentId ? (() => {
                const agent = [...mainAgents, ...worktreeAgents].find(a => a.id === activeAgentId);
                if (!agent) return null;
                
                return (
                  <div
                    style={{
                      marginLeft: '36px',
                      padding: '8px 12px',
                      background: `${agent.color}25`,
                      border: `2px dashed ${agent.color}`,
                      borderRadius: '6px',
                      boxShadow: `0 8px 24px ${agent.color}40, 0 0 40px ${agent.color}30`,
                      pointerEvents: 'none',
                      opacity: 0.8,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Ghost metro dot */}
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: agent.color,
                          opacity: 0.6,
                        }}
                      />
                      <span className="font-semibold text-sm text-white/90">
                        {agent.label}
                      </span>
                    </div>
                  </div>
                );
              })() : null}
            </DragOverlay>
          </DndContext>

          {/* Worktree Section - Separate section for worktrees */}
          {worktreeAgents.length > 0 && (
            <div
              className="worktree-section"
              style={{
                marginTop: '32px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {/* WORKTREES Label */}
              <div
                className="text-xs font-medium text-white/30 uppercase tracking-widest mb-4"
                style={{ fontSize: '10px', letterSpacing: '0.1em', marginLeft: '32px' }}
              >
                WORKTREES
              </div>

              {/* Group worktree agents by branch */}
              {(() => {
                const worktreeByBranch = new Map<string, TerminalInfo[]>();
                worktreeAgents.forEach(agent => {
                  const branchName = getBranchName(agent);
                  if (!worktreeByBranch.has(branchName)) {
                    worktreeByBranch.set(branchName, []);
                  }
                  worktreeByBranch.get(branchName)!.push(agent);
                });

                return Array.from(worktreeByBranch.entries()).map(([branchName, agents]) => (
                  <div key={`worktree-${branchName}`} className="branch-group relative" style={{ marginBottom: '24px' }}>
                    {/* Branch Header */}
                    <div
                      className="branch-header mb-3"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginLeft: '32px',
                      }}
                    >
                      <span
                        className="text-white/60 font-mono"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                        }}
                      >
                        {branchName} ({agents.length} agent{agents.length !== 1 ? 's' : ''})
                      </span>
                      {/* Modified Files Badge - Clickable to open Git Panel */}
                      {(branchModifiedFiles.get(branchName) || 0) > 0 && (
                        <div
                          className="modified-files-badge"
                          title={`${branchModifiedFiles.get(branchName)} files to commit - Click to open Git Panel`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenGitPanel) onOpenGitPanel();
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#d97706';  // Darker orange on hover
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f59e0b';  // Back to amber
                          }}
                          style={{
                            background: '#f59e0b',
                            color: '#fff',
                            borderRadius: '8px',
                            padding: '1px 6px',
                            fontSize: '9px',
                            fontWeight: 600,
                            cursor: 'pointer',  // Changed from 'default' to 'pointer'
                            userSelect: 'none',
                            transition: 'background 0.2s ease',
                          }}
                        >
                          {branchModifiedFiles.get(branchName)}
                        </div>
                      )}
                    </div>

                    {/* Worktree Agents */}
                    {agents.map((agent) => {
                      const isActive = agent.id === activeId;
                      const isHovered = agent.id === hoveredAgentId;

                      // Check if agent is dormant (ONLY has "Previous conversation detected", no user interaction)
                      const isDormant = (() => {
                        if (!chatSessions) return false;
                        const messages = chatSessions.get(agent.id);
                        if (!messages || messages.length === 0) return false;

                        // Check if agent has any user messages (actual interaction)
                        const hasUserMessage = messages.some(msg => msg.role === 'user');
                        // Check if agent has any real assistant responses (not just "Previous conversation detected")
                        const hasAssistantResponse = messages.some(msg =>
                          msg.role === 'assistant' &&
                          !msg.content?.includes('Previous conversation detected') &&
                          !msg.content?.includes('**Previous conversation detected**')
                        );

                        return !hasUserMessage && !hasAssistantResponse;
                      })();

                      // Check if agent has unread messages
                      const hasUnreadMessages = (() => {
                        if (!chatSessions || isActive) return false;
                        const messages = chatSessions.get(agent.id);
                        if (!messages || messages.length === 0) return false;

                        // If agent is dormant, no unread messages
                        if (isDormant) return false;

                        const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
                        return lastAssistantMessage !== undefined;
                      })();

                      // Calculate last assistant timestamp for worktree agents (same as SortableAgent)
                      const lastAssistantTimestamp = (() => {
                        if (!chatSessions) return 0;
                        const messages = chatSessions.get(agent.id);
                        if (!messages || messages.length === 0) return 0;
                        const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
                        return lastAssistantMessage?.timestamp || 0;
                      })();

                      // 🔵 Show notification badge dot for worktree agents (read-once system)
                      const lastReadTimestamp = lastReadTimestamps?.get(agent.id) || 0;
                      const showNotificationBadge = !isActive && !isDormant && (lastAssistantTimestamp > lastReadTimestamp);

                      const relativeTime = getRelativeTimeString(lastAssistantTimestamp);
                      const timestampOpacity = relativeTime ? getTimestampOpacity(relativeTime.minutes) : 0.4;

                      return (
                        <div
                          key={agent.id}
                          style={{
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          {/* LEFT SECTION: Timing + Metro Station (OUTSIDE colored background) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '35px' }}>
                            {/* 🦆 Relative Time - ALWAYS visible, positioned left of metro-station */}
                            {relativeTime ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '9px',
                                  fontWeight: 600,
                                  lineHeight: '1',
                                  pointerEvents: 'none',
                                  userSelect: 'none',
                                  minWidth: '20px',
                                }}
                              >
                                <div style={{
                                  marginBottom: '1px',
                                  color: relativeTime.minutes < 5 ? agent.color : `rgba(255, 255, 255, ${timestampOpacity})`,
                                  transition: 'color 1s ease',
                                }}>
                                  {relativeTime.value}
                                </div>
                                <div style={{
                                  fontSize: '7px',
                                  color: relativeTime.minutes < 5 ? agent.color : `rgba(255, 255, 255, ${timestampOpacity * 0.75})`,
                                  transition: 'color 1s ease',
                                }}>
                                  {relativeTime.unit}
                                </div>
                              </div>
                            ) : null}

                            {/* Metro Station DIAMOND for worktrees! - DYNAMIC based on notification state */}
                            <div
                              className="metro-station-diamond"
                              style={{
                                width: '10px',
                                height: '10px',
                                transform: 'rotate(45deg)',  // DIAMOND shape!
                                borderRadius: '0',
                                // 🎨 Dynamic background: FULL agent color when unread, TRANSPARENT when read
                                background: showNotificationBadge ? agent.color : 'transparent',
                                // 🎨 Dynamic border: NO border when unread (full color), agent color BORDER when read
                                border: showNotificationBadge ? 'none' : `2px solid ${agent.color}66`, // 66 = ~40% opacity
                                boxShadow: showNotificationBadge ? `0 0 8px ${agent.color}99, 0 0 12px ${agent.color}66` : 'none',
                                flexShrink: 0,
                                transition: 'all 0.3s ease',
                              }}
                            />
                          </div>

                          {/* RIGHT SECTION: Colored Background with Avatar + Content */}
                          <div
                            className={`agent-card`}
                            onClick={() => onSelect(agent)}
                            onContextMenu={(e) => onContextMenu(e, agent)}
                            onMouseEnter={() => setHoveredAgentId(agent.id)}
                            onMouseLeave={() => setHoveredAgentId(null)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              paddingLeft: '8px',
                              background: isActive
                                ? `${agent.color}28`  // Increased from 15 to 28 (2x opacity, ~16%)
                                : isHovered
                                ? 'rgba(255, 255, 255, 0.03)'
                                : 'transparent',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'background 0.2s ease',
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              minHeight: '48px',
                            }}
                          >
                            {/* 🎨 Avatar - Full height, squared with border-radius, with IMAGE */}
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '6px',
                                border: `2px solid ${agent.color}66`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                overflow: 'hidden',
                              }}
                            >
                              {(() => {
                                // Load avatar URL for worktree agents (inline)
                                const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

                                useEffect(() => {
                                  let isMounted = true;

                                  async function loadAvatarUrl() {
                                    if (!agent.avatar) {
                                      if (isMounted) {
                                        if (window.__TAURI__) {
                                          setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset'));
                                        } else {
                                          setAvatarUrl('/duck30.jpeg');
                                        }
                                      }
                                      return;
                                    }

                                    if (isCustomAvatar(agent.avatar)) {
                                      try {
                                        const url = await getCustomAvatarUrl(agent.avatar);
                                        if (isMounted) setAvatarUrl(url);
                                      } catch (error) {
                                        if (isMounted) {
                                          if (window.__TAURI__) {
                                            setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset'));
                                          } else {
                                            setAvatarUrl('/duck30.jpeg');
                                          }
                                        }
                                      }
                                    } else {
                                      if (isMounted) setAvatarUrl(getAvatarUrl(agent.avatar));
                                    }
                                  }

                                  loadAvatarUrl();
                                  return () => { isMounted = false; };
                                }, [agent.avatar]);

                                return avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt={agent.label}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                    }}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      if (window.__TAURI__) {
                                        target.src = convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset')
                                      } else {
                                        target.src = '/duck30.jpeg'
                                      }
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      background: `linear-gradient(135deg, ${agent.color}40, ${agent.color}20)`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '16px',
                                      fontWeight: 700,
                                      color: agent.color,
                                    }}
                                  >
                                    {agent.label.charAt(0).toUpperCase()}
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="flex w-full items-center justify-between">
                              <div className="flex w-full items-center gap-2 flex-1">
                                <TerminalActivityBar
                                  terminal={agent}
                                  chatSessions={chatSessions}
                                  hideBranch={true}  // Hide branch badge
                                  isActive={agent.id === activeId}
                                />
                              </div>

                              {/* Action buttons wrapper */}
                              <div
                                className="icons-wrapper"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  marginLeft: 'auto',
                                  gap: '4px',
                                }}
                              >
                                {/* Git Branch Icon - shown on hover */}
                                <div
                                  className="git-branch-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowGitMenu(showGitMenu === agent.id ? null : agent.id);
                                  }}
                                  style={{
                                    opacity: isHovered ? 1 : 0,  // FIXED: Now truly only shows on hover
                                    visibility: isHovered ? 'visible' : 'hidden',  // Double protection
                                    transition: 'opacity 0.2s ease, visibility 0.2s ease',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'transparent',
                                    pointerEvents: isHovered ? 'auto' : 'none',  // Prevent clicks when invisible
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.15)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  {/* SVG Git Branch Icon - Original from GitSidebar */}
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#4ecdc4"
                                    strokeWidth="2"
                                  >
                                    <line x1="6" y1="3" x2="6" y2="15" />
                                    <circle cx="18" cy="6" r="3" />
                                    <circle cx="6" cy="18" r="3" />
                                    <path d="M18 9a9 9 0 0 1-9 9" />
                                  </svg>
                                </div>

                                {/* Close button */}
                                <button
                                  type="button"
                                  className="terminal-close"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onClose(agent.id);
                                  }}
                                  style={{
                                    opacity: isHovered ? 1 : 0,
                                    transition: 'opacity 0.2s ease',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#e74c3c',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Git Operations Menu for Worktrees - High z-index dropdown */}
                          {showGitMenu === agent.id && (
                            <div
                              className="git-operations-menu"
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: '8px',
                                marginTop: '4px',
                                background: 'rgba(20, 22, 28, 0.98)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                                minWidth: '200px',
                                zIndex: 9999,
                                overflow: 'hidden',
                              }}
                            >
                              <div className="menu-items" style={{ padding: '4px' }}>
                                {/* Pull Latest */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('pull', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M8 12L4 8h3V2h2v6h3l-4 4zm-6 2h12v2H2v-2z"/>
                                  </svg>
                                  Pull latest
                                </button>

                                {/* Push to Remote */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('push', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M8 4L4 8h3v6h2V8h3L8 4zM2 2h12v2H2V2z"/>
                                  </svg>
                                  Push to remote
                                </button>

                                {/* Create PR */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('create-pr', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346z"/>
                                  </svg>
                                  Create PR
                                </button>

                                {/* Separator */}
                                <div style={{
                                  height: '1px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  margin: '4px 8px',
                                }} />

                                {/* View Commits */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('view-commits', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M10.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z"/>
                                  </svg>
                                  View commits
                                </button>

                                {/* Delete Worktree - only for worktrees */}
                                <div style={{
                                  height: '1px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  margin: '4px 8px',
                                }} />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('delete-worktree', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(231, 76, 60, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/>
                                  </svg>
                                  Delete worktree
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Commit History Modal */}
      {commitHistoryModal && (
        <CommitHistoryModal
          branchName={commitHistoryModal.branchName}
          rootPath={commitHistoryModal.rootPath}
          onClose={() => setCommitHistoryModal(null)}
        />
      )}
    </div>
  );
}