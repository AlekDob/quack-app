// Brain: fix-worktree-hooks-violation
// Right-section body of WorktreeAgentCard: avatar, activity bar, action buttons

import { type MouseEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import TerminalActivityBar from "./TerminalActivityBar";
import type { TerminalInfo, ChatMessage } from "../types";

interface WorktreeAgentCardBodyProps {
  agent: TerminalInfo;
  activeId: string | null;
  isActive: boolean;
  isChatEmpty: boolean;
  isDormant: boolean;
  avatarUrl: string | null;
  showNotificationBadge: boolean;
  showQuackTooltip: boolean;
  aggregatedAgent: TerminalInfo & { status: "busy" | "idle"; waitingForResponse: boolean; aggregatedIsDormant: boolean; aggregatedHasUnread: boolean };
  chatSessions?: Map<string, ChatMessage[]>;
  showGitMenu: string | null;
  setShowGitMenu: (id: string | null) => void;
  setHoveredAgentId: (id: string | null) => void;
  onClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onClose: (id: string) => void;
}

export default function WorktreeAgentCardBody({
  agent, activeId, isActive, isChatEmpty, isDormant,
  avatarUrl, showNotificationBadge, showQuackTooltip,
  aggregatedAgent, chatSessions,
  showGitMenu, setShowGitMenu, setHoveredAgentId,
  onClick, onContextMenu, onClose,
}: WorktreeAgentCardBodyProps) {
  function handleAvatarError(e: React.SyntheticEvent<HTMLImageElement>) {
    const target = e.target as HTMLImageElement;
    target.src = window.__TAURI__
      ? convertFileSrc("/images/ducks/new-avatars/duck15.jpeg", "asset")
      : "/images/ducks/new-avatars/duck15.jpeg";
  }

  return (
    <div
      className="agent-card"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHoveredAgentId(agent.id)}
      onMouseLeave={() => setHoveredAgentId(null)}
      style={{
        flex: 1, padding: "8px 10px", paddingLeft: "8px",
        background: isActive ? `${agent.color}30` : "transparent",
        borderRadius: "0", cursor: "pointer",
        transition: "background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease",
        position: "relative", display: "flex", alignItems: "flex-start", gap: "10px",
        minHeight: "40px", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
        opacity: isActive ? 1 : isChatEmpty || isDormant ? 0.6 : 0.85,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: "38px", height: "38px", borderRadius: "10px",
        border: isActive ? `2px solid ${agent.color}88` : "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, overflow: "hidden", marginTop: "1px",
      }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={agent.label}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={handleAvatarError}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: `linear-gradient(135deg, ${agent.color}40, ${agent.color}20)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: 700, color: agent.color,
          }}>
            {agent.label.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Unread message indicator */}
      {showNotificationBadge && (
        <div style={{ position: "relative", marginLeft: "-4px", marginRight: "4px" }}>
          <span style={{ fontSize: "18px", animation: "quackBounce 1s ease-in-out infinite" }}>
            {/* chat bubble — functional status indicator */}
            💬
          </span>
          {showQuackTooltip && (
            <div style={{
              position: "absolute", top: "-28px", left: "50%", transform: "translateX(-50%)",
              background: "rgba(255, 255, 255, 0.95)", color: "#1a1a2e",
              padding: "4px 10px", borderRadius: "12px", fontSize: "11px",
              fontWeight: 600, whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              animation: "tooltipFadeIn 0.3s ease-out", zIndex: 100,
            }}>
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
            isActive={agent.id === activeId}
          />
        </div>

        <div className="icons-wrapper" style={{ display: "flex", alignItems: "center", marginLeft: "auto", gap: "4px" }}>
          {/* Git branch menu trigger */}
          <div
            className="git-branch-icon"
            onClick={(e) => { e.stopPropagation(); setShowGitMenu(showGitMenu === agent.id ? null : agent.id); }}
            style={{
              cursor: "pointer", padding: "6px", borderRadius: "4px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(78, 205, 196, 0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
          </div>

          {/* Close button */}
          <button type="button" className="terminal-close"
            onClick={(e) => { e.stopPropagation(); onClose(agent.id); }}
            style={{
              background: "transparent", border: "none", color: "#e74c3c",
              cursor: "pointer", fontSize: "18px", padding: "4px 8px",
              borderRadius: "4px", transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(231, 76, 60, 0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
