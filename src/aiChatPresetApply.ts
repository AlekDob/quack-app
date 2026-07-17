import {
  isAgenticProviderId,
  parseQualifiedModel,
  type ProviderId,
} from "./providers/types";

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
