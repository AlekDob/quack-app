import type { PresetDefinition, PresetId } from "./types";
import { duckAvatarFor } from "../subagents";

// Default tiers: builder/reviewer=balanced(→Sonnet), debugger=reasoning(→Opus)
// — root-cause work benefits most from the stronger model, so it's the one
// that stands out from the everyday balanced default (a visible model swap
// when you switch to Nora, not just an effort bump). Planning is Jack's own
// job (he's the root of the organigramma) — no separate "Planner" preset.
// These are PresetDefaults, not immutable values — the user overrides them
// (settings.ts). Each preset gets a proper first name (label) + a role
// subtitle, mirroring Jack's own identity card.
export const BUILTIN_PRESETS: Record<PresetId, PresetDefinition> = {
  builder: {
    id: "builder",
    label: "Milo",
    role: "Builder",
    source: "builtin",
    avatar: duckAvatarFor("builder"),
    purpose: "Implementation, edits, shipping code incrementally.",
    whenToUse: "The plan is clear: write/modify code in small, verifiable steps.",
    whenNotToUse: "When the path isn't decided (ask Jack) or something is broken (use Nora).",
    defaults: {
      modelTier: "balanced",
      effort: "medium",
      thinking: false,
      outputStyle: "concise",
      permMode: null,
    },
    escalation: "If an edit touches ~5+ files or the architecture doesn't hold, stop and ask Jack.",
  },
  debugger: {
    id: "debugger",
    label: "Nora",
    role: "Debugger",
    source: "builtin",
    avatar: duckAvatarFor("debugger"),
    purpose: "Root-cause analysis, reproducing failures, inspecting logs, narrowing hypotheses.",
    whenToUse: "There's a bug/regression: understand WHY before touching code.",
    whenNotToUse: "New features or purely cosmetic refactors.",
    defaults: {
      modelTier: "reasoning",
      effort: "high",
      thinking: true,
      outputStyle: "structured",
      permMode: null,
    },
    escalation: "After 2 disproven hypotheses, widen the context (logs/tests) before attempting a fix.",
  },
  reviewer: {
    id: "reviewer",
    label: "Vera",
    role: "Reviewer",
    source: "builtin",
    avatar: duckAvatarFor("reviewer"),
    purpose: "Code review, risk spotting, quality checks, concise feedback.",
    whenToUse: "Reviewing a diff/PR: correctness, risks, simplifications.",
    whenNotToUse: "When you need to implement the fixes (use Milo).",
    defaults: {
      modelTier: "balanced",
      effort: "medium",
      thinking: false,
      outputStyle: "terse-review",
      permMode: null,
    },
    escalation: "Only report real, verified issues; if unsure, mark it 'to verify' instead of asserting it.",
  },
};

export function getPreset(id: PresetId): PresetDefinition {
  return BUILTIN_PRESETS[id];
}

export const PRESET_ORDER: PresetId[] = ["builder", "debugger", "reviewer"];

export function isBuiltinPresetId(id: string): id is PresetId {
  return id in BUILTIN_PRESETS;
}

// Jack is the root identity (Project Manager/Planner), not a preset in the
// PRESETS group — but he's configurable the same way: no backing file, so
// edits persist as an override layer (settings.ts) keyed by this id. Picking
// "Jack" in the composer (presetId === null) resolves through this same
// definition, so e.g. forcing Plan mode "for Jack" is just another
// UserPresetOverrides entry, same mechanism as Milo/Nora/Vera.
export const JACK_PRESET_ID = "jack";

export function getJackDefinition(): PresetDefinition {
  return {
    id: JACK_PRESET_ID,
    label: "Jack",
    role: "Project Manager · Planner",
    source: "builtin",
    avatar: "/jack.jpeg",
    purpose: "Reasoning, decomposition, architecture, sequencing, tradeoffs.",
    whenToUse: "The default identity — no preset picked.",
    whenNotToUse: "",
    defaults: {
      modelTier: "balanced",
      effort: "medium",
      thinking: null,
      outputStyle: "concise",
      permMode: null,
    },
    escalation: "",
    instructions: "",
  };
}
