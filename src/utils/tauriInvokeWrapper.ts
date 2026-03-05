/**
 * Tauri Invoke Wrapper for Test Mode
 *
 * Intercepts Tauri invoke calls and provides test mode overrides
 * without modifying existing code.
 *
 * Usage: Import this file early in your app (e.g., in main.tsx)
 * to activate test mode interception.
 */

import { invoke as originalInvoke } from '@tauri-apps/api/core';

const IS_TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';

/**
 * Get test mode authentication state from localStorage
 */
const getTestModeAuthState = (): boolean => {
  if (!IS_TEST_MODE) return false;
  const stored = localStorage.getItem('test-mode-auth');
  return stored === 'true';
};

/**
 * Wrapped invoke that intercepts commands in test mode
 */
const invoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  // In test mode, intercept specific commands
  if (IS_TEST_MODE) {
    // Intercept Claude CLI availability check
    if (command === 'check_claude_cli_available') {
      const isAuthenticated = getTestModeAuthState();
      console.log(`🧪 TEST MODE: Intercepted check_claude_cli_available -> ${isAuthenticated}`);
      return isAuthenticated as T;
    }

    // Intercept other Claude-related commands if needed
    if (command === 'get_claude_cli_credentials') {
      const isAuthenticated = getTestModeAuthState();
      if (!isAuthenticated) {
        console.log(`🧪 TEST MODE: Intercepted get_claude_cli_credentials -> null`);
        return null as T;
      }
      // Return mock credentials if authenticated
      console.log(`🧪 TEST MODE: Intercepted get_claude_cli_credentials -> mock credentials`);
      return {
        auth_type: 'oauth',
        access_token: 'test-token-' + Date.now(),
        expires_at: Date.now() + 3600000, // 1 hour from now
      } as T;
    }
  }

  // For all other commands or in normal mode, use original invoke
  return originalInvoke<T>(command, args);
};

/**
 * Initialize test mode interception
 * Call this in your app's entry point (main.tsx)
 */
export const initTestModeInterception = () => {
  if (IS_TEST_MODE) {
    console.log('🧪 TEST MODE: Tauri invoke interception enabled');
    console.log('🧪 TEST MODE: Commands like check_claude_cli_available will be intercepted');

    // Override the global invoke if needed
    // This allows existing code to work without changes
    (window as any).__TAURI_INVOKE__ = invoke;
  }
};
