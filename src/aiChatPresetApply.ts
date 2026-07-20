import {
  isAgenticProviderId,
  parseQualifiedModel,
  type ProviderId,
} from "./providers/types";
import type { ChatSession } from "./chatHistory";
import { DEFAULT_PRESET_ID } from "./presets/builtins";

export type AgenticProviderId = Extract<
  ProviderId,
  "claude-code" | "cursor-cli"
>;

/**
 * Fresh chats mount with `selected === ""` until model discovery hydrates.
 * Preset model/effort still need a backend — prefer the current picker
 * provider, else the first available agentic CLI (CC first).
 */
export function agenticProviderForPresetApply(
  selected: string,
  availability: {
    claudeCode: boolean;
    cursorCli: boolean;
  },
): AgenticProviderId | null {
  const fromSelected = parseQualifiedModel(selected)?.providerId;
  if (fromSelected && isAgenticProviderId(fromSelected)) {
    return fromSelected as AgenticProviderId;
  }
  if (availability.claudeCode) return "claude-code";
  if (availability.cursorCli) return "cursor-cli";
  return null;
}

/**
 * Empty RAM seeds from `addAIChat` (087) hit the hydrate `found` branch with
 * no model/knobs — those must still take the Team default agent (Milo), not
 * last-used Sonnet/Auto from localStorage.
 */
export function shouldApplyPresetOnEmptyHydrate(
  found: ChatSession,
  msgCount: number,
): boolean {
  if (msgCount > 0) return false;
  if (found.model) return false;
  return true;
}

/** Preset id to apply on a fresh empty hydrate (seeded or legacy blank). */
export function presetIdForEmptyHydrate(found: ChatSession): string {
  return found.presetId ?? DEFAULT_PRESET_ID;
}
