// Switch / new-chat / agent-mode timing. Console stays DEV-only; the Perf
// Audit ring (feature 086) records in all builds so the companion window
// can explain intermittent cold/warm lag.

import { recordPerfEvent } from "./perfAuditBus";

let switchStartAt = 0;
let switchToWsId = "";

export function markSwitchStart(wsId: string): void {
  switchStartAt = performance.now();
  switchToWsId = wsId;
  if (import.meta.env.DEV) {
    console.log(`[switch-perf] start`, { wsId });
  }
  recordPerfEvent("switch-perf", "start", { detail: { wsId } });
}

/** Log a heavy switch phase, timed from the last switch start. `wsId` gates it
 *  to the workspace we're switching INTO, so background work isn't attributed. */
export function logSwitchPhase(
  phase: string,
  wsId: string,
  extra?: Record<string, unknown>,
): void {
  if (!switchStartAt || wsId !== switchToWsId) return;
  const sinceSwitchMs = Math.round(performance.now() - switchStartAt);
  if (import.meta.env.DEV) {
    console.log(`[switch-perf] ${phase}`, { wsId, sinceSwitchMs, ...extra });
  }
  recordPerfEvent("switch-perf", phase, {
    elapsedMs: sinceSwitchMs,
    detail: { wsId, ...extra },
  });
}

// ── New-chat timing ────────────────────────────────────────────────────
let newChatId = "";
let newChatAt = 0;

export function markNewChat(chatId: string): void {
  newChatId = chatId;
  newChatAt = performance.now();
  if (import.meta.env.DEV) {
    console.log(`[new-chat-perf] start`, { chatId });
  }
  recordPerfEvent("new-chat", "start", { detail: { chatId } });
}

/** Log a phase of the just-created chat's first mount, timed from creation.
 *  Gated to that chat so only its own panel logs. */
export function logNewChatPhase(
  chatId: string,
  phase: string,
  extra?: Record<string, unknown>,
): void {
  if (chatId !== newChatId || !newChatAt) return;
  const sinceMs = Math.round(performance.now() - newChatAt);
  if (import.meta.env.DEV) {
    console.log(`[new-chat-perf] ${phase}`, {
      chatId,
      sinceMs,
      ...extra,
    });
  }
  recordPerfEvent("new-chat", phase, {
    elapsedMs: sinceMs,
    detail: { chatId, ...extra },
  });
}

// ── Agent Mode ↔ IDE layout toggle ─────────────────────────────────────
// App.tsx fully replaces AgentModeShell ↔ WorkspaceShell trees — warm-LRU
// does not survive. Filter console by `[agent-mode-switch]` (feature 085).
export type AgentModeTarget = "agent" | "ide";

export type AgentModePhaseEvent = {
  phase: string;
  to: AgentModeTarget | "";
  sinceMs: number;
  at: number;
  extra?: Record<string, unknown>;
};

let agentModeStartAt = 0;
let agentModeTo: AgentModeTarget | "" = "";
const agentModePhases: AgentModePhaseEvent[] = [];
const agentModePhaseListeners = new Set<(e: AgentModePhaseEvent) => void>();

export function markAgentModeSwitch(to: AgentModeTarget): void {
  agentModeStartAt = performance.now();
  agentModeTo = to;
  agentModePhases.length = 0;
  if (import.meta.env.DEV) {
    console.log(`[agent-mode-switch] start`, { to });
  }
  recordPerfEvent("agent-mode", "start", { detail: { to } });
}

export function logAgentModePhase(
  phase: string,
  extra?: Record<string, unknown>,
): void {
  if (!agentModeStartAt) return;
  const sinceMs = Math.round(performance.now() - agentModeStartAt);
  const event: AgentModePhaseEvent = {
    phase,
    to: agentModeTo,
    sinceMs,
    at: performance.now(),
    extra,
  };
  agentModePhases.push(event);
  if (import.meta.env.DEV) {
    console.log(`[agent-mode-switch] ${phase}`, {
      to: agentModeTo,
      sinceMs,
      ...extra,
    });
  }
  recordPerfEvent("agent-mode", phase, {
    elapsedMs: sinceMs,
    detail: { to: agentModeTo, ...extra },
  });
  for (const l of agentModePhaseListeners) l(event);
}

/** Recent phases for the in-flight (or last) agent-mode toggle — sim / tests. */
export function getAgentModePhases(): readonly AgentModePhaseEvent[] {
  return agentModePhases;
}

export function subscribeAgentModePhases(
  fn: (e: AgentModePhaseEvent) => void,
): () => void {
  agentModePhaseListeners.add(fn);
  return () => {
    agentModePhaseListeners.delete(fn);
  };
}
