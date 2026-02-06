import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TeamConfig, TeammateStatus } from '../types';

interface TeammateState {
  agentName: string;
  status: TeammateStatus;
  sessionId?: string;
}

interface TeamStore {
  // State
  activeTeam: TeamConfig | null;
  teammateStatus: Map<string, TeammateState>;
  loading: boolean;

  // Actions
  loadActiveTeam: (projectPath: string) => Promise<void>;
  createTeam: (
    projectPath: string,
    teamName: string,
    leadAgentId: string,
    memberAgentIds: string[],
    taskDescription?: string,
  ) => Promise<TeamConfig>;
  disbandTeam: (projectPath: string, teamId: string) => Promise<void>;
  updateTeammateStatus: (agentName: string, status: TeammateStatus, sessionId?: string) => void;
  clearTeam: () => void;
}

export const useTeamStore = create<TeamStore>()((set) => ({
  activeTeam: null,
  teammateStatus: new Map(),
  loading: false,

  loadActiveTeam: async (projectPath: string) => {
    set({ loading: true });
    try {
      const team = await invoke<TeamConfig | null>('get_active_team', { projectPath });
      set({ activeTeam: team });
    } catch (err) {
      console.error('Failed to load active team:', err);
    } finally {
      set({ loading: false });
    }
  },

  createTeam: async (projectPath, teamName, leadAgentId, memberAgentIds, taskDescription) => {
    const team = await invoke<TeamConfig>('create_team', {
      projectPath,
      teamName,
      leadAgentId,
      memberAgentIds,
      taskDescription,
    });
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
