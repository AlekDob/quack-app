// Brain: fix-worktree-hooks-violation
// Extracted from RepositoryGroup.tsx to fix React Rules of Hooks violations
// (useState/useEffect were called inside .map() callbacks — illegal in React)

import { useState, useEffect, memo, type MouseEvent } from "react";
import { getCustomAvatarUrl, isCustomAvatar } from "../utils/customAvatarStorage";
import type { TerminalInfo, ChatMessage, AgentSession } from "../types";
import {
  getAvatarUrl,
  getFallbackAvatarUrl,
  getRelativeTimeString,
  getTimestampOpacity,
  calcActiveSessionsWorktree,
  calcIsDormantWorktree,
  calcHasUnreadMessagesWorktree,
  calcLastAssistantTimestamp,
  calcAggregatedStatusWorktree,
  calcIsAnySessionReadyWorktree,
} from "./WorktreeAgentCard.helpers";
import WorktreeGitMenu from "./WorktreeGitMenu";
import WorktreeAgentCardBody from "./WorktreeAgentCardBody";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorktreeAgentCardProps {
  agent: TerminalInfo;
  activeId: string | null;
  hoveredAgentId: string | null;
  setHoveredAgentId: (id: string | null) => void;
  chatSessions?: Map<string, ChatMessage[]>;
  allSessionsForRepo: AgentSession[];
  chatLoadingMap?: Map<string, boolean>;
  lastReadTimestamps?: Map<string, number>;
  isKanbanViewActive?: boolean;
  showGitMenu: string | null;
  setShowGitMenu: (id: string | null) => void;
  onSelect: (terminal: TerminalInfo) => void;
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void;
  onClose: (id: string) => void;
  handleGitOperation: (operation: string, terminal: TerminalInfo) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function WorktreeAgentCard({
  agent,
  activeId,
  hoveredAgentId: _hoveredAgentId,
  setHoveredAgentId,
  chatSessions,
  allSessionsForRepo,
  chatLoadingMap,
  lastReadTimestamps,
  isKanbanViewActive,
  showGitMenu,
  setShowGitMenu,
  onSelect,
  onContextMenu,
  onClose,
  handleGitOperation,
}: WorktreeAgentCardProps) {
  // Hooks must be at the top level of a component — never inside .map()
  const [showQuackTooltipWorktree, setShowQuackTooltipWorktree] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const isActive = agent.id === activeId;
  const isChatEmpty = !chatSessions || !(chatSessions.get(agent.id)?.length);

  const activeSessionsWorktree = calcActiveSessionsWorktree(allSessionsForRepo, agent.id);
  const isDormant = calcIsDormantWorktree(chatSessions, activeSessionsWorktree);

  const hasUnreadMessagesWorktree = calcHasUnreadMessagesWorktree(
    chatSessions, isActive, activeSessionsWorktree, isDormant,
  );

  const lastAssistantTimestamp = calcLastAssistantTimestamp(chatSessions, activeSessionsWorktree);

  const lastReadTimestamp = lastReadTimestamps?.get(agent.id) ?? 0;
  const showNotificationBadge =
    !isActive &&
    !isDormant &&
    activeSessionsWorktree.length > 0 &&
    lastAssistantTimestamp > lastReadTimestamp;

  const agentSessionsAll = allSessionsForRepo.filter((s) => s.agentId === agent.id);
  const aggregatedStatusWorktree = calcAggregatedStatusWorktree(agent, agentSessionsAll, chatLoadingMap);
  const isBusyWorktree = aggregatedStatusWorktree === "busy";

  const isAnySessionReadyWorktree = calcIsAnySessionReadyWorktree(
    chatSessions, agentSessionsAll, isDormant, chatLoadingMap,
  );

  const aggregatedAgentWorktree = {
    ...agent,
    status: aggregatedStatusWorktree,
    waitingForResponse: isAnySessionReadyWorktree && !isActive,
    aggregatedIsDormant: isDormant,
    aggregatedHasUnread: hasUnreadMessagesWorktree,
  };

  const relativeTime = getRelativeTimeString(lastAssistantTimestamp);
  const timestampOpacity = relativeTime ? getTimestampOpacity(relativeTime.minutes) : 0.4;

  // ---------------------------------------------------------------------------
  // Effect: quack tooltip pulse when unread messages present and agent is idle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!showNotificationBadge || isBusyWorktree) {
      setShowQuackTooltipWorktree(false);
      return;
    }

    let hideTimeout: ReturnType<typeof setTimeout>;
    const showInterval = setInterval(() => {
      setShowQuackTooltipWorktree(true);
      hideTimeout = setTimeout(() => setShowQuackTooltipWorktree(false), 2000);
    }, 5000);

    setShowQuackTooltipWorktree(true);
    const initialHideTimeout = setTimeout(() => setShowQuackTooltipWorktree(false), 2000);

    return () => {
      clearInterval(showInterval);
      clearTimeout(hideTimeout);
      clearTimeout(initialHideTimeout);
    };
  }, [showNotificationBadge, isBusyWorktree]);

  // ---------------------------------------------------------------------------
  // Effect: load avatar URL (custom, preset, or default duck)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadAvatarUrl() {
      const fallback = getFallbackAvatarUrl();
      if (!agent.avatar) { if (isMounted) setAvatarUrl(fallback); return; }
      if (isCustomAvatar(agent.avatar)) {
        try {
          const url = await getCustomAvatarUrl(agent.avatar);
          if (isMounted) setAvatarUrl(url);
        } catch { if (isMounted) setAvatarUrl(fallback); }
      } else {
        if (isMounted) setAvatarUrl(getAvatarUrl(agent.avatar));
      }
    }

    loadAvatarUrl();
    return () => { isMounted = false; };
  }, [agent.avatar]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleCardClick() {
    if (isKanbanViewActive) {
      import("../stores/kanbanStore").then(({ useKanbanStore }) => {
        useKanbanStore.getState().setAgentFilter(agent.id);
      });
    }
    onSelect(agent);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>

      {/* LEFT SECTION: Timing + Metro Station */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: "16px" }}>
        {relativeTime ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", fontSize: "9px", fontWeight: 600,
            lineHeight: "1", pointerEvents: "none", userSelect: "none", minWidth: "20px",
          }}>
            <div style={{
              marginBottom: "1px",
              color: relativeTime.minutes < 5 ? agent.color : `rgba(255, 255, 255, ${timestampOpacity})`,
              transition: "color 1s ease",
            }}>
              {relativeTime.value}
            </div>
            <div style={{
              fontSize: "7px",
              color: relativeTime.minutes < 5 ? agent.color : `rgba(255, 255, 255, ${timestampOpacity * 0.75})`,
              transition: "color 1s ease",
            }}>
              {relativeTime.unit}
            </div>
          </div>
        ) : null}

        <div className="metro-station-diamond" style={{
          width: "10px", height: "10px", transform: "rotate(45deg)", borderRadius: "0",
          background: showNotificationBadge ? agent.color : "transparent",
          border: showNotificationBadge ? "none" : `2px solid ${agent.color}66`,
          boxShadow: showNotificationBadge ? `0 0 8px ${agent.color}99, 0 0 12px ${agent.color}66` : "none",
          flexShrink: 0, transition: "all 0.3s ease",
        }} />
      </div>

      {/* RIGHT SECTION: Agent Card body (avatar, badge, activity bar, buttons) */}
      <WorktreeAgentCardBody
        agent={agent}
        activeId={activeId}
        isActive={isActive}
        isChatEmpty={isChatEmpty}
        isDormant={isDormant}
        avatarUrl={avatarUrl}
        showNotificationBadge={showNotificationBadge}
        showQuackTooltip={showQuackTooltipWorktree}
        aggregatedAgent={aggregatedAgentWorktree}
        chatSessions={chatSessions}
        showGitMenu={showGitMenu}
        setShowGitMenu={setShowGitMenu}
        setHoveredAgentId={setHoveredAgentId}
        onClick={handleCardClick}
        onContextMenu={(e) => onContextMenu(e, agent)}
        onClose={onClose}
      />

      {/* Git Operations Menu */}
      {showGitMenu === agent.id && (
        <WorktreeGitMenu
          agent={agent}
          onOperation={handleGitOperation}
          onClose={() => setShowGitMenu(null)}
        />
      )}
    </div>
  );
}

export default memo(WorktreeAgentCard);
