/**
 * React Hook for Agent Avatars
 *
 * Handles async avatar loading for both default and custom avatars.
 */

import { useState, useEffect } from 'react';
import { getAgentAvatar, getDuckdroidUrl } from '../utils/agentAvatars';

/**
 * Hook to load agent avatar asynchronously
 * @param agentName - The agent name
 * @param avatarFilename - Optional avatar filename (default or custom UUID)
 * @returns Avatar URL (or empty string while loading)
 */
export function useAgentAvatar(agentName: string, avatarFilename?: string): string {
  // Initialize with duckdroid URL instead of empty string to avoid flash of broken image
  const [avatarUrl, setAvatarUrl] = useState<string>(getDuckdroidUrl());

  useEffect(() => {
    console.log('[useAgentAvatar] Effect running:', { agentName, avatarFilename });
    const result = getAgentAvatar(agentName, avatarFilename);

    // Handle both sync (string) and async (Promise) returns
    if (typeof result === 'string') {
      console.log('[useAgentAvatar] Sync result:', result);
      setAvatarUrl(result);
    } else {
      console.log('[useAgentAvatar] Async result (Promise)');
      result.then((url) => {
        console.log('[useAgentAvatar] Promise resolved:', url);
        setAvatarUrl(url);
      }).catch(err => {
        console.error('[useAgentAvatar] Promise failed:', err);
        // Fallback to droid on error - use getDuckdroidUrl for proper Tauri path
        setAvatarUrl(getDuckdroidUrl());
      });
    }
  }, [agentName, avatarFilename]);

  return avatarUrl;
}
