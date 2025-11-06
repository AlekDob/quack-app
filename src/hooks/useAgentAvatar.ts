/**
 * React Hook for Agent Avatars
 *
 * Handles async avatar loading for both default and custom avatars.
 */

import { useState, useEffect } from 'react';
import { getAgentAvatar } from '../utils/agentAvatars';

/**
 * Hook to load agent avatar asynchronously
 * @param agentName - The agent name
 * @param avatarFilename - Optional avatar filename (default or custom UUID)
 * @returns Avatar URL (or empty string while loading)
 */
export function useAgentAvatar(agentName: string, avatarFilename?: string): string {
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  useEffect(() => {
    const result = getAgentAvatar(agentName, avatarFilename);

    // Handle both sync (string) and async (Promise) returns
    if (typeof result === 'string') {
      setAvatarUrl(result);
    } else {
      result.then(setAvatarUrl).catch(err => {
        console.error('Failed to load avatar:', err);
        // Fallback to duckdroid on error
        setAvatarUrl('/duckdroid.png');
      });
    }
  }, [agentName, avatarFilename]);

  return avatarUrl;
}
