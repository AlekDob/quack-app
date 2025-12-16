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
  const [avatarUrl, setAvatarUrl] = useState<string>(getDuckdroidUrl());

  useEffect(() => {
    const result = getAgentAvatar(agentName, avatarFilename);

    if (typeof result === 'string') {
      setAvatarUrl(result);
    } else {
      result.then(setAvatarUrl).catch(() => setAvatarUrl(getDuckdroidUrl()));
    }
  }, [agentName, avatarFilename]);

  return avatarUrl;
}
