/**
 * React Hook for Agent Info (Avatar + Color)
 *
 * Fetches agent metadata including avatar and color for droid widgets.
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getDuckdroidUrl } from '../utils/agentAvatars';

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

    // Check cache first
    const cacheKey = `${agentId}-${workingDir || 'default'}`;
    const cached = agentCache.get(cacheKey);
    if (cached) {
      setInfo({
        avatarUrl: cached.avatar ? `/avatars/${cached.avatar}` : getDuckdroidUrl(),
        color: cached.color || DEFAULT_COLOR,
        description: cached.description || '',
        model: cached.model || 'opus',
      });
      return;
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

        if (agent) {
          // Cache the result
          agentCache.set(cacheKey, agent);

          setInfo({
            avatarUrl: agent.avatar ? `/avatars/${agent.avatar}` : getDuckdroidUrl(),
            color: agent.color || DEFAULT_COLOR,
            description: agent.description || '',
            model: agent.model || 'opus',
          });
        }
      } catch (error) {
        console.warn('[useAgentInfo] Failed to fetch agent info:', error);
        // Keep default values
      }
    };

    fetchAgentInfo();
  }, [agentId, workingDir]);

  return info;
}

/**
 * Clear the agent info cache
 */
export function clearAgentInfoCache(): void {
  agentCache.clear();
}
