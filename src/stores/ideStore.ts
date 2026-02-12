import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// Types
// =============================================================================

export interface IDEInfo {
  id: string;
  name: string;
  appPath: string;
  cli: string;
  cliAvailable: boolean;
  appExists: boolean;
  supportsDiff: boolean;
}

// Installed app from Rust backend (same as ActionIcons)
export interface InstalledApp {
  id: string;
  name: string;
  app_path: string;
  category: 'ide' | 'terminal' | 'finder';
  icon_base64: string | null;
}

export interface IDEConfig {
  preferredIDE: string | null;
  autoLaunch: boolean;
  syncFocus: boolean;
  installedIDEs: string[];
  hasCompletedOnboarding: boolean;
}

interface IDEState extends IDEConfig {
  // Detected IDEs
  detectedIDEs: IDEInfo[];
  isDetecting: boolean;

  // Installed apps (from get_installed_apps - includes real icons)
  installedApps: InstalledApp[];
  isLoadingApps: boolean;

  // Actions
  detectInstalledIDEs: () => Promise<void>;
  loadInstalledApps: () => Promise<void>;
  setPreferredIDE: (ideId: string) => Promise<void>;
  setAutoLaunch: (enabled: boolean) => void;
  setSyncFocus: (enabled: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;

  // IDE Operations (calls MCP server via Tauri)
  openFileInIDE: (path: string, line?: number, column?: number) => Promise<string>;
  openMultipleFilesInIDE: (paths: string[]) => Promise<string>;
  openProjectInIDE: (path: string) => Promise<string>;
  focusIDE: () => Promise<string>;
  arrangeWindowsSideBySide: () => Promise<string>;
  syncFocusBothApps: () => Promise<string>;
}

// =============================================================================
// IDE Registry (mirror of MCP server for UI icons/names)
// =============================================================================

export const IDE_REGISTRY: Record<string, { name: string; icon: string }> = {
  vscode: { name: 'Visual Studio Code', icon: 'vscode' },
  cursor: { name: 'Cursor', icon: 'cursor' },
  windsurf: { name: 'Windsurf', icon: 'windsurf' },
  zed: { name: 'Zed', icon: 'zed' },
  intellij: { name: 'IntelliJ IDEA', icon: 'jetbrains' },
  webstorm: { name: 'WebStorm', icon: 'jetbrains' },
  pycharm: { name: 'PyCharm', icon: 'jetbrains' },
  goland: { name: 'GoLand', icon: 'jetbrains' },
  rubymine: { name: 'RubyMine', icon: 'jetbrains' },
  sublime: { name: 'Sublime Text', icon: 'sublime' },
};

// =============================================================================
// Helper: Execute IDE commands via shell (direct, no MCP needed for UI actions)
// =============================================================================

async function executeIDECommand(cli: string, args: string[]): Promise<string> {
  try {
    // Use Tauri's shell command
    const result = await invoke<string>('execute_ide_command', { cli, args });
    return result;
  } catch (error) {
    console.error('[IDE Store] Command failed:', error);
    throw error;
  }
}

// Helper to get CLI command based on IDE
function getIDECli(ideId: string): string {
  const cliMap: Record<string, string> = {
    vscode: 'code',
    cursor: 'cursor',
    windsurf: 'windsurf',
    zed: 'zed',
    intellij: 'idea',
    webstorm: 'webstorm',
    pycharm: 'pycharm',
    goland: 'goland',
    rubymine: 'rubymine',
    sublime: 'subl',
  };
  return cliMap[ideId] || 'code';
}

// Helper to build open file arguments based on IDE style
function buildOpenArgs(ideId: string, path: string, line?: number, column?: number): string[] {
  const vscodeLike = ['vscode', 'cursor', 'windsurf'];
  const jetbrains = ['intellij', 'webstorm', 'pycharm', 'goland', 'rubymine'];

  if (vscodeLike.includes(ideId)) {
    // VS Code style: --goto file:line:column
    if (line) {
      return ['--goto', `${path}:${line}${column ? ':' + column : ''}`];
    }
    return [path];
  }

  if (jetbrains.includes(ideId)) {
    // JetBrains style: --line N file
    if (line) {
      return ['--line', line.toString(), path];
    }
    return [path];
  }

  if (ideId === 'zed' || ideId === 'sublime') {
    // Zed/Sublime style: file:line
    if (line) {
      return [`${path}:${line}`];
    }
    return [path];
  }

  return [path];
}

// =============================================================================
// Store
// =============================================================================

export const useIDEStore = create<IDEState>()(
  persist(
    (set, get) => ({
      // Initial state
      preferredIDE: null,
      autoLaunch: false,
      syncFocus: true,
      installedIDEs: [],
      hasCompletedOnboarding: false,
      detectedIDEs: [],
      isDetecting: false,
      installedApps: [],
      isLoadingApps: false,

      // Detect installed IDEs
      detectInstalledIDEs: async () => {
        set({ isDetecting: true });

        try {
          // Call Tauri command to detect IDEs
          const result = await invoke<IDEInfo[]>('detect_installed_ides');

          set({
            detectedIDEs: result,
            installedIDEs: result.map(ide => ide.id),
            isDetecting: false,
          });
        } catch (error) {
          console.error('[IDE Store] Detection failed:', error);

          // Fallback: try to detect via checking common paths
          // This runs in the frontend but is less reliable
          set({ isDetecting: false });
        }
      },

      // Load installed apps (same source as ActionIcons dropdown)
      loadInstalledApps: async () => {
        set({ isLoadingApps: true });
        try {
          const apps = await invoke<InstalledApp[]>('get_installed_apps');
          set({ installedApps: apps, isLoadingApps: false });
        } catch (error) {
          console.error('[IDE Store] Failed to load installed apps:', error);
          set({ isLoadingApps: false });
        }
      },

      // Set preferred IDE
      setPreferredIDE: async (ideId: string) => {
        set({ preferredIDE: ideId });

        // Also save to MCP config file via Tauri
        try {
          await invoke('set_preferred_ide', { ideId });
        } catch (error) {
          console.error('[IDE Store] Failed to save preference:', error);
        }
      },

      // Settings
      setAutoLaunch: (enabled: boolean) => set({ autoLaunch: enabled }),
      setSyncFocus: (enabled: boolean) => set({ syncFocus: enabled }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({
        hasCompletedOnboarding: false,
        preferredIDE: null,
      }),

      // IDE Operations
      openFileInIDE: async (path: string, line?: number, column?: number) => {
        const { preferredIDE } = get();
        console.log('[IDE Store] openFileInIDE called. Current preferredIDE from store:', preferredIDE);

        if (!preferredIDE) {
          console.error('[IDE Store] No preferred IDE set!');
          throw new Error('No preferred IDE set');
        }

        console.log('[IDE Store] Opening file:', { path, line, column, ideId: preferredIDE });

        // Use dedicated Rust command that handles path escaping correctly
        const result = await invoke<string>('open_file_in_ide', {
          ideId: preferredIDE,
          filePath: path,
          line: line ?? null,
          column: column ?? null,
        });

        console.log('[IDE Store] Rust command result:', result);
        return result;
      },

      openMultipleFilesInIDE: async (paths: string[]) => {
        const { preferredIDE } = get();
        if (!preferredIDE) {
          throw new Error('No preferred IDE set');
        }

        console.log('[IDE Store] Opening multiple files:', { paths, ideId: preferredIDE });

        // Use dedicated Rust command
        return invoke<string>('open_multiple_files_in_ide', {
          ideId: preferredIDE,
          filePaths: paths,
        });
      },

      openProjectInIDE: async (path: string) => {
        const { preferredIDE } = get();
        if (!preferredIDE) {
          throw new Error('No preferred IDE set');
        }

        const cli = getIDECli(preferredIDE);
        return executeIDECommand(cli, [path]);
      },

      focusIDE: async () => {
        const { preferredIDE } = get();
        if (!preferredIDE) {
          throw new Error('No preferred IDE set');
        }

        const ideName = IDE_REGISTRY[preferredIDE]?.name || preferredIDE;
        return invoke<string>('focus_ide', { ideName });
      },

      arrangeWindowsSideBySide: async () => {
        const { preferredIDE } = get();
        if (!preferredIDE) {
          throw new Error('No preferred IDE set');
        }

        const ideName = IDE_REGISTRY[preferredIDE]?.name || preferredIDE;
        return invoke<string>('arrange_windows_side_by_side', { ideName });
      },

      syncFocusBothApps: async () => {
        const { preferredIDE } = get();
        if (!preferredIDE) {
          throw new Error('No preferred IDE set');
        }

        const ideName = IDE_REGISTRY[preferredIDE]?.name || preferredIDE;
        return invoke<string>('sync_focus_both_apps', { ideName });
      },
    }),
    {
      name: 'quack-ide-settings',
      partialize: (state) => ({
        preferredIDE: state.preferredIDE,
        autoLaunch: state.autoLaunch,
        syncFocus: state.syncFocus,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectPreferredIDEName = (state: IDEState): string | null => {
  if (!state.preferredIDE) return null;
  // Try installed apps first (has real names), then fallback to registry
  const app = state.installedApps.find(a => a.id === state.preferredIDE);
  if (app) return app.name;
  return IDE_REGISTRY[state.preferredIDE]?.name || state.preferredIDE;
};

export const selectHasPreferredIDE = (state: IDEState): boolean => {
  return state.preferredIDE !== null;
};

export const selectShouldShowOnboarding = (state: IDEState): boolean => {
  return !state.hasCompletedOnboarding && state.preferredIDE === null;
};

export const selectInstalledIDEApps = (state: IDEState): InstalledApp[] => {
  return state.installedApps.filter(a => a.category === 'ide');
};
