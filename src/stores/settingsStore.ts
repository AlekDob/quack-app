import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { EffortLevel, ModePreset, AgentModePresets } from '../types';

/**
 * Normalize legacy model short names to Supabase IDs.
 * Legacy values ('sonnet', 'opus', 'haiku') were used before Supabase config migration.
 * These don't match <select> option values, causing visual mismatch bugs.
 */
const LEGACY_MODEL_MAP: Record<string, string> = {
  'sonnet': 'sonnet45',
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
}

interface SettingsState {
  // Settings groups
  claude: ClaudeSettings;
  terminal: TerminalSettings;
  general: GeneralSettings;
  agentModePresets: AgentModePresets;

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

  // Actions - Global
  resetAllSettings: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;

  // Actions - Agent Mode Presets
  updateModePreset: (mode: 'bypass' | 'plan', preset: Partial<ModePreset>) => void;
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
};

const defaultClaudeSettings: ClaudeSettings = {
  apiKey: null,
  model: 'sonnet45', // Use Supabase IDs: 'sonnet45' | 'opus46' | 'haiku45' (mapped in modelService.ts)
  permissionMode: 'act',
  maxTokens: 4096,
  temperature: 0.7,
  effort: 'medium', // SDK 0.1.54+ - Default balanced effort
};

// Anthropic recommended defaults for agent modes
// IMPORTANT: Use Supabase model IDs (sonnet45, opus46, haiku45), NOT legacy short names (sonnet, opus, haiku)
// Legacy short names don't match <select> option values, causing a visual mismatch bug
const defaultAgentModePresets: AgentModePresets = {
  bypass: {
    model: 'sonnet45',
    thinkingMode: 'auto',
    effort: 'medium',
  },
  plan: {
    model: 'opus46',
    thinkingMode: 'auto',
    effort: 'medium',
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

        // Global actions
        resetAllSettings: () => set({
          claude: defaultClaudeSettings,
          terminal: defaultTerminalSettings,
          general: defaultGeneralSettings,
        }),

        exportSettings: () => {
          const state = get();
          const exportData = {
            claude: { ...state.claude, apiKey: null }, // Don't export API key
            terminal: state.terminal,
            general: state.general,
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
          };
          return JSON.stringify(exportData, null, 2);
        },

        importSettings: (json) => {
          try {
            const data = JSON.parse(json);
            if (data.version && data.terminal && data.general) {
              set({
                terminal: { ...defaultTerminalSettings, ...data.terminal },
                general: { ...defaultGeneralSettings, ...data.general },
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
        version: 1,
        partialize: (state) => ({
          // Persist all settings
          claude: state.claude,
          terminal: state.terminal,
          general: state.general,
          agentModePresets: state.agentModePresets,
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
              for (const mode of ['bypass', 'plan'] as const) {
                if (persisted.agentModePresets[mode]?.model) {
                  persisted.agentModePresets[mode].model = normalizeModelId(persisted.agentModePresets[mode].model);
                }
              }
            }
          }
          return persisted;
        },
      }
    ),
    { name: 'settings-store' }
  )
);