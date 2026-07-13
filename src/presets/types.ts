import type { CcEffort } from "../components/EffortPopover";

// Built-in presets (stable ids, used as override keys). Jack (PM root) is
// separate — see getJackDefinition(). No "planner" preset: Jack covers that.
export type PresetId = "builder" | "debugger" | "reviewer" | "companion";

// Backend che i preset conoscono. `codex` è noto ma non ancora wired (vedi capabilities).
export type BackendId = "claude-code" | "cursor-cli" | "opencode-cli" | "codex";

// Modello concreto qualificato "<providerId>:<modelId>" (riusa parseQualifiedModel).
export type ModelId = string;

// Riusa la scala effort canonica di Quack — nessuna scala nuova.
export type EffortLevel = CcEffort;

// Astrazione backend-agnostic del "quanto forte" deve essere il modello.
// Ogni backend la mappa al suo modello concreto (capabilities.modelForTier).
export type ModelTier = "reasoning" | "balanced" | "fast";

export type OutputStyle = "concise" | "structured" | "terse-review";

// Valori di PRODOTTO (spediti con l'app). Immutabili a runtime, sovrascrivibili via settings.
export interface PresetDefaults {
  modelTier: ModelTier; // NON un nome-modello: resta backend-agnostic
  effort: EffortLevel;
  thinking: boolean | null; // tri-state come ccThinking
  outputStyle: OutputStyle;
  // Claude Code permission mode this preset forces when active: null = "Ask"
  // (no forced mode). CC-specific concept (like effort/thinking), applied
  // only when the active backend is claude-code.
  permMode: string | null;
}

// Definizione completa di un preset (metadati + defaults).
// Built-in: vivono in builtins.ts (source "builtin"). Custom: da .quack/presets/*.md
// (source "custom", path = file per il write-back frontmatter).
export interface PresetDefinition {
  id: string; // built-in = PresetId; custom = slug del file
  label: string; // proper first name (e.g. "Milo") — mirrors Jack's identity card
  role: string; // subtitle under the name (e.g. "Builder")
  source: "builtin" | "custom";
  avatar: string; // URL avatar; default via duckAvatarFor(id), riuso pool esistente
  purpose: string;
  whenToUse: string;
  whenNotToUse: string;
  defaults: PresetDefaults;
  escalation: string; // guida su quando salire di tier/effort
  instructions?: string; // custom: corpo del .md; built-in: viene da instructions.ts
  path?: string | null; // custom: path assoluto del .md (write-back frontmatter)
}

// Scelte dell'utente per un preset — tutto opzionale, ognuna vince sul default.
// Built-in presets (Milo/Nora/Vera) have no backing file, so editing one from
// the "New agent" drawer persists here instead of writing a .md — this is
// what makes them "modificabili" too, not just custom presets.
export interface UserPresetOverrides {
  label?: string; // override the proper name shown everywhere
  role?: string; // override the subtitle
  description?: string; // override purpose/tooltip text
  avatar?: string; // override avatar (duck del pool o path custom)
  modelTier?: ModelTier; // override the abstract tier (not a concrete model)
  model?: ModelId; // modello concreto qualificato; vince sul tier
  effort?: EffortLevel;
  thinking?: boolean | null;
  outputStyle?: OutputStyle;
  permMode?: string | null; // override the forced Claude Code permission mode
  instructions?: string; // full override replacing the base instruction block
  instructionSuffix?: string; // append extra on top of instructions (future-friendly)
}

// Config finale risolta per (preset + backend + override + capabilities).
export interface EffectivePresetConfig {
  presetId: string;
  backendId: BackendId;
  model: ModelId; // concreto, oppure sentinel "default" se non applicabile
  effort: EffortLevel | null; // null se il backend non supporta effort
  thinking: boolean | null;
  permMode: string | null; // forced permission mode (CC only — caller gates by backend)
  outputStyle: OutputStyle;
  instructions: string; // blocco append finale (base preset + suffix utente)
  warnings: string[]; // degradazioni applicate (es. "effort ignorato su cursor-cli")
}

// Cosa un backend sa fare — guida la risoluzione e la degradazione.
export interface BackendCapabilities {
  backendId: BackendId;
  available: boolean; // false = bridge non ancora presente (codex oggi)
  supportsModelOverride: boolean; // può cambiare modello per sessione
  supportsEffort: boolean; // ha una manopola effort/reasoning
  supportsThinking: boolean; // extended thinking
  modelForTier: Record<ModelTier, ModelId>; // tier astratto -> modelId concreto per QUESTO backend
  defaultModelSentinel: ModelId; // es. "claude-code:default"
}
