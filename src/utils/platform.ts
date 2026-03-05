/**
 * Platform detection utilities
 */

// Cache the platform detection result
let cachedPlatform: 'macos' | 'windows' | 'linux' | null = null;

/**
 * Detects the current operating system
 * Uses navigator.userAgent as primary detection method
 */
function getPlatform(): 'macos' | 'windows' | 'linux' {
  if (cachedPlatform) {
    return cachedPlatform;
  }

  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('win')) {
    cachedPlatform = 'windows';
  } else if (userAgent.includes('mac')) {
    cachedPlatform = 'macos';
  } else {
    cachedPlatform = 'linux';
  }

  return cachedPlatform;
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return getPlatform() === 'macos';
}

/**
 * Check if running on Windows
 */
function isWindows(): boolean {
  return getPlatform() === 'windows';
}

/**
 * Check if running on Linux
 */
function isLinux(): boolean {
  return getPlatform() === 'linux';
}

/**
 * Get the file manager name for the current platform
 */
export function getFileManagerName(): string {
  const platform = getPlatform();
  switch (platform) {
    case 'macos':
      return 'Finder';
    case 'windows':
      return 'Explorer';
    case 'linux':
      return 'Files';
    default:
      return 'File Manager';
  }
}

/**
 * Clean a file path by removing Windows UNC prefix (\\?\)
 * This prefix is used internally by Windows for long paths but is not user-friendly
 */
export function cleanPath(path: string): string {
  return path.replace(/^\\\\\?\\/, '');
}

/**
 * Normalize path separators for the current platform.
 * On Windows, converts forward slashes to backslashes.
 */
export function normalizePath(path: string): string {
  if (isWindows()) {
    return path.replace(/\//g, '\\');
  }
  return path;
}

/**
 * Get the modifier key symbol for the current platform
 * @returns '⌘' for macOS, 'Ctrl' for Windows/Linux
 */
function getModifierKey(): string {
  return isMacOS() ? '⌘' : 'Ctrl';
}

/**
 * Convert a keyboard shortcut to the current platform format
 * Replaces ⌘ with Ctrl on Windows/Linux
 *
 * @param shortcut - The shortcut string (e.g., "⌘K", "⌘T")
 * @returns Platform-specific shortcut (e.g., "Ctrl+K" on Windows)
 *
 * @example
 * formatShortcut("⌘K") // Returns "⌘K" on Mac, "Ctrl+K" on Windows
 * formatShortcut("⌘T") // Returns "⌘T" on Mac, "Ctrl+T" on Windows
 */
export function formatShortcut(shortcut: string): string {
  if (isMacOS()) {
    return shortcut;
  }

  // Replace ⌘ with Ctrl+ for Windows/Linux
  return shortcut.replace(/⌘/g, 'Ctrl+');
}
