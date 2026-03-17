import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TeamConfig, TeammateStatus } from '../types';

interface TeammateState {
  agentName: string;
  status: TeammateStatus;
  sessionId?: string;
}

interface RemoteTeam {
  name: string;
  leadAgentId: string;
  status: string;
  members: Array<{
    agentId: string;
    agentName: string;
    role?: string;
    task: string;
    sessionId?: string;
    status: string;
  }>;
}

interface TeamStore {
  // State
  activeTeam: TeamConfig | null;
  remoteTeam: RemoteTeam | null;
  teammateStatus: Map<string, TeammateState>;
  loading: boolean;

  // Actions
  loadActiveTeam: (projectPath: string, agentAvatars?: Map<string, { avatar?: string; color?: string }>) => Promise<void>;
  createTeam: (
    projectPath: string,
    teamName: string,
    leadAgentId: string,
    memberAgentIds: string[],
    taskDescription?: string,
    agentAvatars?: Map<string, { avatar?: string; color?: string }>,
  ) => Promise<TeamConfig>;
  disbandTeam: (projectPath: string, teamId: string) => Promise<void>;
  updateTeammateStatus: (agentName: string, status: TeammateStatus, sessionId?: string) => void;
  clearTeam: () => void;
}

export const useTeamStore = create<TeamStore>()((set) => ({
  activeTeam: null,
  remoteTeam: null,
  teammateStatus: new Map(),
  loading: false,

  loadActiveTeam: async (projectPath: string, agentAvatars?: Map<string, { avatar?: string; color?: string }>) => {
    set({ loading: true });
    try {
      const team = await invoke<TeamConfig | null>('get_active_team', { projectPath });
      if (team && agentAvatars) {
        for (const member of team.members) {
          const data = agentAvatars.get(member.agentId);
          if (data) {
            member.avatar = data.avatar;
            member.color = data.color;
          }
        }
      }
      set({ activeTeam: team });
    } catch (err) {
      console.error('Failed to load active team:', err);
    } finally {
      set({ loading: false });
    }
  },

  createTeam: async (projectPath, teamName, leadAgentId, memberAgentIds, taskDescription, agentAvatars) => {
    const team = await invoke<TeamConfig>('create_team', {
      projectPath,
      teamName,
      leadAgentId,
      memberAgentIds,
      taskDescription,
    });
    // Enrich members with avatar/color from frontend agent data
    if (agentAvatars) {
      for (const member of team.members) {
        const data = agentAvatars.get(member.agentId);
        if (data) {
          member.avatar = data.avatar;
          member.color = data.color;
        }
      }
    }
    set({ activeTeam: team });
    return team;
  },

  disbandTeam: async (projectPath, teamId) => {
    await invoke('disband_team', { projectPath, teamId });
    set({ activeTeam: null, teammateStatus: new Map() });
  },

  updateTeammateStatus: (agentName, status, sessionId) => {
    set((state) => {
      const updated = new Map(state.teammateStatus);
      updated.set(agentName, { agentName, status, sessionId });
      return { teammateStatus: updated };
    });
  },

  clearTeam: () => {
    set({ activeTeam: null, teammateStatus: new Map() });
  },
}));
