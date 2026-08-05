// FILE: paperoPromptInjection.ts
// Purpose: Builds papero identity instructions for provider turn input (not the persisted bubble).
// Layer: Server provider helper
// Exports: buildInlinePaperoInstructions

import {
  DEFAULT_HOUSE_STYLE,
  buildPaperoIdentityBlock,
  getPaperoDefinition,
  isPaperoId,
  type PaperoId,
} from "@synara/shared/paperi";
import type { TeamAgent } from "@synara/contracts";

export function buildInlinePaperoInstructions(input: {
  readonly paperoId: string | null | undefined;
  /** When set, replaces the builtin instruction body for this turn. */
  readonly paperoInstructions?: string | null | undefined;
  /** Resolved server-side Team agent. This takes precedence over client fields. */
  readonly agent?: Pick<TeamAgent, "name" | "role" | "instructions">;
  readonly maxChars: number;
}): string {
  if (!input.paperoId || input.maxChars <= 0) {
    return "";
  }
  const block = input.agent
    ? [
        "[Agent identity]",
        `You are ${input.agent.name}, ${input.agent.role}. Always speak as ${input.agent.name} — stay in character for this turn.`,
        DEFAULT_HOUSE_STYLE,
        input.agent.instructions.trim(),
        "[/Agent identity]",
      ]
        .filter(Boolean)
        .join("\n")
        .trim()
    : isPaperoId(input.paperoId)
      ? buildPaperoIdentityBlock({
          definition: getPaperoDefinition(input.paperoId as PaperoId),
          ...(input.paperoInstructions?.trim()
            ? { overrides: { instructions: input.paperoInstructions.trim() } }
            : {}),
        }).trim()
      : "";
  if (block.length === 0) return "";
  if (block.length > input.maxChars) {
    return `${block.slice(0, Math.max(0, input.maxChars - 20))}\n[truncated]`;
  }
  return block;
}
