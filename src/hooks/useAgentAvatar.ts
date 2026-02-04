/**
 * React Hook for Agent Avatars
 *
 * Handles async avatar loading for both default and custom avatars.
 * Includes global caching to prevent repeated loads on first app startup.
 */

import { useState, useEffect } from 'react';
import { getAgentAvatar, getDuckdroidUrl } from '../utils/agentAvatars';

// Global avatar cache - persists across component mounts
// Key: avatarFilename (or 'default' for no avatar)
// Value: resolved URL string
const avatarCache = new Map<string, string>();

// Track pending loads to avoid duplicate requests
const pendingLoads = new Map<string, Promise<string>>();

/**
 * Get cached avatar URL or load it
 * @param avatarFilename - Avatar filename (or undefined for default)
 * @returns Promise resolving to avatar URL
 */
async function getCachedAvatar(avatarFilename: string | undefined): Promise<string> {
  const cacheKey = avatarFilename || 'default';

  // Return cached URL if available
  if (avatarCache.has(cacheKey)) {
    return avatarCache.get(cacheKey)!;
  }

  // If already loading, return the pending promise
  if (pendingLoads.has(cacheKey)) {
    return pendingLoads.get(cacheKey)!;
  }

  // Start loading
  const loadPromise = (async () => {
    try {
      const result = getAgentAvatar('', avatarFilename);
      const url = typeof result === 'string' ? result : await result;
      avatarCache.set(cacheKey, url);
      return url;
    } catch {
      const fallback = getDuckdroidUrl();
      avatarCache.set(cacheKey, fallback);
      return fallback;
    } finally {
      pendingLoads.delete(cacheKey);
    }
  })();

  pendingLoads.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Hook to load agent avatar asynchronously with caching
 * @param agentName - The agent name (unused, kept for API compatibility)
 * @param avatarFilename - Optional avatar filename (default or custom UUID)
 * @returns Avatar URL (cached after first load)
 */
export function useAgentAvatar(_agentName: string, avatarFilename?: string): string {
  const cacheKey = avatarFilename || 'default';

  // Initialize with cached value if available, otherwise use default
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return avatarCache.get(cacheKey) || getDuckdroidUrl();
  });

  useEffect(() => {
    let isMounted = true;

    // If already cached, use it immediately
    if (avatarCache.has(cacheKey)) {
      setAvatarUrl(avatarCache.get(cacheKey)!);
      return;
    }

    // Load and cache
    getCachedAvatar(avatarFilename).then(url => {
      if (isMounted) {
        setAvatarUrl(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [cacheKey, avatarFilename]);

  return avatarUrl;
}

/**
 * Preload avatars for a list of avatar filenames
 * Call this early in app startup to warm the cache
 * @param avatarFilenames - Array of avatar filenames to preload
 */
export async function preloadAvatars(avatarFilenames: (string | undefined)[]): Promise<void> {
  const uniqueFilenames = [...new Set(avatarFilenames)];
  await Promise.all(uniqueFilenames.map(getCachedAvatar));
}

/**
 * Clear avatar cache (useful for testing or when avatars change)
 */
export function clearAvatarCache(): void {
  avatarCache.clear();
}
