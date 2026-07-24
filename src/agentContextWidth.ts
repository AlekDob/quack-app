import { getJson, setJson } from "./localStore";

const STORAGE_KEY = "lcp.agent.contextWidth";
export const AGENT_CONTEXT_DEFAULT_W = 480;
export const AGENT_CONTEXT_MIN_W = 280;
export const AGENT_CONTEXT_MAX_W = 720;

export function clampAgentContextWidth(w: number): number {
  return Math.min(
    AGENT_CONTEXT_MAX_W,
    Math.max(AGENT_CONTEXT_MIN_W, Math.round(w)),
  );
}

export function getAgentContextWidth(): number {
  return getJson(
    STORAGE_KEY,
    AGENT_CONTEXT_DEFAULT_W,
    (v): v is number =>
      typeof v === "number" &&
      v >= AGENT_CONTEXT_MIN_W &&
      v <= AGENT_CONTEXT_MAX_W,
  );
}

export function setAgentContextWidth(w: number): void {
  setJson(STORAGE_KEY, clampAgentContextWidth(w));
}
