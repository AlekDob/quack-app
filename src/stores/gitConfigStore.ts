import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// Types
// =============================================================================

export interface GitUserConfig {
  name: string | null;
  email: string | null;
}

export interface GitConfigState {
  hasCompletedOnboarding: boolean;
  userConfig: GitUserConfig | null;
  isChecking: boolean;
  manuallyReset: boolean; // Flag to prevent auto-complete after manual reset

  // Actions
  checkGitConfig: () => Promise<void>;
  setGitConfig: (name: string, email: string) => Promise<void>;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

// =============================================================================
// Store
// =============================================================================

export const useGitConfigStore = create<GitConfigState>()(
  persist(
    (set) => ({
      // Initial state
      hasCompletedOnboarding: false,
      userConfig: null,
      isChecking: false,
      manuallyReset: false,

      // Check Git config
      checkGitConfig: async () => {
        const state = useGitConfigStore.getState();
        set({ isChecking: true });

        try {
          const config = await invoke<GitUserConfig>('git_get_user_config');

          // Only auto-complete if NOT manually reset
          const shouldAutoComplete = !state.manuallyReset && !!(config.name && config.email);

          set({
            userConfig: config,
            isChecking: false,
            hasCompletedOnboarding: shouldAutoComplete,
          });
        } catch (error) {
          console.error('[Git Config Store] Failed to check git config:', error);
          set({
            isChecking: false,
            userConfig: { name: null, email: null },
          });
        }
      },

      // Set Git config
      setGitConfig: async (name: string, email: string) => {
        try {
          await invoke('git_set_user_config', { name, email });

          set({
            userConfig: { name, email },
            hasCompletedOnboarding: true,
            manuallyReset: false, // Clear reset flag after successful config
          });
        } catch (error) {
          console.error('[Git Config Store] Failed to set git config:', error);
          throw error;
        }
      },

      // Complete onboarding manually
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      // Reset onboarding (for debug/testing)
      resetOnboarding: () => set({
        hasCompletedOnboarding: false,
        userConfig: null,
        manuallyReset: true, // Set flag to prevent auto-complete
      }),
    }),
    {
      name: 'quack-git-config',
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        userConfig: state.userConfig,
        manuallyReset: state.manuallyReset,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectShouldShowGitOnboarding = (state: GitConfigState): boolean => {
  return !state.hasCompletedOnboarding;
};

export const selectIsGitConfigured = (state: GitConfigState): boolean => {
  return !!(state.userConfig?.name && state.userConfig?.email);
};
