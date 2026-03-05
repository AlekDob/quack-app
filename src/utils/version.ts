import { getVersion } from '@tauri-apps/api/app';

/**
 * Get the current app version from Tauri
 * @returns Promise<string> - Version string (e.g., "0.1.0")
 */
export async function getCurrentVersion(): Promise<string> {
  try {
    const version = await getVersion();
    return version;
  } catch (error) {
    console.error('Failed to get app version:', error);
    return '0.0.0'; // Fallback version
  }
}

/**
 * Parse a version string into components
 * Handles formats: "v0.1.0", "0.1.0", "v0.1.0.intel", "0.1.0-beta"
 * @param version - Version string to parse
 * @returns {major, minor, patch, suffix} or null if invalid
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  suffix?: string;
} | null {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/, '');

  // Match semver pattern: X.Y.Z or X.Y.Z-suffix or X.Y.Z.suffix
  const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:[.-](.+))?$/);

  if (!match) {
    console.warn(`Invalid version format: ${version}`);
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    suffix: match[4] || undefined,
  };
}

/**
 * Compare two version strings
 * @param version1 - First version to compare
 * @param version2 - Second version to compare
 * @returns -1 if version1 < version2, 0 if equal, 1 if version1 > version2, null if invalid
 */
export function compareVersions(version1: string, version2: string): number | null {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (!v1 || !v2) {
    return null; // Invalid version format
  }

  // Compare major version
  if (v1.major !== v2.major) {
    return v1.major > v2.major ? 1 : -1;
  }

  // Compare minor version
  if (v1.minor !== v2.minor) {
    return v1.minor > v2.minor ? 1 : -1;
  }

  // Compare patch version
  if (v1.patch !== v2.patch) {
    return v1.patch > v2.patch ? 1 : -1;
  }

  // Versions are equal (ignoring suffix for now)
  return 0;
}

/**
 * Check if newVersion is greater than currentVersion
 * @param currentVersion - Current version string
 * @param newVersion - New version to check
 * @returns boolean - True if newVersion is newer
 */
export function isNewerVersion(currentVersion: string, newVersion: string): boolean {
  const comparison = compareVersions(currentVersion, newVersion);
  return comparison === -1; // currentVersion < newVersion
}

/**
 * Format version string with optional 'v' prefix
 * @param version - Version string to format
 * @param withPrefix - Whether to include 'v' prefix (default: true)
 * @returns Formatted version string (e.g., "v0.1.0" or "0.1.0")
 */
export function formatVersion(version: string, withPrefix: boolean = true): string {
  // Remove existing 'v' prefix
  const cleanVersion = version.replace(/^v/, '');

  return withPrefix ? `v${cleanVersion}` : cleanVersion;
}

/**
 * Get version without suffix (e.g., "v0.1.0.intel" → "v0.1.0")
 * @param version - Version string
 * @returns Version without suffix
 */
export function getBaseVersion(version: string): string {
  const parsed = parseVersion(version);
  if (!parsed) return version;

  const hasPrefix = version.startsWith('v');
  const baseVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;

  return hasPrefix ? `v${baseVersion}` : baseVersion;
}
