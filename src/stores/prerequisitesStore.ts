import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// Types
// =============================================================================

export interface PrerequisiteStatus {
  name: string;
  installed: boolean;
  version: string | null;
  download_url: string | null;
  min_version: string | null;
  version_satisfied: boolean;
}

export interface PrerequisitesCheck {
  git: PrerequisiteStatus;
  nodejs: PrerequisiteStatus;
  claude_cli: PrerequisiteStatus;
  all_installed: boolean;
}

export interface PrerequisitesState {
  hasCompletedOnboarding: boolean;
  prerequisites: PrerequisitesCheck | null;
  isChecking: boolean;
  isInstalling: boolean;
  isLoggedIn: boolean;
  isCheckingAuth: boolean;
  isLoggingIn: boolean;

  isInstallingGit: boolean;

  // Actions
  checkPrerequisites: () => Promise<void>;
  installClaudeCLI: () => Promise<void>;
  installXcodeCliTools: () => Promise<void>;
  openNodeDownload: () => Promise<void>;
  openClaudeInstallTerminal: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  openLoginTerminal: () => Promise<void>;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

// =============================================================================
// Test Modes
// =============================================================================

// VITE_TEST_MODE: shows prerequisites dialog (real checks)
// VITE_TEST_PREREQUISITES: simulates all prerequisites as missing
const SIMULATE_MISSING = import.meta.env.VITE_TEST_PREREQUISITES === 'true';

const MOCK_PREREQUISITES: PrerequisitesCheck = {
  git: { name: 'Git', installed: false, version: null, download_url: 'https://git-scm.com/downloads', min_version: null, version_satisfied: false },
  nodejs: { name: 'Node.js', installed: false, version: null, download_url: 'https://nodejs.org/en/download', min_version: '>= 18', version_satisfied: false },
  claude_cli: { name: 'Claude Code CLI', installed: false, version: null, download_url: null, min_version: null, version_satisfied: false },
  all_installed: false,
};

// =============================================================================
// Store
// =============================================================================

export const usePrerequisitesStore = create<PrerequisitesState>()(
  persist(
    (set, get) => ({
      // Initial state
      hasCompletedOnboarding: false,
      prerequisites: null,
      isChecking: false,
      isInstalling: false,
      isInstallingGit: false,
      isLoggedIn: false,
      isCheckingAuth: false,
      isLoggingIn: false,

      // Check prerequisites
      checkPrerequisites: async () => {
        set({ isChecking: true });

        // Simulate missing prerequisites for install flow testing
        if (SIMULATE_MISSING) {
          console.warn('[Prerequisites] TEST MODE: simulating all prerequisites as missing');
          set({
            prerequisites: MOCK_PREREQUISITES,
            isChecking: false,
            isLoggedIn: false,
            isLoggingIn: false,
          });
          return;
        }

        try {
          const result = await invoke<PrerequisitesCheck>('check_prerequisites');

          // Also check auth status if Claude CLI is installed
          let isLoggedIn = false;
          if (result.claude_cli.installed) {
            try {
              isLoggedIn = await invoke<boolean>('check_claude_auth_status');
            } catch {
              isLoggedIn = false;
            }
          }

          set({
            prerequisites: result,
            isChecking: false,
            isLoggedIn,
            isLoggingIn: false,
          });
        } catch (error) {
          console.error('[Prerequisites Store] Failed to check prerequisites:', error);
          set({
            isChecking: false,
            prerequisites: null,
          });
        }
      },

      // Install Claude CLI
      installClaudeCLI: async () => {
        set({ isInstalling: true });

        try {
          await invoke('install_claude_cli');

          // Re-check prerequisites after installation
          await get().checkPrerequisites();

          set({ isInstalling: false });
        } catch (error) {
          console.error('[Prerequisites Store] Failed to install Claude CLI:', error);
          set({ isInstalling: false });
          throw error;
        }
      },

      // Install Xcode CLI Tools (macOS only - triggers native dialog)
      installXcodeCliTools: async () => {
        set({ isInstallingGit: true });

        try {
          await invoke('install_xcode_cli_tools');
          // Don't re-check immediately - user needs to complete the Xcode dialog first
          set({ isInstallingGit: false });
        } catch (error) {
          console.error('[Prerequisites Store] Failed to install Xcode CLI Tools:', error);
          set({ isInstallingGit: false });
          throw error;
        }
      },

      // Open Node.js download page in browser
      openNodeDownload: async () => {
        try {
          await invoke('open_external_url', { url: 'https://nodejs.org/en/download' });
        } catch (error) {
          console.error('[Prerequisites Store] Failed to open Node.js download page:', error);
          throw error;
        }
      },

      // Open terminal with sudo npm install for Claude CLI
      openClaudeInstallTerminal: async () => {
        try {
          await invoke('open_claude_install_terminal');
        } catch (error) {
          console.error('[Prerequisites Store] Failed to open Claude install terminal:', error);
          throw error;
        }
      },

      // Check Claude auth status
      checkAuthStatus: async () => {
        set({ isCheckingAuth: true });

        try {
          const isLoggedIn = await invoke<boolean>('check_claude_auth_status');
          set({ isLoggedIn, isCheckingAuth: false });
        } catch (error) {
          console.error('[Prerequisites Store] Failed to check auth status:', error);
          set({ isLoggedIn: false, isCheckingAuth: false });
        }
      },

      // Open system terminal with claude login
      openLoginTerminal: async () => {
        set({ isLoggingIn: true });

        try {
          await invoke('open_claude_login_terminal');
          // Don't set isLoggingIn to false here - user needs to complete login in terminal
          // They will click "Re-check" after completing login
        } catch (error) {
          console.error('[Prerequisites Store] Failed to open login terminal:', error);
          set({ isLoggingIn: false });
          throw error;
        }
      },

      // Complete onboarding manually
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      // Reset onboarding (for debug/testing)
      resetOnboarding: () => set({
        hasCompletedOnboarding: false,
        prerequisites: null,
      }),
    }),
    {
      name: 'quack-prerequisites',
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        prerequisites: state.prerequisites,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

// Session-level flag: reset onboarding at startup in test mode
let testModeInitialized = false;

export const selectShouldShowPrerequisites = (state: PrerequisitesState): boolean => {
  // In test mode, reset onboarding once per session so the dialog shows
  if (import.meta.env.VITE_TEST_MODE === 'true' && !testModeInitialized) {
    testModeInitialized = true;
    usePrerequisitesStore.getState().resetOnboarding();
    return true;
  }
  return !state.hasCompletedOnboarding;
};

export const selectAllPrerequisitesInstalled = (state: PrerequisitesState): boolean => {
  return state.prerequisites?.all_installed ?? false;
};
