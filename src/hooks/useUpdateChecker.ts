import { useState, useEffect, useCallback } from 'react';
import { getCurrentVersion, isNewerVersion, getBaseVersion } from '../utils/version';
import { fetchLatestRelease, canCheckForUpdates, type GitHubRelease } from '../services/githubReleases';

/**
 * Hook for checking app updates from GitHub releases
 * Automatically checks on mount and provides manual check function
 */
export function useUpdateChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestRelease, setLatestRelease] = useState<GitHubRelease | null>(null);
  const [currentVersion, setCurrentVersion] = useState('0.0.0');
  const [error, setError] = useState<string | null>(null);

  /**
   * Check for updates from GitHub
   * @param force - Force check even if rate limit hasn't passed
   */
  const checkForUpdates = useCallback(async (force: boolean = false) => {
    // Check rate limiting (unless forced)
    if (!force && !canCheckForUpdates()) {
      console.log('⏰ Skipping update check - rate limit not expired');
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      // Get current app version
      const current = await getCurrentVersion();
      setCurrentVersion(current);

      console.log(`📱 Current version: ${current}`);

      // Fetch latest release from GitHub
      const latest = await fetchLatestRelease(force);

      if (!latest) {
        setError('Failed to fetch latest release');
        setUpdateAvailable(false);
        setLatestRelease(null);
        return;
      }

      setLatestRelease(latest);

      // Extract version from tag_name (handle "v0.1.0" or "v0.1.0.intel" formats)
      const latestVersion = getBaseVersion(latest.tag_name);

      console.log(`🆕 Latest version: ${latestVersion}`);

      // Compare versions
      const hasUpdate = isNewerVersion(current, latestVersion);
      setUpdateAvailable(hasUpdate);

      if (hasUpdate) {
        console.log(`✨ Update available: ${current} → ${latestVersion}`);
      } else {
        console.log('✅ App is up to date');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Error checking for updates:', errorMessage);
      setError(errorMessage);
      setUpdateAvailable(false);
      setLatestRelease(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Automatically check on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    isChecking,
    updateAvailable,
    latestRelease,
    currentVersion,
    error,
    checkForUpdates, // Exposed for manual checks
  };
}
