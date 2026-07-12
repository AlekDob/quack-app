import type { BackendCapabilities, BackendId } from "./types";
import { makeQualifiedModel } from "../providers/types";

const CC = (m: string) => makeQualifiedModel("claude-code", m);
const CU = (m: string) => makeQualifiedModel("cursor-cli", m);
const OC = (m: string) => makeQualifiedModel("opencode-cli", m);

// Capability model + tier->model mapping per backend. A static map today —
// no framework needed for 4 known backends. Degradation is explicit here:
// `available:false` (codex has no bridge yet) or a false capability flag
// drives resolvePresetConfig to skip that knob and record a warning.
export const BACKEND_CAPABILITIES: Record<BackendId, BackendCapabilities> = {
  "claude-code": {
    backendId: "claude-code",
    available: true,
    supportsModelOverride: true,
    supportsEffort: true,
    supportsThinking: true,
    modelForTier: { reasoning: CC("opus"), balanced: CC("sonnet"), fast: CC("haiku") },
    defaultModelSentinel: CC("default"),
  },
  "cursor-cli": {
    backendId: "cursor-cli",
    available: true,
    supportsModelOverride: true,
    supportsEffort: false,
    supportsThinking: false,
    // Cursor's catalog is dynamic (`cursor-agent --list-models`); tiers point
    // at the CLI's own default sentinel until concrete model ids are mapped.
    modelForTier: { reasoning: CU("default"), balanced: CU("default"), fast: CU("default") },
    defaultModelSentinel: CU("default"),
  },
  "opencode-cli": {
    backendId: "opencode-cli",
    available: true,
    supportsModelOverride: true,
    supportsEffort: false,
    supportsThinking: false,
    modelForTier: { reasoning: OC("default"), balanced: OC("default"), fast: OC("default") },
    defaultModelSentinel: OC("default"),
  },
  // No Rust/frontend bridge exists for Codex CLI yet — kept as a known
  // BackendId so the domain model doesn't need to change once it lands.
  codex: {
    backendId: "codex",
    available: false,
    supportsModelOverride: false,
    supportsEffort: false,
    supportsThinking: false,
    modelForTier: { reasoning: "codex:default", balanced: "codex:default", fast: "codex:default" },
    defaultModelSentinel: "codex:default",
  },
};

export function getCapabilities(id: BackendId): BackendCapabilities {
  return BACKEND_CAPABILITIES[id];
}
