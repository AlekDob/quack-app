/**
 * Group Store
 *
 * Zustand store for managing project groups.
 * Groups allow cross-project awareness by linking related projects
 * with a shared CLAUDE.md that references each project's context.
 *
 * @module groupStore
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ProjectGroup, ProjectGroupMember } from '../types';

interface GroupStore {
  // State
  groups: ProjectGroup[];
  loading: boolean;

  // Actions
  loadGroups: () => Promise<void>;
  createGroup: (
    name: string,
    projects: ProjectGroupMember[],
    color?: string,
    notes?: string,
  ) => Promise<ProjectGroup>;
  updateGroup: (
    groupId: string,
    updates: {
      name?: string;
      projects?: ProjectGroupMember[];
      color?: string;
      notes?: string;
    },
  ) => Promise<ProjectGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
  getGroupForProject: (projectPath: string) => Promise<ProjectGroup | null>;

  // Selectors
  getGroupById: (groupId: string) => ProjectGroup | undefined;
}

export const useGroupStore = create<GroupStore>()((set, get) => ({
  groups: [],
  loading: false,

  loadGroups: async () => {
    set({ loading: true });
    try {
      const groups = await invoke<ProjectGroup[]>('list_groups');
      set({ groups, loading: false });

      // Sync group contexts into each project's CLAUDE.md
      if (groups.length > 0) {
        invoke<number>('sync_group_contexts')
          .then((count) => console.log(`[groupStore] Synced group contexts for ${count} projects`))
          .catch((err) => console.warn('[groupStore] Failed to sync group contexts:', err));
      }
    } catch (error) {
      console.error('[groupStore] Failed to load groups:', error);
      set({ loading: false });
    }
  },

  createGroup: async (name, projects, color, notes) => {
    const group = await invoke<ProjectGroup>('create_group', {
      name,
      projects,
      color: color ?? null,
      notes: notes ?? null,
    });

    set((state) => ({ groups: [group, ...state.groups] }));
    console.log('[groupStore] Created group:', group.id, group.name);
    return group;
  },

  updateGroup: async (groupId, updates) => {
    const group = await invoke<ProjectGroup>('update_group', {
      groupId,
      name: updates.name ?? null,
      projects: updates.projects ?? null,
      color: updates.color ?? null,
      notes: updates.notes ?? null,
    });

    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? group : g)),
    }));
    console.log('[groupStore] Updated group:', groupId);
    return group;
  },

  deleteGroup: async (groupId) => {
    await invoke('delete_group', { groupId });

    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
    }));
    console.log('[groupStore] Deleted group:', groupId);
  },

  getGroupForProject: async (projectPath) => {
    try {
      const group = await invoke<ProjectGroup | null>('get_group_for_project', {
        projectPath,
      });
      return group;
    } catch {
      return null;
    }
  },

  getGroupById: (groupId) => {
    return get().groups.find((g) => g.id === groupId);
  },
}));
