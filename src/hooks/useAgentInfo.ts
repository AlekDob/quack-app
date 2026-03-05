/**
 * React Hook for Agent Info (Avatar + Color)
 *
 * Fetches agent metadata including avatar and color for droid widgets.
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getDuckdroidUrl, getAgentAvatar } from '../utils/agentAvatars';

interface AgentInfo {
  name: string;
  description: string;
  model: string;
  color: string;
  file_path: string;
  scope: string;
  working_on?: string;
  avatar?: string;
}

interface AgentInfoResult {
  avatarUrl: string;
  color: string;
  description: string;
  model: string;
}

const DEFAULT_COLOR = '#8b5cf6'; // Purple default for droids

// Cache for agent info to avoid repeated API calls
const agentCache = new Map<string, AgentInfo>();

/**
 * Resolve avatar URL from an avatar filename (handles sync and async custom avatars)
 */
async function resolveAvatarUrl(avatar: string | undefined): Promise<string> {
  if (!avatar) return getDuckdroidUrl();
  const result = getAgentAvatar('', avatar);
  return result instanceof Promise ? result : result;
}

/**
 * Hook to load agent info (avatar + color) asynchronously
 * @param agentId - The agent ID/name (e.g., "strategic-project-advisor")
 * @param workingDir - Optional working directory for project agents
 * @returns Object with avatarUrl, color, description, model
 */
export function useAgentInfo(agentId: string, workingDir?: string): AgentInfoResult {
  const [info, setInfo] = useState<AgentInfoResult>({
    avatarUrl: getDuckdroidUrl(),
    color: DEFAULT_COLOR,
    description: '',
    model: 'sonnet',
  });

  useEffect(() => {
    if (!agentId) return;
    let isMounted = true;

    // Check cache first
    const cacheKey = `${agentId}-${workingDir || 'default'}`;
    const cached = agentCache.get(cacheKey);
    if (cached) {
      resolveAvatarUrl(cached.avatar).then(avatarUrl => {
        if (isMounted) {
          setInfo({
            avatarUrl,
            color: cached.color || DEFAULT_COLOR,
            description: cached.description || '',
            model: cached.model || 'opus',
          });
        }
      });
      return () => { isMounted = false; };
    }

    // Fetch agents list and find matching agent
    const fetchAgentInfo = async () => {
      try {
        const agents = await invoke<AgentInfo[]>('list_agents', {
          workingDir: workingDir || null,
        });

        // Find agent by ID (case-insensitive, supports kebab-case)
        const normalizedId = agentId.toLowerCase().replace(/[_\s]/g, '-');
        const agent = agents.find(a => {
          const normalizedName = a.name.toLowerCase().replace(/[_\s]/g, '-');
          return normalizedName === normalizedId || a.name.toLowerCase() === agentId.toLowerCase();
        });

        if (agent && isMounted) {
          // Cache the result
          agentCache.set(cacheKey, agent);

          const avatarUrl = await resolveAvatarUrl(agent.avatar);
          if (isMounted) {
            setInfo({
              avatarUrl,
              color: agent.color || DEFAULT_COLOR,
              description: agent.description || '',
              model: agent.model || 'opus',
            });
          }
        }
      } catch (error) {
        console.warn('[useAgentInfo] Failed to fetch agent info:', error);
        // Keep default values
      }
    };

    fetchAgentInfo();
    return () => { isMounted = false; };
  }, [agentId, workingDir]);

  return info;
}

/**
 * Clear the agent info cache
 */
export function clearAgentInfoCache(): void {
  agentCache.clear();
}
