// FILE: paperoPromptInjection.ts
// Purpose: Builds papero identity instructions for provider turn input (not the persisted bubble).
// Layer: Server provider helper
// Exports: buildInlinePaperoInstructions, isProviderSlashCommandTurn

import {
  DEFAULT_HOUSE_STYLE,
  buildPaperoIdentityBlock,
  getPaperoDefinition,
  isPaperoId,
  type PaperoId,
} from "@synara/shared/paperi";
import type { TeamAgent } from "@synara/contracts";

// A native provider slash command is only recognized when the prompt *starts*
// with it (Claude's /compact, Droid's commands, ...). Prepending the papero
// identity block pushes the slash off position 0, so the CLI reads it as an
// ordinary message and the command silently never runs. Single line only: a
// multi-line message that merely opens with "/foo" is a real prompt.
const PROVIDER_SLASH_COMMAND_TURN = /^\/[A-Za-z][\w-]*(?:[ \t][^\n]*)?$/u;

export function isProviderSlashCommandTurn(text: string | null | undefined): boolean {
  return PROVIDER_SLASH_COMMAND_TURN.test((text ?? "").trim());
}

export function buildInlinePaperoInstructions(input: {
  readonly paperoId: string | null | undefined;
  /**
   * Raw user text for this turn. When it is a bare provider slash command the
   * identity block is skipped so the command still reaches the provider.
   */
  readonly messageText?: string | null | undefined;
  /** When set, replaces the builtin instruction body for this turn. */
  readonly paperoInstructions?: string | null | undefined;
  /** Resolved server-side Team agent. This takes precedence over client fields. */
  readonly agent?: Pick<TeamAgent, "name" | "role" | "instructions">;
  readonly maxChars: number;
}): string {
  if (!input.paperoId || input.maxChars <= 0 || isProviderSlashCommandTurn(input.messageText)) {
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
