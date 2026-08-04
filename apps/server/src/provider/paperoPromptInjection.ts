// FILE: paperoPromptInjection.ts
// Purpose: Builds papero identity instructions for provider turn input (not the persisted bubble).
// Layer: Server provider helper
// Exports: buildInlinePaperoInstructions

import {
  buildPaperoIdentityBlock,
  getPaperoDefinition,
  isPaperoId,
  type PaperoId,
} from "@synara/shared/paperi";

export function buildInlinePaperoInstructions(input: {
  readonly paperoId: string | null | undefined;
  /** When set, replaces the builtin instruction body for this turn. */
  readonly paperoInstructions?: string | null | undefined;
  readonly maxChars: number;
}): string {
  if (!input.paperoId || !isPaperoId(input.paperoId) || input.maxChars <= 0) {
    return "";
  }
  const definition = getPaperoDefinition(input.paperoId as PaperoId);
  const override = input.paperoInstructions?.trim();
  const block = buildPaperoIdentityBlock({
    definition,
    ...(override ? { overrides: { instructions: override } } : {}),
  }).trim();
  if (block.length === 0) return "";
  if (block.length > input.maxChars) {
    return `${block.slice(0, Math.max(0, input.maxChars - 20))}\n[truncated]`;
  }
  return block;
}
