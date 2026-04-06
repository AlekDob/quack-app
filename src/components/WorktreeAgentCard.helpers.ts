// Brain: fix-worktree-hooks-violation
// Helper functions extracted from WorktreeAgentCard.tsx to keep files under 300 lines

import { convertFileSrc } from "@tauri-apps/api/core";
import type { TerminalInfo, ChatMessage, AgentSession } from "../types";

// ---------------------------------------------------------------------------
// Avatar URL helpers
// ---------------------------------------------------------------------------

export function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, "asset");
  }
  return `/images/ducks/new-avatars/${avatarName}`;
}

export const FALLBACK_AVATAR_PATH = "/images/ducks/new-avatars/duck15.jpeg";

export function getFallbackAvatarUrl(): string {
  return window.__TAURI__
    ? convertFileSrc(FALLBACK_AVATAR_PATH, "asset")
    : FALLBACK_AVATAR_PATH;
}

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

export function getRelativeTimeString(
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

export function getTimestampOpacity(minutes: number): number {
  if (minutes <= 3) return 1.0;
  if (minutes <= 30) {
    const fadeProgress = (minutes - 3) / 27;
    return 1.0 - fadeProgress * 0.6;
  }
  return 0.4;
}

// ---------------------------------------------------------------------------
// Derived session state helpers
// ---------------------------------------------------------------------------

export function calcActiveSessionsWorktree(
  allSessionsForRepo: AgentSession[],
  agentId: string,
): AgentSession[] {
  return allSessionsForRepo.filter(
    (s) => s.agentId === agentId && s.status !== "done",
  );
}

export function calcIsDormantWorktree(
  chatSessions: Map<string, ChatMessage[]> | undefined,
  activeSessions: AgentSession[],
): boolean {
  if (!chatSessions || activeSessions.length === 0) return true;
  for (const session of activeSessions) {
    const msgs = chatSessions.get(session.id);
    if (msgs && msgs.some((m) => m.role === "assistant")) return false;
  }
  return true;
}

export function calcHasUnreadMessagesWorktree(
  chatSessions: Map<string, ChatMessage[]> | undefined,
  isActive: boolean,
  activeSessions: AgentSession[],
  isDormant: boolean,
): boolean {
  if (!chatSessions || isActive || activeSessions.length === 0 || isDormant) return false;
  for (const session of activeSessions) {
    const msgs = chatSessions.get(session.id);
    if (msgs && msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      if (last.role === "assistant" && (last.status === "complete" || !last.status)) return true;
    }
  }
  return false;
}

export function calcLastAssistantTimestamp(
  chatSessions: Map<string, ChatMessage[]> | undefined,
  activeSessions: AgentSession[],
): number {
  if (!chatSessions || activeSessions.length === 0) return 0;
  let latest = 0;
  for (const session of activeSessions) {
    const msgs = chatSessions.get(session.id);
    if (!msgs || msgs.length === 0) continue;
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
    if (lastAssistant?.timestamp) latest = Math.max(latest, lastAssistant.timestamp);
  }
  return latest;
}

export function calcAggregatedStatusWorktree(
  agent: TerminalInfo,
  agentSessions: AgentSession[],
  chatLoadingMap: Map<string, boolean> | undefined,
): "busy" | "idle" {
  if (agentSessions.length === 0) return (agent.status as "busy" | "idle") ?? "idle";
  for (const session of agentSessions) {
    if (chatLoadingMap?.get(session.id)) return "busy";
  }
  return "idle";
}

export function calcIsAnySessionReadyWorktree(
  chatSessions: Map<string, ChatMessage[]> | undefined,
  agentSessions: AgentSession[],
  isDormant: boolean,
  chatLoadingMap: Map<string, boolean> | undefined,
): boolean {
  if (!chatSessions || agentSessions.length === 0 || isDormant) return false;
  for (const session of agentSessions) {
    const msgs = chatSessions.get(session.id);
    if (msgs && msgs.length > 0) {
      const last = msgs[msgs.length - 1];
      if (last.role === "assistant" && !chatLoadingMap?.get(session.id)) return true;
    }
  }
  return false;
}
