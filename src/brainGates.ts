// Per-workspace Pinky Brain auto-inject gate prefs and heuristics.

import type { ChatMessage } from "./ai";
import { getJson, setJson } from "./localStore";
import type { PinkySearchHit } from "./pinky";

export interface BrainScoreGate {
  enabled: boolean;
  min: number;
}

export interface BrainIntentGate {
  enabled: boolean;
}

export interface BrainThreadGate {
  enabled: boolean;
  turns: number;
}

export interface BrainGatePrefs {
  score: BrainScoreGate;
  intent: BrainIntentGate;
  thread: BrainThreadGate;
}

const DEFAULT_PREFS: BrainGatePrefs = {
  score: { enabled: true, min: 0.035 },
  intent: { enabled: true },
  thread: { enabled: false, turns: 3 },
};

const scoreKey = (wsId: string) => `lcp.brain.gate.score.${wsId}`;
const intentKey = (wsId: string) => `lcp.brain.gate.intent.${wsId}`;
const threadKey = (wsId: string) => `lcp.brain.gate.thread.${wsId}`;

function readGate<T>(
  key: string,
  fallback: T,
  valid: (v: unknown) => v is T,
): T {
  return getJson(key, fallback, valid);
}

function isScoreGate(v: unknown): v is BrainScoreGate {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as BrainScoreGate).enabled === "boolean" &&
    typeof (v as BrainScoreGate).min === "number"
  );
}

function isIntentGate(v: unknown): v is BrainIntentGate {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as BrainIntentGate).enabled === "boolean"
  );
}

function isThreadGate(v: unknown): v is BrainThreadGate {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as BrainThreadGate).enabled === "boolean" &&
    typeof (v as BrainThreadGate).turns === "number"
  );
}

export function getBrainGatePrefs(wsId: string): BrainGatePrefs {
  return {
    score: readGate(scoreKey(wsId), DEFAULT_PREFS.score, isScoreGate),
    intent: readGate(intentKey(wsId), DEFAULT_PREFS.intent, isIntentGate),
    thread: readGate(threadKey(wsId), DEFAULT_PREFS.thread, isThreadGate),
  };
}

export function setBrainGatePrefs(
  wsId: string,
  patch: Partial<BrainGatePrefs>,
): void {
  const cur = getBrainGatePrefs(wsId);
  if (patch.score) setJson(scoreKey(wsId), { ...cur.score, ...patch.score });
  if (patch.intent) setJson(intentKey(wsId), { ...cur.intent, ...patch.intent });
  if (patch.thread) setJson(threadKey(wsId), { ...cur.thread, ...patch.thread });
}

const WORK_KEYWORDS =
  /\b(why|how|what|where|when|fix|error|debug|explain|help|implement|build|add|remove|create|update|refactor|investigate|diagnose|broken|fails?|issue|problem|bug)\b/i;

const CONVERSATIONAL =
  /^(ok|okay|no|yes|si|sì|grazie|thanks|proceedi|procedi|fatto|done|got it|sure|perfetto|bene|ho riavviato|sono su|i restarted|i'm on)\b/i;

export function shouldAutoInjectBrain(text: string, prefs: BrainGatePrefs): boolean {
  if (!prefs.intent.enabled) return true;
  const t = text.trim();
  if (!t) return false;
  if (t.includes("?")) return true;
  if (t.length < 12 && !WORK_KEYWORDS.test(t)) return false;
  if (CONVERSATIONAL.test(t) && !WORK_KEYWORDS.test(t)) return false;
  return WORK_KEYWORDS.test(t);
}

export function filterBrainHitsByScore(
  hits: PinkySearchHit[],
  minScore: number,
): PinkySearchHit[] {
  return hits.filter((h) => h.score >= minScore);
}

export function buildBrainQueryFromThread(
  messages: ChatMessage[],
  text: string,
  turns: number,
): string {
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .slice(-Math.max(1, turns));
  const parts = [...userTexts, text.trim()].filter(Boolean);
  const merged = [...new Set(parts)].join("\n");
  return merged.slice(0, 400);
}
