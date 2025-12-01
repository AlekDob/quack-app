import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface TestModeContextValue {
  // Test mode state
  isTestMode: boolean;
  isAuthenticated: boolean;

  // Actions
  toggleAuthentication: () => void;
  simulateLogin: () => void;
  simulateLogout: () => void;
  resetTestData: () => void;
}

const TestModeContext = createContext<TestModeContextValue | null>(null);

// Check if we're in test mode from environment variable
const IS_TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';

export const TestModeProvider = ({ children }: { children: React.ReactNode }) => {
  // Load initial authentication state from localStorage (persists across reloads in test mode)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (!IS_TEST_MODE) return false;
    const stored = localStorage.getItem('test-mode-auth');
    return stored === 'true';
  });

  // Simulate login
  const simulateLogin = useCallback(() => {
    if (!IS_TEST_MODE) return;

    setIsAuthenticated(true);
    localStorage.setItem('test-mode-auth', 'true');
    toast.success('🧪 Simulated login successful! (TEST MODE)');
    console.log('🧪 TEST MODE: Simulated login');

    // Dispatch custom event to notify App.tsx
    window.dispatchEvent(new CustomEvent('test-mode-auth-changed', { detail: { authenticated: true } }));
  }, []);

  // Simulate logout
  const simulateLogout = useCallback(() => {
    if (!IS_TEST_MODE) return;

    setIsAuthenticated(false);
    localStorage.setItem('test-mode-auth', 'false');
    toast.success('🧪 Simulated logout! (TEST MODE)');
    console.log('🧪 TEST MODE: Simulated logout');

    // Dispatch custom event to notify App.tsx
    window.dispatchEvent(new CustomEvent('test-mode-auth-changed', { detail: { authenticated: false } }));
  }, []);

  // Toggle authentication state
  const toggleAuthentication = useCallback(() => {
    if (!IS_TEST_MODE) return;

    if (isAuthenticated) {
      simulateLogout();
    } else {
      simulateLogin();
    }
  }, [isAuthenticated, simulateLogin, simulateLogout]);

  // Reset all test data
  const resetTestData = useCallback(async () => {
    if (!IS_TEST_MODE) return;

    try {
      // Clear test mode localStorage
      localStorage.removeItem('test-mode-auth');

      // Reset authentication state
      setIsAuthenticated(false);

      toast.success('🧪 Test data cleared! (TEST MODE)');
      console.log('🧪 TEST MODE: Reset all test data');
    } catch (error) {
      console.error('Failed to reset test data:', error);
      toast.error('Failed to reset test data');
    }
  }, []);

  // Log test mode status on mount
  useEffect(() => {
    if (IS_TEST_MODE) {
      console.log('🧪 TEST MODE ENABLED');
      console.log(`🧪 Authentication: ${isAuthenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}`);
      console.log('🧪 Storage isolation: Active (using *-TEST.json files)');
    }
  }, [isAuthenticated]);

  const value: TestModeContextValue = {
    isTestMode: IS_TEST_MODE,
    isAuthenticated,
    toggleAuthentication,
    simulateLogin,
    simulateLogout,
    resetTestData,
  };

  return (
    <TestModeContext.Provider value={value}>
      {children}
    </TestModeContext.Provider>
  );
};

// Hook to use test mode context
export const useTestMode = () => {
  const context = useContext(TestModeContext);
  if (!context) {
    throw new Error('useTestMode must be used within TestModeProvider');
  }
  return context;
};

interface AuthDebugInfo {
  anthropicApiKey: boolean;
  claudeCodeUseBedrock: boolean;
  claudeCodeUseVertex: boolean;
  nodeVersion: string;
  platform: string;
  cliAvailable: boolean;
  cliPath: string | null;
  cliVersion: string | null;
  credentialsPath: string | null;
  credentialsExists: boolean;
  credentialsValid: boolean;
  sdkVersion: string;
  lastError: string | null;
}

// Helper hook for Claude CLI availability that respects test mode
// Returns true if EITHER CLI is available OR credentials are valid
export const useClaudeCliAvailability = () => {
  const { isTestMode, isAuthenticated } = useTestMode();
  const [claudeCliAvailable, setClaudeCliAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const checkClaudeCli = async () => {
      try {
        if (isTestMode) {
          // In test mode, use simulated authentication state
          setClaudeCliAvailable(isAuthenticated);
          console.log(`🧪 TEST MODE: Claude CLI simulated as ${isAuthenticated ? 'available' : 'unavailable'}`);
          return;
        }

        // Normal mode - check BOTH CLI and credentials
        // If either is available, consider auth as OK
        const debugInfo = await invoke<AuthDebugInfo>('get_auth_debug_info');
        const isAuthAvailable = debugInfo.cliAvailable || debugInfo.credentialsValid;
        setClaudeCliAvailable(isAuthAvailable);

        console.log(`🔐 Auth check: CLI=${debugInfo.cliAvailable}, Credentials=${debugInfo.credentialsValid}, Result=${isAuthAvailable}`);
      } catch (error) {
        console.error('Failed to check Claude CLI availability:', error);
        // Fallback to simple CLI check if debug info fails
        try {
          const available = await invoke<boolean>('check_claude_cli_available');
          setClaudeCliAvailable(available);
        } catch {
          setClaudeCliAvailable(false);
        }
      }
    };

    checkClaudeCli();
  }, [isTestMode, isAuthenticated]);

  return claudeCliAvailable;
};
