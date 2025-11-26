import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { EffortLevel } from '../types';

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

interface GeneralSettings {
  autoSave: boolean;
  autoSaveInterval: number;
  confirmOnExit: boolean;
  enableNotifications: boolean;
  enableSounds: boolean;
  showWelcomeOnStartup: boolean;
  language: 'en' | 'it';
}

interface SettingsState {
  // Settings groups
  claude: ClaudeSettings;
  terminal: TerminalSettings;
  general: GeneralSettings;

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

  // Actions - Global
  resetAllSettings: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
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

const defaultGeneralSettings: GeneralSettings = {
  autoSave: true,
  autoSaveInterval: 30,
  confirmOnExit: true,
  enableNotifications: true,
  enableSounds: true,
  showWelcomeOnStartup: true,
  language: 'en',
};

const defaultClaudeSettings: ClaudeSettings = {
  apiKey: null,
  model: 'sonnet', // Use friendly names: 'sonnet' | 'opus' | 'haiku' (mapped in claudeSDK.ts)
  permissionMode: 'act',
  maxTokens: 4096,
  temperature: 0.7,
  effort: 'medium', // SDK 0.1.54+ - Default balanced effort
};

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        claude: defaultClaudeSettings,
        terminal: defaultTerminalSettings,
        general: defaultGeneralSettings,

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
      }),
      {
        name: 'settings-storage',
        partialize: (state) => ({
          // Persist all settings
          claude: state.claude,
          terminal: state.terminal,
          general: state.general,
        }),
      }
    ),
    { name: 'settings-store' }
  )
);