/**
 * Platform detection utilities
 */

// Cache the platform detection result
let cachedPlatform: 'macos' | 'windows' | 'linux' | null = null;

/**
 * Detects the current operating system
 * Uses navigator.userAgent as primary detection method
 */
export function getPlatform(): 'macos' | 'windows' | 'linux' {
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
export function isWindows(): boolean {
  return getPlatform() === 'windows';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
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
