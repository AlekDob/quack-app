import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { EffortLevel, ModePreset, AgentModePresets, LLMProviderType } from '../types';
import { applyTypography, DEFAULT_TYPOGRAPHY, DEFAULT_CUSTOM_FONT_SIZE, safeCustomSize } from '../constants/typography';
import type { TypographySettings, FontSizePreset } from '../constants/typography';
import { applyAccentColor, DEFAULT_ACCENT } from '../utils/accentColor';
import { defaultEffortForModel } from '../services/modelService';

/**
 * Normalize legacy model short names to Supabase IDs.
 * Legacy values ('sonnet', 'opus', 'haiku') were used before Supabase config migration.
 * These don't match <select> option values, causing visual mismatch bugs.
 */
const LEGACY_MODEL_MAP: Record<string, string> = {
  'sonnet': 'sonnet46',
  'sonnet45': 'sonnet46', // Sonnet 4.5 deprecated, upgrade to 4.6
  'opus': 'opus46',
  'haiku': 'haiku45',
};

function normalizeModelId(model: string): string {
  return LEGACY_MODEL_MAP[model] ?? model;
}

interface ClaudeSettings {
  apiKey: string | null;
  model: string;
  permissionMode: 'plan' | 'act' | 'bypass';
  maxTokens: number;
  temperature: number;
  effort: EffortLevel; // SDK 0.1.54+ - Controls quality vs speed/cost tradeoff
  // LLM Provider settings (Anthropic, Ollama, Custom)
  provider: LLMProviderType;
  providerBaseUrl: string;  // Custom endpoint (e.g., http://localhost:11434 for Ollama)
  providerApiKey: string;   // API key for custom providers
  ollamaModel: string;      // Model name for Ollama/custom (e.g., 'qwen3-coder')
  // BTW Side-Chain Chat settings
  btwModel: string;         // Model for BTW quick queries (default: haiku45)
  // Bedrock/Vertex model override — when set, bypasses normal model resolution
  // Brain: fix-bedrock-model-override
  bedrockModelOverride: string;  // Full Bedrock ARN or model ID (e.g. us.anthropic.claude-sonnet-4-5-20250929-v1:0)
  // Tool Search deferred-loading mode (ENABLE_TOOL_SEARCH). Maps to env var in stream-daemon.js.
  toolSearchMode: 'off' | 'auto' | 'aggressive' | 'always';
}

interface TerminalSettings {
  defaultShell: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  theme: string;
}

// Tool GIF category settings
interface ToolGifCategories {
  brain: boolean;      // MCP Brain tools (search, create, etc.)
  fileOps: boolean;    // Read, Write, Edit
  shell: boolean;      // Bash, terminal commands
  search: boolean;     // Grep, Glob, WebSearch
  agents: boolean;     // Task/subagent tools
}

interface GeneralSettings {
  userName: string; // Display name — auto-injected into CLAUDE.md global for diary entries
  autoSave: boolean;
  autoSaveInterval: number;
  confirmOnExit: boolean;
  enableNotifications: boolean;
  enableSounds: boolean;
  showWelcomeOnStartup: boolean;
  language: 'en' | 'it';
  enableToolGifs: boolean; // Show GIF reactions when tools execute
  toolGifCategories: ToolGifCategories; // Per-category toggle
  giphyApiKey: string; // User's own Giphy API key
  btwShortcut: string; // Keyboard shortcut for BTW drawer (default: Ctrl+B)
  showTurnTokenStats: boolean; // Show per-turn cache/token stats below each response
}

interface AppearanceSettings {
  accentColor: string; // Hex color for primary accent (default #f28c52)
}

interface SettingsState {
  // Settings groups
  claude: ClaudeSettings;
  terminal: TerminalSettings;
  general: GeneralSettings;
  agentModePresets: AgentModePresets;
  typography: TypographySettings;
  appearance: AppearanceSettings;

  // Actions - Claude
  setClaudeApiKey: (key: string | null) => void;
  setClaudeModel: (model: string) => void;
  setClaudePermissionMode: (mode: 'plan' | 'act' | 'bypass') => void;
  setClaudeEffort: (effort: EffortLevel) => void;
  updateClaudeSettings: (settings: Partial<ClaudeSettings>) => void;

  // Actions - Terminal
  updateTerminalSettings: (settings: Partial<TerminalSettings>) => void;
  resetTerminalDefaults: () => void;

  // Actions - General
  updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;
  toggleAutoSave: () => void;
  toggleNotifications: () => void;
  toggleSounds: () => void;
  toggleToolGifs: () => void;
  setGiphyApiKey: (key: string) => void;

  // Actions - Typography
  setFontSizePreset: (preset: FontSizePreset) => void;
  setCustomFontSize: (size: number) => void;
  updateTypography: (settings: Partial<TypographySettings>) => void;
  resetTypography: () => void;

  // Actions - Appearance
  setAccentColor: (hex: string) => void;
  resetAccentColor: () => void;

  // Actions - Global
  resetAllSettings: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;

  // Actions - Agent Mode Presets
  updateModePreset: (mode: 'bypass' | 'plan' | 'ask' | 'debug' | 'chat', preset: Partial<ModePreset>) => void;
  resetModePresets: () => void;
}

const defaultTerminalSettings: TerminalSettings = {
  defaultShell: '/bin/zsh',
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Monaco, Menlo, monospace',
  lineHeight: 1.2,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,
  theme: 'dark',
};

const defaultToolGifCategories: ToolGifCategories = {
  brain: true,      // Brain/Memory tools - always fun
  fileOps: true,    // File operations
  shell: true,      // Bash commands
  search: false,    // Search tools - often too frequent
  agents: true,     // Subagent tasks
};

const defaultGeneralSettings: GeneralSettings = {
  userName: '',
  autoSave: true,
  autoSaveInterval: 30,
  confirmOnExit: true,
  enableNotifications: true,
  enableSounds: true,
  showWelcomeOnStartup: true,
  language: 'en',
  enableToolGifs: false, // GIF reactions disabled by default (requires Giphy API key)
  toolGifCategories: defaultToolGifCategories,
  giphyApiKey: '', // User provides their own key
  btwShortcut: 'Ctrl+B', // BTW drawer shortcut
  showTurnTokenStats: false, // Off by default — opt-in for power users
};

const defaultClaudeSettings: ClaudeSettings = {
  apiKey: null,
  model: 'opus47', // Supabase ID; see modelService.ts
  permissionMode: 'act',
  maxTokens: 4096,
  temperature: 0.7,
  effort: 'xhigh', // Opus 4.7 recommended default (fallbacks to 'high' on older models)
  provider: 'anthropic',
  providerBaseUrl: '',
  providerApiKey: '',
  ollamaModel: '',
  btwModel: 'haiku45', // BTW Side-Chain: fast & cheap by default
  bedrockModelOverride: '', // Empty = use normal model resolution
  toolSearchMode: 'auto', // Default: ENABLE_TOOL_SEARCH=auto (10% threshold)
};

// Anthropic recommended defaults for agent modes
// IMPORTANT: Use Supabase model IDs (sonnet45, opus46, haiku45), NOT legacy short names (sonnet, opus, haiku)
// Legacy short names don't match <select> option values, causing a visual mismatch bug
const defaultAgentModePresets: AgentModePresets = {
  bypass: {
    model: 'opus47',
    thinkingMode: 'auto',
    effort: 'xhigh', // Opus 4.7 recommended default
  },
  plan: {
    model: 'opus47',
    thinkingMode: 'auto',
    effort: 'xhigh',
  },
  debug: {
    model: 'opus47',
    thinkingMode: 'hard', // Forces extended thinking for root cause analysis
    effort: 'max', // Deepest reasoning for bug hunting
  },
  ask: {
    model: 'opus47',
    thinkingMode: 'auto',
    effort: 'xhigh',
  },
  chat: {
    model: 'sonnet46',
    thinkingMode: 'auto',
    effort: 'low', // Minimize token consumption for conversational use
  },
};

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        claude: defaultClaudeSettings,
        terminal: defaultTerminalSettings,
        general: defaultGeneralSettings,
        agentModePresets: defaultAgentModePresets,
        typography: DEFAULT_TYPOGRAPHY,
        appearance: { accentColor: DEFAULT_ACCENT },

        // Claude actions
        setClaudeApiKey: (key) => set((state) => ({
          claude: { ...state.claude, apiKey: key },
        })),

        setClaudeModel: (model) => set((state) => ({
          claude: { ...state.claude, model },
        })),

        setClaudePermissionMode: (mode) => set((state) => ({
          claude: { ...state.claude, permissionMode: mode },
        })),

        setClaudeEffort: (effort) => set((state) => ({
          claude: { ...state.claude, effort },
        })),

        updateClaudeSettings: (settings) => set((state) => ({
          claude: { ...state.claude, ...settings },
        })),

        // Terminal actions
        updateTerminalSettings: (settings) => set((state) => ({
          terminal: { ...state.terminal, ...settings },
        })),

        resetTerminalDefaults: () => set({
          terminal: defaultTerminalSettings,
        }),

        // General actions
        updateGeneralSettings: (settings) => set((state) => ({
          general: { ...state.general, ...settings },
        })),

        toggleAutoSave: () => set((state) => ({
          general: { ...state.general, autoSave: !state.general.autoSave },
        })),

        toggleNotifications: () => set((state) => ({
          general: { ...state.general, enableNotifications: !state.general.enableNotifications },
        })),

        toggleSounds: () => set((state) => ({
          general: { ...state.general, enableSounds: !state.general.enableSounds },
        })),

        toggleToolGifs: () => set((state) => ({
          general: { ...state.general, enableToolGifs: !state.general.enableToolGifs },
        })),

        setGiphyApiKey: (key: string) => set((state) => ({
          general: { ...state.general, giphyApiKey: key },
        })),

        // Typography actions
        setFontSizePreset: (preset) => {
          set((state) => {
            const newTypo = { ...state.typography, fontSizePreset: preset };
            applyTypography(newTypo);
            return { typography: newTypo };
          });
        },

        setCustomFontSize: (size) => {
          const clamped = safeCustomSize(size);
          set((state) => {
            const newTypo = { ...state.typography, fontSizePreset: 'C' as FontSizePreset, customFontSize: clamped };
            applyTypography(newTypo);
            return { typography: newTypo };
          });
        },

        updateTypography: (settings) => {
          set((state) => {
            const newTypo = { ...state.typography, ...settings };
            applyTypography(newTypo);
            return { typography: newTypo };
          });
        },

        resetTypography: () => {
          applyTypography(DEFAULT_TYPOGRAPHY);
          set({ typography: DEFAULT_TYPOGRAPHY });
        },

        // Appearance actions
        setAccentColor: (hex: string) => {
          applyAccentColor(hex);
          set({ appearance: { accentColor: hex } });
        },

        resetAccentColor: () => {
          applyAccentColor(DEFAULT_ACCENT);
          set({ appearance: { accentColor: DEFAULT_ACCENT } });
        },

        // Global actions
        resetAllSettings: () => {
          applyTypography(DEFAULT_TYPOGRAPHY);
          applyAccentColor(DEFAULT_ACCENT);
          set({
            claude: defaultClaudeSettings,
            terminal: defaultTerminalSettings,
            general: defaultGeneralSettings,
            typography: DEFAULT_TYPOGRAPHY,
            appearance: { accentColor: DEFAULT_ACCENT },
          });
        },

        exportSettings: () => {
          const state = get();
          const exportData = {
            claude: { ...state.claude, apiKey: null }, // Don't export API key
            terminal: state.terminal,
            general: state.general,
            typography: state.typography,
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
          };
          return JSON.stringify(exportData, null, 2);
        },

        importSettings: (json) => {
          try {
            const data = JSON.parse(json);
            if (data.version && data.terminal && data.general) {
              const typo = { ...DEFAULT_TYPOGRAPHY, ...data.typography };
              applyTypography(typo);
              set({
                terminal: { ...defaultTerminalSettings, ...data.terminal },
                general: { ...defaultGeneralSettings, ...data.general },
                typography: typo,
                // Don't import Claude settings for security
              });
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },

        // Agent Mode Presets actions
        updateModePreset: (mode, preset) => set((state) => ({
          agentModePresets: {
            ...state.agentModePresets,
            [mode]: { ...state.agentModePresets[mode], ...preset },
          },
        })),

        resetModePresets: () => set({
          agentModePresets: defaultAgentModePresets,
        }),
      }),
      {
        name: 'settings-storage',
        version: 12,
        partialize: (state) => ({
          // Persist all settings
          claude: state.claude,
          terminal: state.terminal,
          general: state.general,
          agentModePresets: state.agentModePresets,
          typography: state.typography,
          appearance: state.appearance,
        }),
        // Migrate persisted legacy model IDs (sonnet→sonnet45, opus→opus46, haiku→haiku45)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        migrate: (persisted: any, version: number) => {
          if (version === 0 || version === undefined) {
            // Normalize legacy model IDs in claude settings
            if (persisted.claude?.model) {
              persisted.claude.model = normalizeModelId(persisted.claude.model);
            }
            // Normalize legacy model IDs in mode presets
            if (persisted.agentModePresets) {
              for (const mode of ['bypass', 'plan', 'ask', 'debug', 'chat'] as const) {
                if (persisted.agentModePresets[mode]?.model) {
                  persisted.agentModePresets[mode].model = normalizeModelId(persisted.agentModePresets[mode].model);
                }
              }
            }
          }
          // Ensure debug preset exists (added in v1, users with v0 persisted state won't have it)
          if (persisted.agentModePresets && !persisted.agentModePresets.debug) {
            persisted.agentModePresets.debug = defaultAgentModePresets.debug;
          }
          // v3: Force extended thinking for debug mode (was 'auto', now 'hard')
          if (version < 3 && persisted.agentModePresets?.debug) {
            persisted.agentModePresets.debug.thinkingMode = 'hard';
          }
          // v4: Add BTW Side-Chain fields (btwModel in claude, btwShortcut in general)
          if (version < 4) {
            if (persisted.claude && !persisted.claude.btwModel) {
              persisted.claude.btwModel = 'haiku45';
            }
            if (persisted.general && !persisted.general.btwShortcut) {
              persisted.general.btwShortcut = 'Ctrl+B';
            }
          }
          // v5: Add Chat mode preset (Sonnet, low effort, conversational)
          if (version < 5) {
            if (persisted.agentModePresets && !persisted.agentModePresets.chat) {
              persisted.agentModePresets.chat = defaultAgentModePresets.chat;
            }
          }
          // v6: Add Ask mode preset (Opus, medium effort, supervised execution)
          if (version < 6) {
            if (persisted.agentModePresets && !persisted.agentModePresets.ask) {
              persisted.agentModePresets.ask = defaultAgentModePresets.ask;
            }
          }
          // v7: Add Typography settings (font size presets + font family)
          if (version < 7) {
            if (!persisted.typography) {
              persisted.typography = {
                ...DEFAULT_TYPOGRAPHY,
                // Preserve existing mono font from terminal settings if available
                fontFamilyMono: persisted.terminal?.fontFamily || DEFAULT_TYPOGRAPHY.fontFamilyMono,
              };
            }
          }
          // v8: Add Appearance settings (accent color)
          if (version < 8) {
            if (!persisted.appearance) {
              persisted.appearance = { accentColor: DEFAULT_ACCENT };
            }
          }
          // v9: Migrate sonnet45 → sonnet46 in all mode presets and main model
          if (version < 9) {
            if (persisted.claude?.model === 'sonnet45') {
              persisted.claude.model = 'sonnet46';
            }
            if (persisted.agentModePresets) {
              for (const mode of ['bypass', 'plan', 'ask', 'debug', 'chat'] as const) {
                if (persisted.agentModePresets[mode]?.model === 'sonnet45') {
                  persisted.agentModePresets[mode].model = 'sonnet46';
                }
              }
            }
          }
          // v10: Add customFontSize field + M preset now 13px base (was 14px)
          if (version < 10) {
            if (persisted.typography) {
              if (!persisted.typography.customFontSize || Number.isNaN(persisted.typography.customFontSize)) {
                persisted.typography.customFontSize = DEFAULT_CUSTOM_FONT_SIZE;
              }
            }
          }
          // v11: Opus 4.7 default effort = 'xhigh'. Bump opus46/opus47 presets whose
          // effort is still at the legacy 'medium' default so upgraders see the
          // Anthropic-recommended level. Explicit user overrides to low/high/max
          // are preserved; only the default-looking 'medium' gets rewritten.
          if (version < 11) {
            if (persisted.claude?.model === 'opus46') {
              persisted.claude.model = 'opus47';
            }
            if (persisted.claude && persisted.claude.effort === 'medium' && persisted.claude.model) {
              persisted.claude.effort = defaultEffortForModel(persisted.claude.model);
            }
            if (persisted.agentModePresets) {
              for (const mode of ['bypass', 'plan', 'ask', 'debug', 'chat'] as const) {
                const p = persisted.agentModePresets[mode];
                if (!p) continue;
                if (p.model === 'opus46') p.model = 'opus47';
                if (p.effort === 'medium') {
                  p.effort = defaultEffortForModel(p.model);
                }
              }
            }
          }
          // v12: Add toolSearchMode (ENABLE_TOOL_SEARCH preset). Default 'auto' matches prior hardcoded value.
          if (version < 12) {
            if (persisted.claude && !persisted.claude.toolSearchMode) {
              persisted.claude.toolSearchMode = 'auto';
            }
          }
          return persisted;
        },
      }
    ),
    { name: 'settings-store' }
  )
);