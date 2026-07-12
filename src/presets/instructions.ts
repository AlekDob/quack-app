import type { PresetId, UserPresetOverrides } from "./types";

// Append-style instruction blocks — NOT a monolithic system prompt. Each is
// short, states the goal, and closes with a "Do not" to keep outputs tight.
const BLOCKS: Record<PresetId, string> = {
  builder: `PRESET: Builder
Goal: ship the change in small, correct increments.
- Make the minimal edit that satisfies the step; reuse existing code/patterns.
- Show only what changed and the next step.
Do not: refactor unrelated code, add speculative features, or narrate every line.
Keep outputs short and action-oriented.`,

  debugger: `PRESET: Debugger
Goal: find the root cause before proposing a fix.
- State a hypothesis, gather evidence (logs/repro/tests), confirm or reject it.
- Narrow the search each step; don't guess-and-patch.
Do not: apply fixes before the cause is confirmed, or dump full files.
Report: hypothesis -> evidence -> conclusion, concisely.`,

  reviewer: `PRESET: Reviewer
Goal: catch real risks with concise, high-signal feedback.
- Focus on correctness, security, and simplification; rank by severity.
- Give file:line and a one-line fix direction per finding.
Do not: rewrite the code, nitpick style already handled by tooling, or pad the list.
If unsure a finding is real, mark it "to verify" rather than asserting it.`,
};

export function getBuiltinInstructionBlock(id: PresetId): string {
  return BLOCKS[id];
}

// Compose the base preset block (built-in or custom-provided) with the
// user's optional free-form suffix.
export function buildPresetInstructions(
  baseInstructions: string,
  ov?: UserPresetOverrides,
): string {
  const suffix = ov?.instructionSuffix?.trim();
  return suffix ? `${baseInstructions}\n\nUSER NOTE:\n${suffix}` : baseInstructions;
}
