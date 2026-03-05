/**
 * Test Mode Storage Utilities
 *
 * Provides utilities to isolate storage in test mode without modifying
 * existing code heavily. All storage operations use *-TEST.json files
 * when VITE_TEST_MODE is enabled.
 */

// Check if we're in test mode from environment variable
const IS_TEST_MODE = import.meta.env.VITE_TEST_MODE === 'true';

/**
 * Transform a storage filename to its test mode equivalent
 *
 * @example
 * getTestModeStoreName('quack-terminals.json')
 * // Returns: 'quack-terminals-TEST.json' in test mode
 * // Returns: 'quack-terminals.json' in normal mode
 */
export const getTestModeStoreName = (baseName: string): string => {
  if (!IS_TEST_MODE) {
    return baseName;
  }

  // Handle different file extensions
  if (baseName.endsWith('.json')) {
    return baseName.replace('.json', '-TEST.json');
  }

  // Fallback: just append -TEST
  return `${baseName}-TEST`;
};

/**
 * Check if currently running in test mode
 */
const isTestMode = (): boolean => {
  return IS_TEST_MODE;
};

/**
 * Get all test mode storage file patterns
 * Useful for cleanup operations
 */
const getTestModeStoragePatterns = (): string[] => {
  return [
    'quack-terminals-TEST.json',
    'quack-agent-chats-TEST.json',
    'quack-chats-TEST.json',
    'quack-commands-TEST.json',
  ];
};

/**
 * Log storage operation in test mode
 */
const logTestModeStorage = (operation: string, storeName: string): void => {
  if (IS_TEST_MODE) {
    console.log(`🧪 TEST MODE Storage: ${operation} - ${storeName}`);
  }
};
