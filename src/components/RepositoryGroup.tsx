import {
  type MouseEvent,
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
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
  type DragMoveEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import TerminalActivityBar from "./TerminalActivityBar";
import CommitHistoryModal from "./CommitHistoryModal";
import RevealInFinderButton from "./RevealInFinderButton";
import AgentSessionList from "./AgentSessionList";
import NewSessionModal from "./NewSessionModal";
import {
  getCustomAvatarUrl,
  isCustomAvatar,
} from "../utils/customAvatarStorage";
import { useSessionStore } from "../stores/sessionStore";
import { useTeamStore } from "../stores/teamStore";
import TeamCreationModal from "./TeamCreationModal";
import TeamStatusBadge from "./TeamStatusBadge";
import { extractProjectId } from "../utils/projectUtils";
// import DragHandle from './DragHandle'; // 🦆 DISABLED - replaced with timestamp display
import type { TerminalInfo, ChatMessage, GitPullResult, KanbanStatus } from "../types";

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
  onOpenGitPanel?: () => void; // Function to open Git Panel drawer
  onOpenTerminalWindow?: (repoPath: string, repoName: string) => void; // Open terminal in Terminal Window
  gitRefreshTrigger?: number; // Trigger to refresh git status after commit
  onCreateAgent?: (projectPath: string) => void; // Create new agent associated with this project (passes project path)
  onRemoveProject?: (projectPath: string) => void; // Remove project from sidebar
  onOpenDashboard?: (projectPath: string, projectName: string) => void; // Open Project Dashboard tab
  onOpenClaudeAssets?: (projectPath: string) => void; // Open Claude Assets tab with project pre-selected
  // Kanban mode props
  isKanbanViewActive?: boolean;
  onToggleKanbanView?: () => void;
  // Chat loading state for task status indicators
  chatLoadingMap?: Map<string, boolean>;
  // Session props
  onSessionClick?: (sessionId: string) => void;
  activeSessionId?: string;
  /** Called when the active session is marked as done (to navigate back to agent view) */
  onActiveSessionDone?: () => void;
  // Open Agent Personality accordion
  onOpenPersonality?: () => void;
}

// Helper function to get avatar image URL (works in both dev and production)
function getAvatarUrl(avatarName: string): string {
  // Check if we're in Tauri context
  if (window.__TAURI__) {
    // In production, use convertFileSrc with the expected resource path
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, "asset");
  }
  // In dev mode, use standard public path
  return `/images/ducks/new-avatars/${avatarName}`;
}

// Helper to extract repository name from path
function getRepoDisplayName(path: string): string {
  const projectName = extractProjectId(path);
  // Handle worktree paths (e.g., "quack-app-worktree-feature-branch")
  if (projectName.includes("-worktree-")) {
    return projectName.split("-worktree-")[0];
  }
  return projectName;
}

// Helper to extract branch name from worktree path or terminal info
function getBranchName(terminal: TerminalInfo): string {
  if (terminal.branch) return terminal.branch;
  const lastPart = extractProjectId(terminal.cwd);
  if (lastPart.includes("-worktree-")) {
    const branchPart = lastPart.split("-worktree-")[1];
    return branchPart.replace(/-/g, "/");
  }
  return "main";
}

// 🦆 Helper to calculate relative time string
function getRelativeTimeString(
  timestamp: number,
): { value: string; unit: string; minutes: number } | null {
  if (!timestamp || timestamp === 0) return null;

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return { value: "<1", unit: "M", minutes: 0 };
  if (minutes < 60) return { value: String(minutes), unit: "M", minutes };
  if (hours < 24) return { value: String(hours), unit: "H", minutes };
  return { value: String(days), unit: "D", minutes };
}

// 🦆 Helper to calculate color opacity based on freshness
function getTimestampOpacity(minutes: number): number {
  // Fresh (0-3 min): white full opacity (1.0)
  if (minutes <= 3) return 1.0;

  // Recent (3-30 min): gradual fade from 1.0 to 0.4
  if (minutes <= 30) {
    const fadeProgress = (minutes - 3) / 27; // 0 to 1 over 27 minutes
    return 1.0 - fadeProgress * 0.6; // From 1.0 to 0.4
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
  chatLoadingMap?: Map<string, boolean>; // 🦆 SESSIONS-FIRST: Loading state for sessions
  onSelect: (terminal: TerminalInfo) => void;
  onClose: (id: string) => void;
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void;
  onGitMenuToggle: (agentId: string | null) => void;
  showGitMenu: boolean;
  handleGitOperation: (operation: string, terminal: TerminalInfo) => void;
  isWorktree?: boolean;
  isDraggingAny?: boolean;
  // Kanban mode props
  isKanbanViewActive?: boolean;
  onToggleKanbanView?: () => void;
  // New session button
  onNewSession?: (agentId: string) => void;
  // Open Agent Personality accordion
  onOpenPersonality?: () => void;
}

function SortableAgent({
  agent,
  isActive,
  chatSessions,
  lastReadTimestamps,
  chatLoadingMap,
  onSelect,
  onClose,
  onContextMenu,
  onGitMenuToggle,
  showGitMenu,
  handleGitOperation,
  isWorktree = false,
  isDraggingAny = false,
  isKanbanViewActive = false,
  onToggleKanbanView,
  onNewSession,
  onOpenPersonality,
}: SortableAgentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showQuackTooltip, setShowQuackTooltip] = useState(false);
  // 🦆 Force re-render every minute to update relative time
  const [tick, setTick] = useState(0);

  // 🦆 SESSIONS-FIRST: Get all sessions for this agent
  const { sessions: allSessions } = useSessionStore();
  const agentSessions = useMemo(
    () => allSessions.filter((s) => s.agentId === agent.id),
    [allSessions, agent.id],
  );

  // 🔵 FIX: Active sessions only (exclude "done") for notification badge calculations
  // Done sessions are archived and should NOT trigger "Quack quack..." badge
  const activeSessions = useMemo(
    () => agentSessions.filter((s) => s.status !== "done"),
    [agentSessions],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000); // Update every 60 seconds (1 minute)
    return () => clearInterval(interval);
  }, []);

  // NOTE: Quack tooltip logic moved AFTER showNotificationBadge is calculated (see below)

  // 🎨 Load avatar URL from agent.avatar
  useEffect(() => {
    let isMounted = true;

    async function loadAvatarUrl() {
      // If no avatar specified, use duck15.jpeg fallback
      if (!agent.avatar) {
        if (isMounted) {
          if (window.__TAURI__) {
            setAvatarUrl(
              convertFileSrc("/images/ducks/new-avatars/duck15.jpeg", "asset"),
            );
          } else {
            setAvatarUrl("/images/ducks/new-avatars/duck15.jpeg");
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
          console.error("Failed to load custom avatar:", error);
          if (isMounted) {
            // Fallback to duck15.jpeg if custom avatar fails
            if (window.__TAURI__) {
              setAvatarUrl(
                convertFileSrc(
                  "/images/ducks/new-avatars/duck15.jpeg",
                  "asset",
                ),
              );
            } else {
              setAvatarUrl("/images/ducks/new-avatars/duck15.jpeg");
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
  const style = useMemo(
    () => ({
      transform: transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
        : undefined,
      transition: isDragging ? "none" : transition,
      opacity: isDragging ? 0.5 : 1,
      willChange: isDragging ? "transform" : "auto",
    }),
    [transform, isDragging, transition],
  );

  // 🦆 SESSIONS-FIRST: Check if agent is dormant (no user interaction in ANY active session)
  // Agent is awake if ANY non-done session has at least one assistant response
  // 🔵 FIX: Uses activeSessions (excludes "done") so archived sessions don't prevent dormant state
  const isDormant = useMemo(() => {
    if (!chatSessions || activeSessions.length === 0) return true;

    // Check only ACTIVE (non-done) sessions for this agent
    for (const session of activeSessions) {
      const sessionMessages = chatSessions.get(session.id);
      if (!sessionMessages || sessionMessages.length === 0) continue;

      // Check if this session has at least one assistant message
      const hasAssistantMessage = sessionMessages.some(
        (msg) => msg.role === "assistant",
      );
      if (hasAssistantMessage) {
        return false; // Agent is AWAKE - at least one active session has assistant response
      }
    }

    return true; // No active sessions with assistant responses = dormant
  }, [chatSessions, activeSessions]);

  // 🦆 SESSIONS-FIRST: Check if ALL active sessions are empty (no messages)
  const isChatEmpty = useMemo(() => {
    if (!chatSessions || activeSessions.length === 0) return true;

    for (const session of activeSessions) {
      const sessionMessages = chatSessions.get(session.id);
      if (sessionMessages && sessionMessages.length > 0) {
        return false;
      }
    }

    return true;
  }, [chatSessions, activeSessions]);

  // 🦆 SESSIONS-FIRST: Check if ANY active session has unread messages (agent responded)
  const hasUnreadMessages = useMemo(() => {
    if (!chatSessions || isActive || isDormant) return false;

    for (const session of activeSessions) {
      const sessionMessages = chatSessions.get(session.id);
      if (!sessionMessages || sessionMessages.length === 0) continue;

      const lastAssistantMessage = [...sessionMessages]
        .reverse()
        .find((msg) => msg.role === "assistant");
      if (lastAssistantMessage) {
        return true;
      }
    }

    return false;
  }, [chatSessions, activeSessions, isActive, isDormant]);

  // 🦆 SESSIONS-FIRST: Get LATEST assistant message timestamp across ACTIVE sessions only
  // 🔵 FIX: Only considers non-done sessions to prevent badge from old archived responses
  const lastAssistantTimestamp = useMemo(() => {
    if (!chatSessions || activeSessions.length === 0) return 0;

    let latestTimestamp = 0;

    for (const session of activeSessions) {
      const sessionMessages = chatSessions.get(session.id);
      if (!sessionMessages || sessionMessages.length === 0) continue;

      const lastAssistantMessage = [...sessionMessages]
        .reverse()
        .find((msg) => msg.role === "assistant");
      if (lastAssistantMessage && lastAssistantMessage.timestamp) {
        latestTimestamp = Math.max(
          latestTimestamp,
          lastAssistantMessage.timestamp,
        );
      }
    }

    return latestTimestamp;
  }, [chatSessions, activeSessions]);

  // 🔵 Get last read timestamp for this agent
  const lastReadTimestamp = useMemo(() => {
    if (!lastReadTimestamps) return 0;
    return lastReadTimestamps.get(agent.id) || 0;
  }, [lastReadTimestamps, agent.id]);

  // Memoize agent card background style
  const agentCardBg = useMemo(() => {
    if (isActive) return `${agent.color}28`; // ~16% opacity - active state
    if (isHovered) return "rgba(255, 255, 255, 0.03)";
    return "transparent";
  }, [isActive, isHovered, agent.color]);

  // 🔵 Show notification badge dot when agent has NEW unread messages (read-once system)
  // Badge appears when: NOT active + has active sessions + agent responded AFTER last read
  // 🔵 FIX: Also checks that active sessions exist with complete assistant messages
  const showNotificationBadge = useMemo(() => {
    if (isActive || isDormant) return false; // No badge when active or dormant
    if (activeSessions.length === 0) return false; // No badge without active sessions

    // 🔵 TIMESTAMP COMPARISON: Badge shows ONLY if agent responded AFTER last read
    return lastAssistantTimestamp > lastReadTimestamp;
  }, [isActive, isDormant, activeSessions.length, lastAssistantTimestamp, lastReadTimestamp]);

  // 🦆 SESSIONS-FIRST: Aggregate status from ALL sessions for TerminalActivityBar
  // Status is 'busy' if ANY session is loading, 'idle' otherwise
  // 🦆 FIX: Use chatLoadingMap prop (memoization now includes this prop for re-renders)
  const aggregatedStatus = useMemo<"busy" | "idle">(() => {
    if (agentSessions.length === 0) {
      // Fallback to agent.status if no sessions
      return agent.status ?? "idle";
    }

    // Check if ANY session is currently loading
    for (const session of agentSessions) {
      if (chatLoadingMap?.get(session.id)) {
        return "busy"; // At least one session is loading
      }
    }

    return "idle";
  }, [agent.status, agentSessions, chatLoadingMap]);

  // 🦆 SESSIONS-FIRST: Check if ANY session is ready (waiting for user response)
  // This will show the 💬 badge in TerminalActivityBar
  const isAnySessionReady = useMemo(() => {
    if (!chatSessions || agentSessions.length === 0 || isDormant) return false;

    for (const session of agentSessions) {
      const sessionMessages = chatSessions.get(session.id);
      if (!sessionMessages || sessionMessages.length === 0) continue;

      const lastMessage = sessionMessages[sessionMessages.length - 1];
      if (
        lastMessage?.role === "assistant" &&
        (lastMessage.status === "complete" || lastMessage.status === undefined)
      ) {
        return true; // At least one session is ready
      }
    }

    return false;
  }, [chatSessions, agentSessions, isDormant]);

  // Create aggregated agent for TerminalActivityBar
  // 🦆 FIX: Include aggregatedIsDormant to override TerminalActivityBar's internal check
  // which uses terminal.id (wrong - sessions use session.id as key)
  const aggregatedAgent = useMemo(
    () => ({
      ...agent,
      status: aggregatedStatus,
      waitingForResponse: isAnySessionReady && !isActive,
      aggregatedIsDormant: isDormant, // Pass session-based dormant state
      aggregatedHasUnread: hasUnreadMessages, // Pass session-based unread state
    }),
    [
      agent,
      aggregatedStatus,
      isAnySessionReady,
      isActive,
      isDormant,
      hasUnreadMessages,
    ],
  );

  // Determine if conversation is active (not dormant)
  const hasActiveConversation = !isDormant && !isChatEmpty;
  const isBusy = aggregatedStatus === "busy";

  // Quack tooltip: show periodically when there are UNREAD messages AND agent is NOT busy
  // This ensures the tooltip only appears when the agent has finished responding
  useEffect(() => {
    // Only show tooltip when there's a notification badge AND agent is NOT busy (finished responding)
    if (!showNotificationBadge || isBusy) {
      setShowQuackTooltip(false);
      return;
    }

    // Show tooltip every 5 seconds for 2 seconds
    // Memory fix: track inner timeouts to cancel on cleanup
    let hideTimeout: ReturnType<typeof setTimeout>;
    const showInterval = setInterval(() => {
      setShowQuackTooltip(true);
      hideTimeout = setTimeout(() => setShowQuackTooltip(false), 2000);
    }, 5000);

    // Show immediately on first unread
    setShowQuackTooltip(true);
    const initialHideTimeout = setTimeout(() => setShowQuackTooltip(false), 2000);

    return () => {
      clearInterval(showInterval);
      clearTimeout(hideTimeout);
      clearTimeout(initialHideTimeout);
    };
  }, [showNotificationBadge, isBusy]);

  // Memoize metro station style - DYNAMIC based on notification state (MUST be after showNotificationBadge)
  const metroStationStyle = useMemo(
    () => ({
      width: "10px",
      height: "10px",
      transform: isWorktree ? "rotate(45deg)" : "none",
      borderRadius: isWorktree ? "0" : "50%",
      // 🎨 Dynamic background: FULL agent color when unread, TRANSPARENT when read
      background: showNotificationBadge ? agent.color : "transparent",
      // 🎨 Dynamic border: NO border when unread (full color), agent color BORDER when read
      border: showNotificationBadge ? "none" : `2px solid ${agent.color}66`, // 66 = ~40% opacity
      boxShadow: showNotificationBadge
        ? `0 0 8px ${agent.color}99, 0 0 12px ${agent.color}66`
        : "none",
      flexShrink: 0,
      transition: "all 0.3s ease",
    }),
    [isWorktree, showNotificationBadge, agent.color],
  );

  // 🦆 Track drag state to prevent click after drag
  const wasDraggedRef = useRef(false);

  // Memoize callbacks to prevent recreation
  const handleSelect = useCallback(() => {
    console.log('[RepositoryGroup] agent-card clicked, agent:', agent.label || agent.id);

    // Don't trigger click if we just finished dragging
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }

    // If in Kanban mode, set agent filter instead of exiting Kanban
    if (isKanbanViewActive) {
      // Import and use kanbanStore to set agent filter
      import("../stores/kanbanStore").then(({ useKanbanStore }) => {
        useKanbanStore.getState().setAgentFilter(agent.id);
        console.log(
          "[SortableAgent] Set Kanban filter to agent:",
          agent.label || agent.id,
        );
      });
    }
    onSelect(agent);

    // Open Agent Personality accordion in sidebar
    if (onOpenPersonality) {
      console.log('[RepositoryGroup] Opening Agent Personality accordion');
      onOpenPersonality();
    }
  }, [onSelect, agent, isKanbanViewActive, onOpenPersonality]);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => onContextMenu(e, agent),
    [onContextMenu, agent],
  );
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(agent.id);
    },
    [onClose, agent.id],
  );
  const handleGitMenuToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onGitMenuToggle(showGitMenu ? null : agent.id);
    },
    [onGitMenuToggle, showGitMenu, agent.id],
  );

  // Get relative time string with opacity - re-calculate on tick change
  const relativeTime = useMemo(
    () => getRelativeTimeString(lastAssistantTimestamp),
    [lastAssistantTimestamp, tick],
  );

  // Calculate opacity based on freshness
  const timestampOpacity = useMemo(() => {
    if (!relativeTime) return 0.4;
    return getTimestampOpacity(relativeTime.minutes);
  }, [relativeTime]);

  // Merge dnd-kit listeners but exclude icons-wrapper from drag initiation
  const mergedListeners = useMemo(() => {
    if (!listeners) return {};
    return {
      ...listeners,
      onPointerDown: (e: React.PointerEvent) => {
        // Don't start drag when clicking action buttons in icons-wrapper
        const target = e.target as HTMLElement;
        if (target.closest('.icons-wrapper')) return;
        listeners.onPointerDown?.(e);
      },
    };
  }, [listeners]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...mergedListeners}
      style={{
        ...style,
        marginBottom: "8px",
      }}
      className="group"
    >
      {/* Agent Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          position: "relative" as const,
        }}
      >
        {/* Agent Card - No left timing section */}
        <div
          className="agent-card flex items-center"
          onClick={handleSelect}
          onContextMenu={handleContextMenu}
          onMouseEnter={() => !isDraggingAny && setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            flex: 1,
            padding: "6px 10px",
            paddingLeft: "8px",
            marginTop: "4px",
            background: agentCardBg,
            borderRadius: "5px",
            cursor: "pointer",
            transition:
              "background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease",
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            minHeight: "36px",
            // Border with agent color (more visible when active)
            border: isActive
              ? `2px solid ${agent.color}`
              : `1px solid ${agent.color}55`,
            boxShadow: isActive ? `0 0 8px ${agent.color}40` : undefined,
            // Reduce opacity for dormant/empty agents
            opacity: isActive ? 1 : isChatEmpty || isDormant ? 0.7 : 1,
          }}
        >
          {/* 🎨 Avatar - Full height, squared with border-radius, with IMAGE */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "5px",
              border: `2px solid ${agent.color}66`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={agent.label}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  console.error(
                    "[RepositoryGroup] Image failed to load, using fallback duck15.jpeg:",
                    avatarUrl,
                  );
                  // Always fallback to duck15.jpeg on error
                  if (window.__TAURI__) {
                    target.src = convertFileSrc(
                      "/images/ducks/new-avatars/duck15.jpeg",
                      "asset",
                    );
                  } else {
                    target.src = "/images/ducks/new-avatars/duck15.jpeg";
                  }
                }}
              />
            ) : (
              // Fallback to letter while loading
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(135deg, ${agent.color}40, ${agent.color}20)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: agent.color,
                }}
              >
                {agent.label.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Unread message indicator with Quack tooltip (WhatsApp-style) */}
          {showNotificationBadge && (
            <div
              style={{
                position: "relative",
                marginLeft: "-4px",
                marginRight: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "18px",
                  animation: "quackBounce 1s ease-in-out infinite",
                }}
              >
                💬
              </span>
              {showQuackTooltip && (
                <div
                  style={{
                    position: "absolute",
                    top: "-28px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(255, 255, 255, 0.95)",
                    color: "#1a1a2e",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                    animation: "tooltipFadeIn 0.3s ease-out",
                    zIndex: 100,
                  }}
                >
                  Quack quack...
                </div>
              )}
            </div>
          )}

          <div className="flex w-full items-center justify-between">
            <div className="flex w-full items-center gap-2 flex-1">
              <TerminalActivityBar
                terminal={aggregatedAgent}
                chatSessions={chatSessions}
                hideBranch={true}
                isActive={isActive}
              />
            </div>

            {/* Action buttons */}
            <div
              className="icons-wrapper"
              style={{
                display: "flex",
                alignItems: "center",
                marginLeft: "auto",
                marginRight: "4px",
                gap: "0px",
              }}
            >
              {/* Add New Session Button */}
              {onNewSession && (
                <div
                  className="add-session-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewSession(agent.id);
                  }}
                  title="Add new Session/Task"
                  style={{
                    cursor: "pointer",
                    padding: "4px 4px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    color: agent.color || "#00D4FF",
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: 1,
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${agent.color || "#00D4FF"}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  +
                </div>
              )}

              {/* Close button */}
              <button
                type="button"
                className="terminal-close"
                onClick={handleClose}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#e74c3c",
                  cursor: "pointer",
                  fontSize: "18px",
                  padding: "4px 4px",
                  borderRadius: "4px",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(231, 76, 60, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
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
              position: "absolute",
              top: "100%",
              right: "8px",
              marginTop: "4px",
              background: "rgba(20, 22, 28, 0.98)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
              minWidth: "200px",
              zIndex: 9999,
              overflow: "hidden",
            }}
          >
            <div className="menu-items" style={{ padding: "4px" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGitOperation("pull", agent);
                  onGitMenuToggle(null);
                }}
                className="menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.9)",
                  fontSize: "13px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(78, 205, 196, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  opacity="0.7"
                >
                  <path d="M8 12L4 8h3V2h2v6h3l-4 4zm-6 2h12v2H2v-2z" />
                </svg>
                Pull latest
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGitOperation("push", agent);
                  onGitMenuToggle(null);
                }}
                className="menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.9)",
                  fontSize: "13px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(78, 205, 196, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  opacity="0.7"
                >
                  <path d="M8 4L4 8h3v6h2V8h3L8 4zM2 2h12v2H2V2z" />
                </svg>
                Push to remote
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGitOperation("create-pr", agent);
                  onGitMenuToggle(null);
                }}
                className="menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.9)",
                  fontSize: "13px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(78, 205, 196, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  opacity="0.7"
                >
                  <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346z" />
                </svg>
                Create PR
              </button>

              <div
                style={{
                  height: "1px",
                  background: "rgba(255, 255, 255, 0.1)",
                  margin: "4px 8px",
                }}
              />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGitOperation("view-commits", agent);
                  onGitMenuToggle(null);
                }}
                className="menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.9)",
                  fontSize: "13px",
                  cursor: "pointer",
                  borderRadius: "4px",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(78, 205, 196, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  opacity="0.7"
                >
                  <path d="M10.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z" />
                </svg>
                View commits
              </button>

              {isWorktree && (
                <>
                  <div
                    style={{
                      height: "1px",
                      background: "rgba(255, 255, 255, 0.1)",
                      margin: "4px 8px",
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGitOperation("delete-worktree", agent);
                      onGitMenuToggle(null);
                    }}
                    className="menu-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      width: "100%",
                      padding: "10px 12px",
                      background: "transparent",
                      border: "none",
                      color: "rgba(231, 76, 60, 0.9)",
                      fontSize: "13px",
                      cursor: "pointer",
                      borderRadius: "4px",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(231, 76, 60, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      opacity="0.7"
                    >
                      <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
                    </svg>
                    Delete worktree
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {/* End of Agent Row */}
    </div>
  );
}

// Memoize SortableAgent with custom comparison to prevent unnecessary re-renders during drag
const MemoizedSortableAgent = memo(SortableAgent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  // 🦆 FIX: Include chatLoadingMap to ensure re-render when loading state changes
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
    prevProps.lastReadTimestamps === nextProps.lastReadTimestamps &&
    prevProps.chatLoadingMap === nextProps.chatLoadingMap &&
    prevProps.isKanbanViewActive === nextProps.isKanbanViewActive &&
    prevProps.onToggleKanbanView === nextProps.onToggleKanbanView
  );
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
  onOpenTerminalWindow,
  gitRefreshTrigger,
  onCreateAgent,
  onRemoveProject,
  onOpenDashboard,
  onOpenClaudeAssets,
  isKanbanViewActive = false,
  onToggleKanbanView,
  chatLoadingMap,
  onSessionClick,
  activeSessionId,
  onActiveSessionDone,
  onOpenPersonality,
}: RepositoryGroupProps) {
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [showGitMenu, setShowGitMenu] = useState<string | null>(null);
  const [commitHistoryModal, setCommitHistoryModal] = useState<{
    branchName: string;
    rootPath: string;
  } | null>(null);
  const [branchModifiedFiles, setBranchModifiedFiles] = useState<
    Map<string, number>
  >(new Map());
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [agentOrder, setAgentOrder] = useState<Record<string, string[]>>({});
  const renderedOrderRef = useRef<Map<string, string[]>>(new Map());
  // Cross-boundary drag state (drag agent to Kanban)
  const [crossBoundaryIntent, setCrossBoundaryIntent] = useState(false);
  const crossBoundaryRef = useRef(false);
  // Pointer position for custom drag overlay (portal-based, escapes sidebar overflow)
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  // New session modal state
  const [newSessionModalAgentId, setNewSessionModalAgentId] = useState<
    string | null
  >(null);
  const displayName = getRepoDisplayName(repoName);
  const isDraggingAny = activeAgentId !== null;

  // Team state
  const [showTeamModal, setShowTeamModal] = useState(false);
  const activeTeam = useTeamStore((s) => s.activeTeam);
  const loadActiveTeam = useTeamStore((s) => s.loadActiveTeam);

  // Build avatar map from agents for team enrichment (stable ref, called on demand)
  const buildAgentAvatarMap = useCallback(() => {
    const map = new Map<string, { avatar?: string; color?: string }>();
    for (const agent of [...mainAgents, ...worktreeAgents]) {
      map.set(agent.id, { avatar: agent.avatar, color: agent.color });
    }
    return map;
  }, [mainAgents, worktreeAgents]);

  // Load active team on mount / repoPath change, and re-enrich when agents become available
  const buildAgentAvatarMapRef = useRef(buildAgentAvatarMap);
  buildAgentAvatarMapRef.current = buildAgentAvatarMap;
  const agentCount = mainAgents.length + worktreeAgents.length;
  const hasEnrichedRef = useRef(false);

  useEffect(() => {
    hasEnrichedRef.current = false;
    loadActiveTeam(repoPath, buildAgentAvatarMapRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  // Re-enrich team avatars once agents are loaded (fixes race condition on startup)
  useEffect(() => {
    if (agentCount > 0 && !hasEnrichedRef.current) {
      hasEnrichedRef.current = true;
      loadActiveTeam(repoPath, buildAgentAvatarMapRef.current());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentCount]);

  // 🦆 SESSIONS-FIRST: Get all sessions for aggregated status calculation
  const { sessions: allSessionsForRepo, createSession } = useSessionStore();

  // Cleanup: Ensure dragging class is removed on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove("dragging-active");
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
    useSensor(KeyboardSensor),
  );

  // Load saved agent order on mount
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const store = await Store.load(".quack-agent-order.dat");
        const savedOrder = await store.get<Record<string, string[]>>(
          `agent-order-${repoPath}`,
        );
        if (savedOrder) {
          setAgentOrder(savedOrder);
        }
      } catch (error) {
        console.error("Failed to load agent order:", error);
      }
    };
    loadOrder();
  }, [repoPath]);

  // Save agent order when it changes
  const saveOrder = useCallback(
    async (order: Record<string, string[]>) => {
      try {
        const store = await Store.load(".quack-agent-order.dat");
        await store.set(`agent-order-${repoPath}`, order);
        await store.save();
      } catch (error) {
        console.error("Failed to save agent order:", error);
      }
    },
    [repoPath],
  );

  // Handle new session creation from agent card button
  const handleNewSession = useCallback(
    async (title: string, branch?: string, useWorktree?: boolean) => {
      if (!newSessionModalAgentId) return;

      // Find agent to get project info
      const agent = [...mainAgents, ...worktreeAgents].find(
        (a) => a.id === newSessionModalAgentId,
      );
      if (!agent) return;

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
              console.log(`[RepositoryGroup] Reusing existing worktree at ${worktreePath} for branch ${branch}`);
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

              console.log(`[RepositoryGroup] Worktree created at ${worktreePath} for branch ${branch}`);
            }
          } else if (!branchExists) {
            // Create new branch without worktree (switch to it in main repo)
            await invoke('git_create_branch', {
              branchName: branch,
              fromBranch: null,
              switch: true,
              rootPath: agent.cwd,
            });
            console.log(`[RepositoryGroup] Created and switched to new branch ${branch}`);
          } else {
            // Existing branch, no worktree — switch to it
            await invoke('git_switch_branch', {
              branchName: branch,
              rootPath: agent.cwd,
            });
            console.log(`[RepositoryGroup] Switched to existing branch ${branch}`);
          }
        }

        const newSession = await createSession({
          title,
          agentId: newSessionModalAgentId,
          projectPath: agent.cwd,
          projectName: displayName,
          status: "todo",
          messageCount: 0,
          branch,
          useWorktree,
          worktreePath,
        });

        // Close modal and open the new session
        setNewSessionModalAgentId(null);
        if (onSessionClick) {
          onSessionClick(newSession.id);
        }
      } catch (error) {
        console.error("[RepositoryGroup] Failed to create session:", error);
      }
    },
    [
      newSessionModalAgentId,
      mainAgents,
      worktreeAgents,
      displayName,
      createSession,
      onSessionClick,
    ],
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    console.log("[DnD] dragStart - agent:", event.active.id);
    setActiveAgentId(String(event.active.id));
    // Add class to disable animations for performance
    document.body.classList.add("dragging-active");
  };

  // Handle drag move - track pointer + detect cross-boundary drag toward Kanban
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const activatorEvent = event.activatorEvent as PointerEvent;
    const currentX = activatorEvent.clientX + event.delta.x;
    const currentY = activatorEvent.clientY + event.delta.y;

    // Always track pointer for the portal-based overlay
    setDragPointer({ x: currentX, y: currentY });

    if (!isKanbanViewActive) return;

    // Find the sidebar element for boundary detection
    const sidebarEl = document.querySelector('.sidebar');
    if (!sidebarEl) return;

    const sidebarRect = sidebarEl.getBoundingClientRect();

    // 20px buffer to avoid accidental triggers
    const isBeyond = currentX > sidebarRect.right + 20;
    crossBoundaryRef.current = isBeyond;
    setCrossBoundaryIntent(isBeyond);

    // Detect which Kanban column the pointer is over
    import("../stores/kanbanStore").then(({ useKanbanStore }) => {
      const store = useKanbanStore.getState();
      if (!isBeyond) {
        if (store.sidebarDragHoverColumn !== null) {
          store.setSidebarDragHoverColumn(null);
          store.setSidebarDragAgentInfo(null);
        }
        return;
      }

      // Find which column element the pointer is over
      const columns = document.querySelectorAll('.kanban-column');
      let hoveredColumn: string | null = null;
      columns.forEach((col) => {
        const rect = col.getBoundingClientRect();
        if (currentX >= rect.left && currentX <= rect.right &&
            currentY >= rect.top && currentY <= rect.bottom) {
          // Extract column id from the droppable data
          const colId = col.getAttribute('data-column-id');
          if (colId) hoveredColumn = colId;
        }
      });

      if (store.sidebarDragHoverColumn !== hoveredColumn) {
        store.setSidebarDragHoverColumn(hoveredColumn as KanbanStatus | null);
      }

      // Set agent info if not already set
      if (!store.sidebarDragAgentInfo) {
        const agentId = String(event.active.id);
        const agent = [...mainAgents, ...worktreeAgents].find(
          (a) => a.id === agentId,
        );
        if (agent) {
          store.setSidebarDragAgentInfo({
            name: agent.label,
            color: agent.color,
          });
        }
      }
    });
  }, [isKanbanViewActive, mainAgents, worktreeAgents]);

  // Handle drag end - uses renderedOrderRef to avoid stale closure issues
  const handleDragEnd = (event: DragEndEvent) => {
    document.body.classList.remove("dragging-active");
    setDragPointer(null);

    const { active, over } = event;
    console.log("[DnD] dragEnd - active:", active.id, "over:", over?.id);

    // Always reset sidebar drag state in store
    import("../stores/kanbanStore").then(({ useKanbanStore }) => {
      const store = useKanbanStore.getState();
      if (store.sidebarDragHoverColumn !== null) {
        store.setSidebarDragHoverColumn(null);
      }
      if (store.sidebarDragAgentInfo !== null) {
        store.setSidebarDragAgentInfo(null);
      }
    });

    // Check if this was a cross-boundary drag (intent to create Kanban task)
    if (crossBoundaryRef.current && isKanbanViewActive) {
      const agentId = String(active.id);
      import("../stores/kanbanStore").then(({ useKanbanStore }) => {
        useKanbanStore.getState().requestAgentDrop(agentId);
      });
      console.log("[DnD] Cross-boundary drag → Kanban task for:", agentId);
      setActiveAgentId(null);
      crossBoundaryRef.current = false;
      setCrossBoundaryIntent(false);
      return;
    }

    // Reset cross-boundary state
    crossBoundaryRef.current = false;
    setCrossBoundaryIntent(false);

    if (!over || active.id === over.id) {
      setActiveAgentId(null);
      return;
    }

    // Find which branch contains both agents by checking rendered order
    let targetBranch: string | null = null;
    let currentIds: string[] = [];

    for (const [branch, ids] of renderedOrderRef.current.entries()) {
      if (ids.includes(String(active.id)) && ids.includes(String(over.id))) {
        targetBranch = branch;
        currentIds = ids;
        break;
      }
    }

    if (!targetBranch || currentIds.length === 0) {
      console.warn("[DnD] Could not find branch containing both agents");
      setActiveAgentId(null);
      return;
    }

    const oldIndex = currentIds.indexOf(String(active.id));
    const newIndex = currentIds.indexOf(String(over.id));

    console.log("[DnD] branch:", targetBranch, "oldIndex:", oldIndex, "newIndex:", newIndex);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(currentIds, oldIndex, newIndex);
      const orderKey = `${targetBranch}-main`;
      const updatedOrder = { ...agentOrder, [orderKey]: newOrder };
      setAgentOrder(updatedOrder);
      saveOrder(updatedOrder);
      console.log("[DnD] Order saved:", orderKey, newOrder);
    }

    setActiveAgentId(null);
  };

  // Get last ASSISTANT message timestamp for an agent
  const getLastAssistantTimestamp = useCallback(
    (agent: TerminalInfo): number => {
      if (!chatSessions) return 0;
      const messages = chatSessions.get(agent.id);
      if (!messages || messages.length === 0) return 0;

      const lastAssistantMsg = [...messages]
        .reverse()
        .find((msg) => msg.role === "assistant");

      return lastAssistantMsg?.timestamp ?? 0;
    },
    [chatSessions],
  );

  // Sort agents by timestamp - most recent assistant response first
  const sortByTimestamp = useCallback(
    (agents: TerminalInfo[]): TerminalInfo[] => {
      return [...agents].sort((a, b) => {
        const tsA = getLastAssistantTimestamp(a);
        const tsB = getLastAssistantTimestamp(b);

        if (tsA > 0 && tsB > 0) return tsB - tsA;
        if (tsA > 0) return -1;
        if (tsB > 0) return 1;
        return 0;
      });
    },
    [getLastAssistantTimestamp],
  );

  // Apply saved manual drag order if exists, otherwise fall back to timestamp sort
  const applyCustomOrder = useCallback(
    (agents: TerminalInfo[], branchName: string) => {
      const orderKey = `${branchName}-main`;
      const savedOrder = agentOrder[orderKey];

      // No manual order saved — fall back to timestamp sorting
      if (!savedOrder || savedOrder.length === 0) {
        return sortByTimestamp(agents);
      }

      // Split agents into those in saved order vs new ones
      const agentMap = new Map(agents.map((a) => [a.id, a]));
      const ordered: TerminalInfo[] = [];

      for (const id of savedOrder) {
        const agent = agentMap.get(id);
        if (agent) {
          ordered.push(agent);
          agentMap.delete(id);
        }
      }

      // Append NEW agents (not in saved order), sorted by timestamp
      const newAgents = sortByTimestamp([...agentMap.values()]);
      return [...ordered, ...newAgents];
    },
    [agentOrder, sortByTimestamp],
  );

  // Helper to generate PR URL - Memoized for performance
  const generatePRUrl = useCallback(
    async (rootPath: string, branchName: string): Promise<string | null> => {
      try {
        const remoteUrl = await invoke<string>("git_get_remote_url", {
          rootPath,
        });

        if (remoteUrl.includes("github.com")) {
          const match = remoteUrl.match(
            /github\.com[:/]([^/]+)\/(.+?)(\.git)?$/,
          );
          if (match) {
            const [, owner, repo] = match;
            return `https://github.com/${owner}/${repo}/compare/${branchName}?expand=1`;
          }
        } else if (remoteUrl.includes("gitlab.com")) {
          const match = remoteUrl.match(
            /gitlab\.com[:/]([^/]+)\/(.+?)(\.git)?$/,
          );
          if (match) {
            const [, owner, repo] = match;
            return `https://gitlab.com/${owner}/${repo}/-/merge_requests/new?merge_request[source_branch]=${branchName}`;
          }
        }

        return null;
      } catch (error) {
        console.error("Failed to generate PR URL:", error);
        return null;
      }
    },
    [],
  );

  // Fetch git status for the ACTIVE terminal's branch ONLY - Memoized for performance
  const fetchActiveTerminalGitStatus = useCallback(async () => {
    if (!activeId) {
      // No active terminal, clear badge
      setBranchModifiedFiles(new Map());
      return;
    }

    // Find the active terminal from main agents or worktrees
    const activeTerminal = [...mainAgents, ...worktreeAgents].find(
      (a) => a.id === activeId,
    );
    if (!activeTerminal) {
      setBranchModifiedFiles(new Map());
      return;
    }

    const branchName = activeTerminal.branch || getBranchName(activeTerminal);
    const rootPath = activeTerminal.worktreePath || activeTerminal.cwd;

    try {
      // Fetch ONLY for the active terminal's branch
      const count = await invoke<number>("git_uncommitted_files_count", {
        rootPath,
      });
      // Store ONLY this branch in the map - badge will show only here!
      setBranchModifiedFiles(new Map([[branchName, count]]));
    } catch (error) {
      console.error(`Failed to fetch git status for active terminal:`, error);
      setBranchModifiedFiles(new Map([[branchName, 0]]));
    }
  }, [activeId, mainAgents, worktreeAgents]);

  // Intelligent Git Operations Handler - Memoized for performance
  const handleGitOperation = useCallback(
    async (operation: string, terminal: TerminalInfo) => {
      const rootPath = terminal.worktreePath || terminal.cwd;
      const branchName = terminal.branch || "main";

      try {
        // Operations that need uncommitted changes check
        const needsCheck = ["pull", "push", "merge-to-main"];

        if (needsCheck.includes(operation)) {
          // Check for uncommitted changes
          const hasUncommitted = await invoke<boolean>(
            "git_has_uncommitted_changes",
            { rootPath },
          );

          if (hasUncommitted) {
            // Show alert and ask to open Git Panel
            const userConfirmed = window.confirm(
              `⚠️ Modifiche Non Committate\n\n` +
                `Hai modifiche non committate nel branch "${branchName}".\n\n` +
                `Vuoi aprire il Git Panel per committare le modifiche prima di procedere?`,
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
          case "pull": {
            const result = await invoke<GitPullResult>("git_pull", {
              branchName,
              rootPath,
            });

            if (result.hasConflicts) {
              alert(
                `Pull has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join("\n")}`,
              );
            } else {
              console.log(`✅ Pull successful: ${result.message}`);
            }
            break;
          }

          case "push": {
            const result = await invoke<string>("git_push", {
              branchName,
              force: false,
              rootPath,
            });
            console.log(`✅ Push successful: ${result}`);
            break;
          }

          case "merge-to-main": {
            const confirmed = window.confirm(
              `Vuoi mergeare il branch "${branchName}" in main?\n\n` +
                `Questa operazione:\n` +
                `1. Switcha a main\n` +
                `2. Mergia ${branchName} in main\n\n` +
                `Continua?`,
            );

            if (!confirmed) return;

            await invoke("git_switch_branch", {
              branchName: "main",
              rootPath,
            });

            const result = await invoke<{
              success: boolean;
              hasConflicts: boolean;
              conflictedFiles: string[];
              message: string;
            }>("git_merge_branch", {
              branchName,
              rootPath,
            });

            if (result.hasConflicts) {
              alert(
                `Merge has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join("\n")}`,
              );
            } else {
              console.log(`✅ Merge successful: ${result.message}`);
            }
            break;
          }

          case "create-pr": {
            const prUrl = await generatePRUrl(rootPath, branchName);
            if (prUrl) {
              window.open(prUrl, "_blank");
            } else {
              alert(
                "Could not generate PR URL. Make sure the repository has a remote configured.",
              );
            }
            break;
          }

          case "view-commits": {
            setCommitHistoryModal({
              branchName,
              rootPath,
            });
            break;
          }

          case "delete-worktree": {
            const confirmed = window.confirm(
              `Sei sicuro di voler eliminare il worktree per "${branchName}"?\n\n` +
                `Questo rimuoverà:\n` +
                `- ${rootPath}\n\n` +
                `Il branch continuerà ad esistere nel repository.`,
            );

            if (confirmed) {
              await invoke("git_remove_worktree", {
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
    },
    [
      onOpenGitPanel,
      onClose,
      setCommitHistoryModal,
      generatePRUrl,
      fetchActiveTerminalGitStatus,
    ],
  );

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
  }, [
    activeId,
    mainAgents,
    worktreeAgents,
    gitRefreshTrigger,
    activeAgentId,
    fetchActiveTerminalGitStatus,
  ]);

  // Group and sort agents by branch - Memoized for performance
  const sortedBranches = useMemo(() => {
    const agentsByBranch = new Map<string, TerminalInfo[]>();

    // Process main repository agents
    mainAgents.forEach((agent) => {
      const branchName = agent.branch || "main";
      if (!agentsByBranch.has(branchName)) {
        agentsByBranch.set(branchName, []);
      }
      agentsByBranch.get(branchName)!.push(agent);
    });

    // Sort branches: main first, then others alphabetically
    return Array.from(agentsByBranch.entries()).sort(([a], [b]) => {
      if (a === "main") return -1;
      if (b === "main") return 1;
      return a.localeCompare(b);
    });
  }, [mainAgents]);

  return (
    <div className="repository-group">
      {/* Repository Header - Minimal and clean */}
      <div
        className="repository-header"
        style={{
          padding: "10px 12px",
          marginBottom: "8px",
          background: "rgba(255, 255, 255, 0.02)",
          borderRadius: "6px",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
        }}
      >
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center gap-2">
            {/* Chevron - click to toggle collapse */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              style={{
                background: "none",
                border: "none",
                padding: "2px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
              }}
              title={isCollapsed ? "Expand" : "Collapse"}
              className="hover:bg-white/10"
            >
              <svg
                className={`w-4 h-4 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            {/* Project name - click to open Claude Assets */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenClaudeAssets) {
                  onOpenClaudeAssets(repoPath);
                } else {
                  onToggle();
                }
              }}
              style={{ cursor: "pointer" }}
              className="font-semibold text-sm text-white/90 hover:text-orange-400 transition-colors"
              title="Open Project Assets"
            >
              {displayName}
            </span>
          </div>

          {/* Action buttons - hidden by default, revealed on hover */}
          <div
            className="repo-action-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              paddingLeft: "24px",
              maxHeight: 0,
              overflow: "hidden",
              opacity: 0,
              transition: "max-height 0.2s ease, opacity 0.15s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Copy Path button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(repoPath);
                  toast.success("Path copied");
                } catch (err) {
                  console.error("Failed to copy path:", err);
                  toast.error("Failed to copy path");
                }
              }}
              title="Copy path to clipboard"
              className="repo-action-btn"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            {/* Open Terminal Window button */}
            {onOpenTerminalWindow && (
              <button
                type="button"
                onClick={() => onOpenTerminalWindow(repoPath, repoName)}
                title="Open in Terminal Window"
                className="repo-action-btn"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </button>
            )}
            {/* Reveal in Finder button */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await invoke("reveal_in_finder", { path: repoPath });
                } catch (err) {
                  console.error("Failed to reveal in Finder:", err);
                  toast.error(`Failed to reveal in Finder: ${err}`);
                }
              }}
              title="Reveal in Finder"
              className="repo-action-btn"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2Z" />
              </svg>
            </button>
            {/* Create Team button (only when Agent Teams feature is enabled) */}
            {mainAgents.length >= 2 && !activeTeam && (
              <button
                type="button"
                onClick={() => setShowTeamModal(true)}
                title="Create Agent Team"
                className="repo-action-btn"
                style={{ color: "rgba(255, 107, 53, 0.7)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>
            )}
            {/* New Agent button */}
            {onCreateAgent && (
              <button
                type="button"
                onClick={() => onCreateAgent(repoPath)}
                title="New Agent"
                className="repo-action-btn"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
            {/* Remove Project button */}
            {onRemoveProject && (
              <button
                type="button"
                onClick={() => onRemoveProject(repoPath)}
                title="Remove Project"
                className="repo-action-btn"
                style={{ color: "rgba(255, 255, 255, 0.35)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {activeTeam && activeTeam.projectPath === repoPath && (
          <div style={{ marginTop: '4px', paddingLeft: '28px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setShowTeamModal(true); }}
              title="Edit team"
            >
              <TeamStatusBadge team={activeTeam} />
            </div>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                if (window.confirm(`Disband team "${activeTeam.name}"?`)) {
                  try {
                    await useTeamStore.getState().disbandTeam(repoPath, activeTeam.id);
                    await loadActiveTeam(repoPath, buildAgentAvatarMap());
                  } catch (err) {
                    console.error('Failed to disband team:', err);
                  }
                }
              }}
              title="Disband team"
              style={{
                background: 'none',
                border: 'none',
                padding: '1px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '3px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(239, 68, 68, 0.8)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.3)'; }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Expanded Content with Metro Map Design */}
      {!isCollapsed && (
        <div
          className="repository-content relative"
          style={{ position: "relative" }}
        >
          {/* SINGLE CONTINUOUS LINE for entire repository */}
          <div
            className="continuous-metro-line"
            style={{
              position: "absolute",
              left: "20px",
              top: "40px", // Start from first agent position
              bottom: "0",
              width: "2px",
              background:
                mainAgents[0]?.color || worktreeAgents[0]?.color || "#10b981",
              opacity: 0.3,
              zIndex: 1,
            }}
          />

          {/* Branch Groups with DnD Context */}
          <DndContext
            sensors={sensors}
            collisionDetection={isKanbanViewActive ? () => [] : closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            {sortedBranches.map(([branchName, agents]) => {
              const orderedAgents = applyCustomOrder(agents, branchName);
              // Track rendered order for drag handler
              renderedOrderRef.current.set(branchName, orderedAgents.map(a => a.id));

              return (
                <div
                  key={branchName}
                  className="branch-group relative"
                  style={{ marginBottom: "24px" }}
                >
                  {/* Branch is now shown per-session, not per-agent group */}

                  {/* Agents in this branch with Sortable Context */}
                  <SortableContext
                    items={orderedAgents.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderedAgents.map((agent) => (
                      <div key={agent.id} className="agent-with-sessions">
                        <MemoizedSortableAgent
                          agent={agent}
                          isActive={agent.id === activeId}
                          chatSessions={chatSessions}
                          lastReadTimestamps={lastReadTimestamps}
                          chatLoadingMap={chatLoadingMap}
                          onSelect={onSelect}
                          onClose={onClose}
                          onContextMenu={onContextMenu}
                          onGitMenuToggle={setShowGitMenu}
                          showGitMenu={showGitMenu === agent.id}
                          handleGitOperation={handleGitOperation}
                          isWorktree={false}
                          isDraggingAny={isDraggingAny}
                          isKanbanViewActive={isKanbanViewActive}
                          onToggleKanbanView={onToggleKanbanView}
                          onNewSession={
                            onSessionClick
                              ? setNewSessionModalAgentId
                              : undefined
                          }
                          onOpenPersonality={onOpenPersonality}
                        />
                        {/* Sessions under this agent - always visible - with metro line */}
                        {onSessionClick && (
                          <div
                            className="agent-sessions-container"
                            style={
                              {
                                marginLeft: "8px",
                                marginTop: "4px",
                                position: "relative",
                                paddingLeft: "20px", // Space for metro line
                                // Pass agent color for pulse animations
                                "--agent-color": agent.color,
                              } as React.CSSProperties
                            }
                          >
                            {/* Metro line connecting agent to sessions */}
                            <div
                              className="metro-line-agent-sessions"
                              style={{
                                position: "absolute",
                                left: "8px",
                                top: "-4px", // Extend up to connect with agent card
                                bottom: "22px", // Stop at center of last session's horizontal connector
                                width: "2px",
                                background: agent.color,
                                opacity: 0.4,
                                borderRadius: "1px",
                                color: agent.color, // For currentColor in CSS animations
                              }}
                            />
                            <AgentSessionList
                              agentId={agent.id}
                              agentColor={agent.color}
                              agentBranch={agent.branch}
                              onSessionClick={onSessionClick}
                              activeSessionId={activeSessionId}
                              onActiveSessionDone={onActiveSessionDone}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </SortableContext>
                </div>
              );
            })}

            {/* DragOverlay kept for dnd-kit measuring (hidden) */}
            <DragOverlay dropAnimation={null}>
              {activeAgentId ? <div style={{ opacity: 0 }} /> : null}
            </DragOverlay>
          </DndContext>

          {/* Portal-based drag overlay - escapes sidebar overflow:hidden */}
          {activeAgentId && dragPointer && createPortal(
            (() => {
              const agent = [...mainAgents, ...worktreeAgents].find(
                (a) => a.id === activeAgentId,
              );
              if (!agent) return null;
              return (
                <div
                  style={{
                    position: "fixed",
                    left: dragPointer.x + 12,
                    top: dragPointer.y - 16,
                    padding: "8px 12px",
                    background: crossBoundaryIntent
                      ? `${agent.color}40`
                      : `${agent.color}25`,
                    border: crossBoundaryIntent
                      ? `2px solid ${agent.color}`
                      : `2px dashed ${agent.color}`,
                    borderRadius: "6px",
                    boxShadow: crossBoundaryIntent
                      ? `0 8px 32px ${agent.color}60, 0 0 60px ${agent.color}40`
                      : `0 8px 24px ${agent.color}40, 0 0 40px ${agent.color}30`,
                    pointerEvents: "none",
                    opacity: crossBoundaryIntent ? 0.95 : 0.8,
                    transition: "background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease",
                    zIndex: 99999,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: agent.color,
                        opacity: 0.6,
                      }}
                    />
                    <span className="font-semibold text-sm text-white/90">
                      {agent.label}
                    </span>
                    {crossBoundaryIntent && (
                      <span style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.7)",
                        marginLeft: "4px",
                      }}>
                        + New Task
                      </span>
                    )}
                  </div>
                </div>
              );
            })(),
            document.body,
          )}

          {/* Worktree Section - Separate section for worktrees */}
          {worktreeAgents.length > 0 && (
            <div
              className="worktree-section"
              style={{
                marginTop: "32px",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
              }}
            >
              {/* WORKTREES Label */}
              <div
                className="text-xs font-medium text-white/30 uppercase tracking-widest mb-4"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  marginLeft: "32px",
                }}
              >
                WORKTREES
              </div>

              {/* Group worktree agents by branch */}
              {(() => {
                const worktreeByBranch = new Map<string, TerminalInfo[]>();
                worktreeAgents.forEach((agent) => {
                  const branchName = getBranchName(agent);
                  if (!worktreeByBranch.has(branchName)) {
                    worktreeByBranch.set(branchName, []);
                  }
                  worktreeByBranch.get(branchName)!.push(agent);
                });

                return Array.from(worktreeByBranch.entries()).map(
                  ([branchName, agents]) => (
                    <div
                      key={`worktree-${branchName}`}
                      className="branch-group relative"
                      style={{ marginBottom: "24px" }}
                    >
                      {/* Branch is now shown per-session, not per-agent group */}

                      {/* Worktree Agents */}
                      {agents.map((agent) => {
                        const isActive = agent.id === activeId;
                        const isHovered = agent.id === hoveredAgentId;

                        // State for worktree tooltip (using inline hook)
                        const [
                          showQuackTooltipWorktree,
                          setShowQuackTooltipWorktree,
                        ] = useState(false);

                        // Quack tooltip: show periodically when there are UNREAD messages (like WhatsApp notification)
                        // NOTE: This useEffect must be AFTER showNotificationBadge is calculated below
                        // We move the actual useEffect logic below after showNotificationBadge is defined

                        // Check if chat is empty (no messages) - same logic as TerminalActivityBar
                        const isChatEmpty = (() => {
                          if (!chatSessions) return true;
                          const messages = chatSessions.get(agent.id);
                          return !messages || messages.length === 0;
                        })();

                        // 🔵 FIX: Filter to active (non-done) sessions only for badge calculations
                        const activeSessionsWorktree =
                          allSessionsForRepo.filter(
                            (s) => s.agentId === agent.id && s.status !== "done",
                          );

                        // 🦆 FIX: Check if agent is dormant based on ACTIVE SESSIONS only
                        const isDormantWorktree = (() => {
                          if (!chatSessions) return true;
                          if (activeSessionsWorktree.length === 0) return true;

                          for (const session of activeSessionsWorktree) {
                            const sessionMessages = chatSessions.get(
                              session.id,
                            );
                            if (
                              sessionMessages &&
                              sessionMessages.some(
                                (msg) => msg.role === "assistant",
                              )
                            ) {
                              return false;
                            }
                          }
                          return true;
                        })();
                        const isDormant = isDormantWorktree;

                        // 🦆 FIX: Check if agent has unread messages based on ACTIVE SESSIONS
                        const hasUnreadMessagesWorktree = (() => {
                          if (!chatSessions || isActive) return false;
                          if (activeSessionsWorktree.length === 0) return false;
                          if (isDormantWorktree) return false;

                          for (const session of activeSessionsWorktree) {
                            const sessionMessages = chatSessions.get(
                              session.id,
                            );
                            if (sessionMessages && sessionMessages.length > 0) {
                              const lastMsg =
                                sessionMessages[sessionMessages.length - 1];
                              if (
                                lastMsg.role === "assistant" &&
                                (lastMsg.status === "complete" ||
                                  !lastMsg.status)
                              ) {
                                return true;
                              }
                            }
                          }
                          return false;
                        })();

                        // 🔵 FIX: Calculate last assistant timestamp from ACTIVE sessions only
                        const lastAssistantTimestamp = (() => {
                          if (!chatSessions || activeSessionsWorktree.length === 0) return 0;
                          let latest = 0;
                          for (const session of activeSessionsWorktree) {
                            const sessionMessages = chatSessions.get(session.id);
                            if (!sessionMessages || sessionMessages.length === 0) continue;
                            const lastAssistantMsg = [...sessionMessages]
                              .reverse()
                              .find((msg) => msg.role === "assistant");
                            if (lastAssistantMsg?.timestamp) {
                              latest = Math.max(latest, lastAssistantMsg.timestamp);
                            }
                          }
                          return latest;
                        })();

                        // 🔵 Show notification badge dot for worktree agents (read-once system)
                        const lastReadTimestamp =
                          lastReadTimestamps?.get(agent.id) || 0;
                        const showNotificationBadge =
                          !isActive &&
                          !isDormant &&
                          activeSessionsWorktree.length > 0 &&
                          lastAssistantTimestamp > lastReadTimestamp;

                        // Determine if conversation is active and if agent is busy (worktree)
                        // NOTE: isBusyWorktree must be declared BEFORE useEffect that uses it
                        const hasActiveConversationWorktree =
                          !isDormant &&
                          (chatSessions?.get(agent.id)?.length ?? 0) > 0;

                        // 🦆 SESSIONS-FIRST: Calculate aggregated status from sessions for worktree agents
                        // 🦆 FIX: Use chatLoadingMap prop for consistency (memoization handles re-renders)
                        const agentSessionsWorktree = allSessionsForRepo.filter(
                          (s) => s.agentId === agent.id,
                        );
                        const aggregatedStatusWorktree: "busy" | "idle" =
                          (() => {
                            if (agentSessionsWorktree.length === 0) {
                              return agent.status ?? "idle";
                            }
                            // Check if ANY session is currently loading
                            for (const session of agentSessionsWorktree) {
                              if (chatLoadingMap?.get(session.id)) {
                                return "busy";
                              }
                            }
                            return "idle";
                          })();

                        // 🦆 SESSIONS-FIRST: Check if ANY session is ready (waiting for user response)
                        const isAnySessionReadyWorktree = (() => {
                          if (
                            !chatSessions ||
                            agentSessionsWorktree.length === 0 ||
                            isDormant
                          )
                            return false;
                          for (const session of agentSessionsWorktree) {
                            const sessionMessages = chatSessions.get(
                              session.id,
                            );
                            if (sessionMessages && sessionMessages.length > 0) {
                              const lastMsg =
                                sessionMessages[sessionMessages.length - 1];
                              if (
                                lastMsg.role === "assistant" &&
                                !chatLoadingMap?.get(session.id)
                              ) {
                                return true;
                              }
                            }
                          }
                          return false;
                        })();

                        // 🦆 SESSIONS-FIRST: Create aggregated agent for TerminalActivityBar
                        // 🦆 FIX: Include aggregated dormant/unread state for sessions
                        const aggregatedAgentWorktree = {
                          ...agent,
                          status: aggregatedStatusWorktree,
                          waitingForResponse:
                            isAnySessionReadyWorktree && !isActive,
                          aggregatedIsDormant: isDormantWorktree,
                          aggregatedHasUnread: hasUnreadMessagesWorktree,
                        };

                        const isBusyWorktree =
                          aggregatedStatusWorktree === "busy";

                        // Quack tooltip: show periodically when there are UNREAD messages AND agent is NOT busy
                        // This ensures the tooltip only appears when the agent has finished responding
                        useEffect(() => {
                          // Only show tooltip when there's a notification badge AND agent is NOT busy (finished responding)
                          if (!showNotificationBadge || isBusyWorktree) {
                            setShowQuackTooltipWorktree(false);
                            return;
                          }

                          // Show tooltip every 5 seconds for 2 seconds
                          // Memory fix: track inner timeouts to cancel on cleanup
                          let hideTimeout: ReturnType<typeof setTimeout>;
                          const showInterval = setInterval(() => {
                            setShowQuackTooltipWorktree(true);
                            hideTimeout = setTimeout(
                              () => setShowQuackTooltipWorktree(false),
                              2000,
                            );
                          }, 5000);

                          // Show immediately on first unread
                          setShowQuackTooltipWorktree(true);
                          const initialHideTimeout = setTimeout(
                            () => setShowQuackTooltipWorktree(false),
                            2000,
                          );

                          return () => {
                            clearInterval(showInterval);
                            clearTimeout(hideTimeout);
                            clearTimeout(initialHideTimeout);
                          };
                        }, [showNotificationBadge, isBusyWorktree]);

                        const relativeTime = getRelativeTimeString(
                          lastAssistantTimestamp,
                        );
                        const timestampOpacity = relativeTime
                          ? getTimestampOpacity(relativeTime.minutes)
                          : 0.4;

                        return (
                          <div
                            key={agent.id}
                            style={{
                              marginBottom: "8px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            {/* LEFT SECTION: Timing + Metro Station (OUTSIDE colored background) */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                minWidth: "16px",
                              }}
                            >
                              {/* 🦆 Relative Time - ALWAYS visible, positioned left of metro-station */}
                              {relativeTime ? (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "9px",
                                    fontWeight: 600,
                                    lineHeight: "1",
                                    pointerEvents: "none",
                                    userSelect: "none",
                                    minWidth: "20px",
                                  }}
                                >
                                  <div
                                    style={{
                                      marginBottom: "1px",
                                      color:
                                        relativeTime.minutes < 5
                                          ? agent.color
                                          : `rgba(255, 255, 255, ${timestampOpacity})`,
                                      transition: "color 1s ease",
                                    }}
                                  >
                                    {relativeTime.value}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "7px",
                                      color:
                                        relativeTime.minutes < 5
                                          ? agent.color
                                          : `rgba(255, 255, 255, ${timestampOpacity * 0.75})`,
                                      transition: "color 1s ease",
                                    }}
                                  >
                                    {relativeTime.unit}
                                  </div>
                                </div>
                              ) : null}

                              {/* Metro Station DIAMOND for worktrees! - DYNAMIC based on notification state */}
                              <div
                                className="metro-station-diamond"
                                style={{
                                  width: "10px",
                                  height: "10px",
                                  transform: "rotate(45deg)", // DIAMOND shape!
                                  borderRadius: "0",
                                  // 🎨 Dynamic background: FULL agent color when unread, TRANSPARENT when read
                                  background: showNotificationBadge
                                    ? agent.color
                                    : "transparent",
                                  // 🎨 Dynamic border: NO border when unread (full color), agent color BORDER when read
                                  border: showNotificationBadge
                                    ? "none"
                                    : `2px solid ${agent.color}66`, // 66 = ~40% opacity
                                  boxShadow: showNotificationBadge
                                    ? `0 0 8px ${agent.color}99, 0 0 12px ${agent.color}66`
                                    : "none",
                                  flexShrink: 0,
                                  transition: "all 0.3s ease",
                                }}
                              />
                            </div>

                            {/* RIGHT SECTION: Colored Background with Avatar + Content */}
                            <div
                              className={`agent-card`}
                              onClick={() => {
                                // If in Kanban mode, set agent filter instead of exiting
                                if (isKanbanViewActive) {
                                  import("../stores/kanbanStore").then(
                                    ({ useKanbanStore }) => {
                                      useKanbanStore
                                        .getState()
                                        .setAgentFilter(agent.id);
                                      console.log(
                                        "[RepositoryGroup] Set Kanban filter to agent:",
                                        agent.label || agent.id,
                                      );
                                    },
                                  );
                                }
                                onSelect(agent);
                              }}
                              onContextMenu={(e) => onContextMenu(e, agent)}
                              onMouseEnter={() => setHoveredAgentId(agent.id)}
                              onMouseLeave={() => setHoveredAgentId(null)}
                              style={{
                                flex: 1,
                                padding: "8px 12px",
                                paddingLeft: "8px",
                                background: isActive
                                  ? `${agent.color}28` // Increased from 15 to 28 (2x opacity, ~16%)
                                  : isHovered
                                    ? "rgba(255, 255, 255, 0.03)"
                                    : "transparent",
                                borderRadius: "6px",
                                cursor: "pointer",
                                transition:
                                  "background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease",
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                minHeight: "48px",
                                // Add white border only when selected (in focus)
                                border: isActive
                                  ? "2px solid rgba(255, 255, 255, 0.6)"
                                  : "1px solid rgba(255, 255, 255, 0.1)",
                                boxShadow: isActive
                                  ? "0 0 12px rgba(255, 255, 255, 0.15)"
                                  : undefined,
                                // Reduce opacity for dormant/empty agents (matches sleep icon in TerminalActivityBar)
                                // But always full opacity when selected (isActive)
                                opacity: isActive
                                  ? 1
                                  : isChatEmpty || isDormant
                                    ? 0.65
                                    : 1,
                              }}
                            >
                              {/* 🎨 Avatar - Full height, squared with border-radius, with IMAGE */}
                              <div
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "6px",
                                  border: `2px solid ${agent.color}66`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  overflow: "hidden",
                                }}
                              >
                                {(() => {
                                  // Load avatar URL for worktree agents (inline)
                                  const [avatarUrl, setAvatarUrl] = useState<
                                    string | null
                                  >(null);

                                  useEffect(() => {
                                    let isMounted = true;

                                    async function loadAvatarUrl() {
                                      if (!agent.avatar) {
                                        if (isMounted) {
                                          if (window.__TAURI__) {
                                            setAvatarUrl(
                                              convertFileSrc(
                                                "/images/ducks/new-avatars/duck15.jpeg",
                                                "asset",
                                              ),
                                            );
                                          } else {
                                            setAvatarUrl(
                                              "/images/ducks/new-avatars/duck15.jpeg",
                                            );
                                          }
                                        }
                                        return;
                                      }

                                      if (isCustomAvatar(agent.avatar)) {
                                        try {
                                          const url = await getCustomAvatarUrl(
                                            agent.avatar,
                                          );
                                          if (isMounted) setAvatarUrl(url);
                                        } catch (error) {
                                          if (isMounted) {
                                            if (window.__TAURI__) {
                                              setAvatarUrl(
                                                convertFileSrc(
                                                  "/images/ducks/new-avatars/duck15.jpeg",
                                                  "asset",
                                                ),
                                              );
                                            } else {
                                              setAvatarUrl(
                                                "/images/ducks/new-avatars/duck15.jpeg",
                                              );
                                            }
                                          }
                                        }
                                      } else {
                                        if (isMounted)
                                          setAvatarUrl(
                                            getAvatarUrl(agent.avatar),
                                          );
                                      }
                                    }

                                    loadAvatarUrl();
                                    return () => {
                                      isMounted = false;
                                    };
                                  }, [agent.avatar]);

                                  return avatarUrl ? (
                                    <img
                                      src={avatarUrl}
                                      alt={agent.label}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                      onError={(e) => {
                                        const target =
                                          e.target as HTMLImageElement;
                                        if (window.__TAURI__) {
                                          target.src = convertFileSrc(
                                            "/images/ducks/new-avatars/duck15.jpeg",
                                            "asset",
                                          );
                                        } else {
                                          target.src =
                                            "/images/ducks/new-avatars/duck15.jpeg";
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        background: `linear-gradient(135deg, ${agent.color}40, ${agent.color}20)`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "16px",
                                        fontWeight: 700,
                                        color: agent.color,
                                      }}
                                    >
                                      {agent.label.charAt(0).toUpperCase()}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Unread message indicator with Quack tooltip (WhatsApp-style) - worktree */}
                              {showNotificationBadge && (
                                <div
                                  style={{
                                    position: "relative",
                                    marginLeft: "-4px",
                                    marginRight: "4px",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "18px",
                                      animation:
                                        "quackBounce 1s ease-in-out infinite",
                                    }}
                                  >
                                    💬
                                  </span>
                                  {showQuackTooltipWorktree && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "-28px",
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        background: "rgba(255, 255, 255, 0.95)",
                                        color: "#1a1a2e",
                                        padding: "4px 10px",
                                        borderRadius: "12px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                        boxShadow:
                                          "0 4px 12px rgba(0, 0, 0, 0.3)",
                                        animation:
                                          "tooltipFadeIn 0.3s ease-out",
                                        zIndex: 100,
                                      }}
                                    >
                                      Quack quack...
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex w-full items-center justify-between">
                                <div className="flex w-full items-center gap-2 flex-1">
                                  <TerminalActivityBar
                                    terminal={aggregatedAgentWorktree}
                                    chatSessions={chatSessions}
                                    hideBranch={true} // Hide branch badge
                                    isActive={agent.id === activeId}
                                  />
                                </div>

                                {/* Action buttons wrapper */}
                                <div
                                  className="icons-wrapper"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    marginLeft: "auto",
                                    gap: "4px",
                                  }}
                                >
                                  {/* Git Branch Icon */}
                                  <div
                                    className="git-branch-icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowGitMenu(
                                        showGitMenu === agent.id
                                          ? null
                                          : agent.id,
                                      );
                                    }}
                                    style={{
                                      cursor: "pointer",
                                      padding: "6px",
                                      borderRadius: "4px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: "transparent",
                                      transition: "background 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "rgba(78, 205, 196, 0.15)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
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
                                      background: "transparent",
                                      border: "none",
                                      color: "#e74c3c",
                                      cursor: "pointer",
                                      fontSize: "18px",
                                      padding: "4px 8px",
                                      borderRadius: "4px",
                                      transition: "background 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "rgba(231, 76, 60, 0.15)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
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
                                  position: "absolute",
                                  top: "100%",
                                  right: "8px",
                                  marginTop: "4px",
                                  background: "rgba(20, 22, 28, 0.98)",
                                  border: "1px solid rgba(255, 255, 255, 0.1)",
                                  borderRadius: "8px",
                                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                                  minWidth: "200px",
                                  zIndex: 9999,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  className="menu-items"
                                  style={{ padding: "4px" }}
                                >
                                  {/* Pull Latest */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGitOperation("pull", agent);
                                      setShowGitMenu(null);
                                    }}
                                    className="menu-item"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      width: "100%",
                                      padding: "10px 12px",
                                      background: "transparent",
                                      border: "none",
                                      color: "rgba(255, 255, 255, 0.9)",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      borderRadius: "4px",
                                      transition: "background 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "rgba(78, 205, 196, 0.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
                                    }}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                      opacity="0.7"
                                    >
                                      <path d="M8 12L4 8h3V2h2v6h3l-4 4zm-6 2h12v2H2v-2z" />
                                    </svg>
                                    Pull latest
                                  </button>

                                  {/* Push to Remote */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGitOperation("push", agent);
                                      setShowGitMenu(null);
                                    }}
                                    className="menu-item"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      width: "100%",
                                      padding: "10px 12px",
                                      background: "transparent",
                                      border: "none",
                                      color: "rgba(255, 255, 255, 0.9)",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      borderRadius: "4px",
                                      transition: "background 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "rgba(78, 205, 196, 0.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
                                    }}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                      opacity="0.7"
                                    >
                                      <path d="M8 4L4 8h3v6h2V8h3L8 4zM2 2h12v2H2V2z" />
                                    </svg>
                                    Push to remote
                                  </button>

                                  {/* Create PR */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGitOperation("create-pr", agent);
                                      setShowGitMenu(null);
                                    }}
                                    className="menu-item"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      width: "100%",
                                      padding: "10px 12px",
                                      background: "transparent",
                                      border: "none",
                                      color: "rgba(255, 255, 255, 0.9)",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      borderRadius: "4px",
                                      transition: "background 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "rgba(78, 205, 196, 0.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
                                    }}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                      opacity="0.7"
                                    >
                                      <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346z" />
                                    </svg>
                                    Create PR
                                  </button>

                                  {/* Separator */}
                                  <div
                                    style={{
                                      height: "1px",
                                      background: "rgba(255, 255, 255, 0.1)",
                                      margin: "4px 8px",
                                    }}
                                  />

                                  {/* View Commits */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGitOperation("view-commits", agent);
                                      setShowGitMenu(null);
                                    }}
                                    className="menu-item"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      width: "100%",
                                      padding: "10px 12px",
                                      background: "transparent",
                                      border: "none",
                                      color: "rgba(255, 255, 255, 0.9)",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      borderRadius: "4px",
                                      transition: "background 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "rgba(78, 205, 196, 0.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
                                    }}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                      opacity="0.7"
                                    >
                                      <path d="M10.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z" />
                                    </svg>
                                    View commits
                                  </button>

                                  {/* Delete Worktree - only for worktrees */}
                                  <div
                                    style={{
                                      height: "1px",
                                      background: "rgba(255, 255, 255, 0.1)",
                                      margin: "4px 8px",
                                    }}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGitOperation(
                                        "delete-worktree",
                                        agent,
                                      );
                                      setShowGitMenu(null);
                                    }}
                                    className="menu-item"
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      width: "100%",
                                      padding: "10px 12px",
                                      background: "transparent",
                                      border: "none",
                                      color: "rgba(231, 76, 60, 0.9)",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      borderRadius: "4px",
                                      transition: "background 0.2s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background =
                                        "rgba(231, 76, 60, 0.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background =
                                        "transparent";
                                    }}
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                      opacity="0.7"
                                    >
                                      <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
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
                  ),
                );
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

      {/* New Session Modal - triggered from agent card "+" button */}
      <NewSessionModal
        isOpen={newSessionModalAgentId !== null}
        onClose={() => setNewSessionModalAgentId(null)}
        onSubmit={handleNewSession}
        agentName={
          newSessionModalAgentId
            ? [...mainAgents, ...worktreeAgents].find(
                (a) => a.id === newSessionModalAgentId,
              )?.label
            : undefined
        }
        projectPath={repoPath}
        defaultBranch={
          newSessionModalAgentId
            ? [...mainAgents, ...worktreeAgents].find(
                (a) => a.id === newSessionModalAgentId,
              )?.branch
            : undefined
        }
      />

      {/* Team Creation Modal */}
      <TeamCreationModal
        isOpen={showTeamModal}
        onClose={() => { setShowTeamModal(false); loadActiveTeam(repoPath, buildAgentAvatarMap()); }}
        projectPath={repoPath}
        agents={[...mainAgents, ...worktreeAgents]}
        editingTeam={activeTeam?.projectPath === repoPath ? activeTeam : null}
      />
    </div>
  );
}
