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

  // Actions
  checkPrerequisites: () => Promise<void>;
  installClaudeCLI: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  openLoginTerminal: () => Promise<void>;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

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
      isLoggedIn: false,
      isCheckingAuth: false,
      isLoggingIn: false,

      // Check prerequisites
      checkPrerequisites: async () => {
        set({ isChecking: true });

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
            // Never auto-complete: always show the screen so the user can review and click Continue
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

export const selectShouldShowPrerequisites = (state: PrerequisitesState): boolean => {
  return !state.hasCompletedOnboarding;
};

export const selectAllPrerequisitesInstalled = (state: PrerequisitesState): boolean => {
  return state.prerequisites?.all_installed ?? false;
};
