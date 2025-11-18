/**
 * Terminal Utility Functions
 * String manipulation and terminal output parsing utilities.
 * Extracted from App.tsx for better testability and reusability.
 */

// ============================================
// Constants
// ============================================

/**
 * Terminal color palette
 * Used for terminal tab colors and visual identification
 */
export const TERMINAL_COLORS = [
  "#f28c52",
  "#ffb26f",
  "#ffd166",
  "#f77aa6",
  "#4dd4b3",
  "#8fa6ff",
  "#f2a57b",
] as const;

/**
 * ANSI escape sequence regex patterns
 * Used to strip terminal control characters from output
 */
// eslint-disable-next-line no-control-regex
export const ANSI_REGEX = new RegExp("\\x1B\\[[0-9;?]*[ -/]*[@-~]", "g");
// eslint-disable-next-line no-control-regex
export const OSC_REGEX = new RegExp("\\x1B\\][^\\x07]*\\x07", "g");

/**
 * Shell prompt detection regex
 * Detects common shell prompts: $, #, %, >, |, ❯
 */
export const PROMPT_REGEX = /(?:[$#%>|❯])\s*$/;

// ============================================
// String Utilities
// ============================================

/**
 * Normalize a string to lowercase and trimmed
 * @param value - String to normalize
 * @returns Normalized string (trimmed, lowercase)
 *
 * @example
 * normalizeKey("  Hello World  ") // "hello world"
 */
export const normalizeKey = (value: string): string => value.trim().toLowerCase();

/**
 * Convert string to URL-safe slug
 * @param value - String to slugify
 * @returns URL-safe slug (lowercase, alphanumeric + hyphens)
 *
 * @example
 * slugify("Hello World!") // "hello-world"
 * slugify("User@123") // "user-123"
 */
export const slugify = (value: string): string =>
  normalizeKey(value).replace(/[^a-z0-9]+/g, "-");

/**
 * Strip ANSI escape sequences from text
 * Removes terminal control characters (colors, cursor movement, etc.)
 *
 * @param text - Text with ANSI sequences
 * @returns Clean text without ANSI codes
 *
 * @example
 * stripAnsi("\x1B[31mRed Text\x1B[0m") // "Red Text"
 */
export const stripAnsi = (text: string): string =>
  text.replace(OSC_REGEX, "").replace(ANSI_REGEX, "");

/**
 * Check if text chunk contains a shell prompt
 * Detects common shell prompts at the end of output
 *
 * @param text - Terminal output text (may contain ANSI codes)
 * @returns True if text ends with a shell prompt
 *
 * @example
 * chunkContainsPrompt("user@host:~$ ") // true
 * chunkContainsPrompt("some output\n") // false
 */
export const chunkContainsPrompt = (text: string): boolean => {
  const sanitized = stripAnsi(text).replace(/\r/g, "\n");
  const lines = sanitized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return false;
  }

  return PROMPT_REGEX.test(lines[lines.length - 1]);
};

// ============================================
// Debounce Utility
// ============================================

/**
 * Debounce function execution
 * Delays function execution until after wait milliseconds have elapsed
 * since the last call. Useful for auto-save, search, etc.
 *
 * @param func - Function to debounce
 * @param wait - Delay in milliseconds
 * @returns Debounced function with cancel method
 *
 * @example
 * const saveData = debounce(() => save(), 1000);
 * saveData(); // Will execute after 1s
 * saveData(); // Cancels previous, starts new 1s timer
 * saveData.cancel(); // Cancel pending execution
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };

  return debounced as T & { cancel: () => void };
}

// ============================================
// Color Utilities
// ============================================

/**
 * Get random terminal color from palette
 * @returns Hex color string from TERMINAL_COLORS
 *
 * @example
 * getRandomTerminalColor() // "#f28c52" (random from palette)
 */
export const getRandomTerminalColor = (): string => {
  return TERMINAL_COLORS[Math.floor(Math.random() * TERMINAL_COLORS.length)];
};

/**
 * Get color by index (with wrapping)
 * Useful for assigning predictable colors based on terminal index
 *
 * @param index - Index to get color for
 * @returns Hex color string from TERMINAL_COLORS
 *
 * @example
 * getTerminalColorByIndex(0) // "#f28c52" (first color)
 * getTerminalColorByIndex(7) // "#f28c52" (wraps to first)
 */
export const getTerminalColorByIndex = (index: number): string => {
  return TERMINAL_COLORS[index % TERMINAL_COLORS.length];
};
