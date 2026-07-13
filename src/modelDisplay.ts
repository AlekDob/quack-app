// Honest model labels: composer shows the alias you picked (e.g. "sonnet");
// post-turn feedback shows the concrete model the API billed (e.g. "Sonnet 5").

import { parseQualifiedModel, type ProviderModel } from "./providers/types";

/** Composer chip — alias for Claude Code, catalog name elsewhere. */
export function composerChipLabel(
  selectedQualified: string,
  models: ProviderModel[] = [],
): string {
  const parsed = parseQualifiedModel(selectedQualified);
  if (!parsed) {
    if (!selectedQualified) return "Pick a model…";
    const colon = selectedQualified.indexOf(":");
    return colon > 0 ? selectedQualified.slice(colon + 1) : selectedQualified;
  }
  if (parsed.providerId === "claude-code") return parsed.modelId;
  const hit = models.find(
    (m) =>
      m.providerId === parsed.providerId && m.modelId === parsed.modelId,
  );
  return hit?.displayName || parsed.modelId;
}

/** Picker row primary label — matches chip honesty for Claude Code. */
export function pickerRowLabel(model: ProviderModel): string {
  if (model.providerId === "claude-code") return model.modelId;
  return model.displayName || model.modelId;
}

const RESOLVED_LABELS: Array<[RegExp, string]> = [
  [/opus-4-8|opus_4_8/, "Opus 4.8"],
  [/opus-4-7/, "Opus 4.7"],
  [/opus-4-6/, "Opus 4.6"],
  [/opus-4-5/, "Opus 4.5"],
  [/sonnet-5|sonnet_5/, "Sonnet 5"],
  [/sonnet-4-6/, "Sonnet 4.6"],
  [/sonnet-4/, "Sonnet 4"],
  [/haiku-4-5|haiku_4_5/, "Haiku 4.5"],
  [/fable-5|fable_5/, "Fable 5"],
  [/gpt-4o-mini/, "GPT-4o mini"],
  [/gpt-4o/, "GPT-4o"],
  [/gpt-4\.1-mini/, "GPT-4.1 mini"],
  [/gpt-4\.1/, "GPT-4.1"],
  [/o3-mini/, "o3-mini"],
  [/opus/, "Opus"],
  [/sonnet/, "Sonnet"],
  [/haiku/, "Haiku"],
  [/fable/, "Fable"],
  [/mythos/, "Mythos"],
];

/** Format a concrete API / transcript model id for post-turn feedback. */
export function formatResolvedModel(
  raw: string | undefined | null,
): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().toLowerCase();
  for (const [re, label] of RESOLVED_LABELS) {
    if (re.test(m)) return label;
  }
  const trimmed = raw.trim();
  return trimmed.length > 32 ? `${trimmed.slice(0, 30)}…` : trimmed;
}
