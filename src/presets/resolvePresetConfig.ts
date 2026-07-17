import type {
  BackendCapabilities,
  BackendId,
  EffectivePresetConfig,
  PresetDefinition,
  PresetId,
  UserPresetOverrides,
} from "./types";
import { getPreset, isBuiltinPresetId } from "./builtins";
import { getCapabilities } from "./capabilities";
import { buildPresetInstructions, getBuiltinInstructionBlock } from "./instructions";
import { getPresetOverrides } from "./settings";
import { getTierModelOverride } from "./tierModelOverrides";

function baseInstructionsFor(def: PresetDefinition): string {
  if (def.source === "builtin" && isBuiltinPresetId(def.id)) {
    return getBuiltinInstructionBlock(def.id);
  }
  return def.instructions ?? def.purpose;
}

// Merge a user's overrides onto a preset's shipped definition — the single
// place display (organigramma card, composer picker) and resolution agree
// on what "this preset" currently looks like. Built-in presets have no
// backing file, so this override layer is what makes them editable too:
// renaming Milo or tweaking his instructions writes here (lcp.presets.v1),
// not a .md. Always includes a concrete `instructions` string (falling back
// to the shipped block) so an editor pre-fills with real text, never blank.
export function effectivePresetDefinition(
  def: PresetDefinition,
  ov: UserPresetOverrides = getPresetOverrides(def.id),
): PresetDefinition {
  return {
    ...def,
    label: ov.label ?? def.label,
    role: ov.role ?? def.role,
    purpose: ov.description ?? def.purpose,
    avatar: ov.avatar ?? def.avatar,
    defaults: {
      modelTier: ov.modelTier ?? def.defaults.modelTier,
      effort: ov.effort ?? def.defaults.effort,
      thinking: ov.thinking !== undefined ? ov.thinking : def.defaults.thinking,
      outputStyle: ov.outputStyle ?? def.defaults.outputStyle,
      permMode: ov.permMode !== undefined ? ov.permMode : def.defaults.permMode,
    },
    instructions: ov.instructions ?? baseInstructionsFor(def),
  };
}

function resolveModel(
  def: PresetDefinition,
  caps: BackendCapabilities,
  ov: UserPresetOverrides,
  warnings: string[],
): string {
  if (!caps.available) {
    warnings.push(`Backend "${caps.backendId}" is not wired yet — using its default model, no overrides.`);
    return caps.defaultModelSentinel;
  }
  if (!caps.supportsModelOverride) {
    warnings.push(`Backend "${caps.backendId}" ignores per-session model — using CLI default.`);
    return caps.defaultModelSentinel;
  }
  // Precedence: explicit per-preset model pin > user's global tier->model
  // mapping (Settings → Providers, for dynamic-catalog backends like
  // cursor-cli) > the shipped static default for this tier.
  return (
    ov.model ??
    getTierModelOverride(caps.backendId, def.defaults.modelTier) ??
    caps.modelForTier[def.defaults.modelTier]
  );
}

function resolveEffort(
  def: PresetDefinition,
  caps: BackendCapabilities,
  warnings: string[],
): EffectivePresetConfig["effort"] {
  if (!caps.supportsEffort) {
    warnings.push(`Backend "${caps.backendId}" has no effort control — preset effort skipped.`);
    return null;
  }
  return def.defaults.effort;
}

function resolveThinking(
  def: PresetDefinition,
  caps: BackendCapabilities,
  warnings: string[],
): boolean | null {
  const thinking = def.defaults.thinking;
  if (!caps.supportsThinking && thinking) {
    warnings.push(`Backend "${caps.backendId}" has no extended thinking — skipped.`);
    return null;
  }
  return thinking;
}

// Core resolution: shipped defaults + user overrides + backend capabilities
// -> one effective config, with warnings for anything degraded/dropped.
// Accepts a full PresetDefinition so it works for both built-in and custom
// presets — the caller resolves which definition to pass in. Overrides are
// merged once via effectivePresetDefinition, then every field just reads
// off the merged def (only the concrete `model` override — distinct from
// the abstract tier — still needs the raw UserPresetOverrides).
export function resolvePresetConfigFor(
  def: PresetDefinition,
  backendId: BackendId,
  userOverrides: UserPresetOverrides = getPresetOverrides(def.id),
  caps: BackendCapabilities = getCapabilities(backendId),
): EffectivePresetConfig {
  const merged = effectivePresetDefinition(def, userOverrides);
  const warnings: string[] = [];
  const model = resolveModel(merged, caps, userOverrides, warnings);
  const effort = resolveEffort(merged, caps, warnings);
  const thinking = resolveThinking(merged, caps, warnings);

  return {
    presetId: def.id,
    backendId,
    model,
    effort,
    thinking,
    permMode: merged.defaults.permMode,
    outputStyle: merged.defaults.outputStyle,
    instructions: buildPresetInstructions(merged.instructions ?? "", userOverrides),
    warnings,
  };
}

// Convenience wrapper for the common case: resolving one of the 3 built-in
// presets by id. Custom presets go through resolvePresetConfigFor directly
// once loaded (see loadCustomPresets.ts).
export function resolvePresetConfig(
  presetId: PresetId,
  backendId: BackendId,
  userOverrides?: UserPresetOverrides,
  caps?: BackendCapabilities,
): EffectivePresetConfig {
  return resolvePresetConfigFor(getPreset(presetId), backendId, userOverrides, caps);
}

// Instructions are plain guidance text — no backend capability needed to
// resolve them. Use this to append a preset's instructions for ANY provider
// (including non-agentic ones like ollama/openai/anthropic, which have no
// BackendId), and reserve resolvePresetConfig for the model/effort knobs.
export function getPresetInstructions(
  presetId: PresetId,
  userOverrides: UserPresetOverrides = getPresetOverrides(presetId),
): string {
  return buildPresetInstructions(
    effectivePresetDefinition(getPreset(presetId), userOverrides).instructions ?? "",
    userOverrides,
  );
}

// Same as getPresetInstructions, but takes a full PresetDefinition so it
// also works for CUSTOM presets (whose id isn't a PresetId literal).
export function getPresetInstructionsFor(
  def: PresetDefinition,
  userOverrides: UserPresetOverrides = getPresetOverrides(def.id),
): string {
  return buildPresetInstructions(
    effectivePresetDefinition(def, userOverrides).instructions ?? "",
    userOverrides,
  );
}
