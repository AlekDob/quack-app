import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { TerminalInfo, NativeTerminal, ProjectTerminal } from '../types';

// Manual project info for Terminal Window
export interface ManualProject {
  path: string;
  name: string;
}

interface TerminalState {
  // State
  terminals: TerminalInfo[];
  activeId: string | null;
  nativeTerminals: NativeTerminal[];
  projectTerminals: ProjectTerminal[];
  activeProjectTerminalId: string | null; // Active terminal in TerminalWindow
  manualProjects: ManualProject[]; // Manually added projects in Terminal Window

  // Actions
  setTerminals: (terminals: TerminalInfo[]) => void;
  addTerminal: (terminal: TerminalInfo) => void;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => void;
  setActiveId: (id: string | null) => void;

  // Native terminal actions
  setNativeTerminals: (terminals: NativeTerminal[]) => void;
  addNativeTerminal: (terminal: NativeTerminal) => void;
  removeNativeTerminal: (id: string) => void;
  updateNativeTerminal: (id: string, updates: Partial<NativeTerminal>) => void;

  // Project terminal actions (NEW - replaces agentTerminals)
  setProjectTerminals: (terminals: ProjectTerminal[]) => void;
  addProjectTerminal: (terminal: ProjectTerminal) => void;
  removeProjectTerminal: (id: string) => void;
  updateProjectTerminal: (id: string, updates: Partial<ProjectTerminal>) => void;
  setActiveProjectTerminalId: (id: string | null) => void;

  // Manual projects actions
  addManualProject: (project: ManualProject) => void;
  removeManualProject: (path: string) => void;
  setManualProjects: (projects: ManualProject[]) => void;

  // Selectors (derived state)
  getTerminalById: (id: string) => TerminalInfo | undefined;
  getActiveTerminal: () => TerminalInfo | null;
  getNativeTerminalById: (id: string) => NativeTerminal | undefined;
  getProjectTerminalById: (id: string) => ProjectTerminal | undefined;
  getActiveProjectTerminal: () => ProjectTerminal | null;
  getProjectTerminalsByPath: (projectPath: string) => ProjectTerminal[];
}

export const useTerminalStore = create<TerminalState>()(
  devtools(
    persist(
      (set, get) => ({
        terminals: [],
        activeId: null,
        nativeTerminals: [],
        projectTerminals: [],
        activeProjectTerminalId: null,
        manualProjects: [],

        setTerminals: (terminals) => set({ terminals }),

        addTerminal: (terminal) => set((state) => ({
          terminals: [...state.terminals, terminal],
        })),

        removeTerminal: (id) => set((state) => ({
          terminals: state.terminals.filter((t) => t.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        })),

        updateTerminal: (id, updates) => set((state) => ({
          terminals: state.terminals.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

        setActiveId: (id) => set({ activeId: id }),

        // Native terminal actions
        setNativeTerminals: (terminals) => set({ nativeTerminals: terminals }),

        addNativeTerminal: (terminal) => set((state) => ({
          nativeTerminals: [...state.nativeTerminals, terminal],
        })),

        removeNativeTerminal: (id) => set((state) => ({
          nativeTerminals: state.nativeTerminals.filter((t) => t.id !== id),
        })),

        updateNativeTerminal: (id, updates) => set((state) => ({
          nativeTerminals: state.nativeTerminals.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

        // Project terminal actions (NEW - replaces agentTerminals)
        setProjectTerminals: (terminals) => set({ projectTerminals: terminals }),

        addProjectTerminal: (terminal) => set((state) => ({
          projectTerminals: [...state.projectTerminals, terminal],
        })),

        removeProjectTerminal: (id) => set((state) => ({
          projectTerminals: state.projectTerminals.filter((t) => t.id !== id),
          activeProjectTerminalId: state.activeProjectTerminalId === id ? null : state.activeProjectTerminalId,
        })),

        updateProjectTerminal: (id, updates) => set((state) => ({
          projectTerminals: state.projectTerminals.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

        setActiveProjectTerminalId: (id) => set({ activeProjectTerminalId: id }),

        // Manual projects actions
        addManualProject: (project) => set((state) => {
          // Don't add duplicates
          if (state.manualProjects.some(p => p.path === project.path)) {
            return state;
          }
          return { manualProjects: [...state.manualProjects, project] };
        }),

        removeManualProject: (path) => set((state) => ({
          manualProjects: state.manualProjects.filter(p => p.path !== path),
        })),

        setManualProjects: (projects) => set({ manualProjects: projects }),

        // Selectors
        getTerminalById: (id) => {
          const state = get();
          return state.terminals.find((t) => t.id === id);
        },

        getActiveTerminal: () => {
          const state = get();
          return state.terminals.find((t) => t.id === state.activeId) ?? null;
        },

        getNativeTerminalById: (id) => {
          const state = get();
          return state.nativeTerminals.find((t) => t.id === id);
        },

        getProjectTerminalById: (id) => {
          const state = get();
          return state.projectTerminals.find((t) => t.id === id);
        },

        getActiveProjectTerminal: () => {
          const state = get();
          return state.projectTerminals.find((t) => t.id === state.activeProjectTerminalId) ?? null;
        },

        getProjectTerminalsByPath: (projectPath) => {
          const state = get();
          return state.projectTerminals.filter((t) => t.projectPath === projectPath);
        },
      }),
      {
        name: 'terminal-storage',
        partialize: (state) => ({
          // Persist only non-runtime data
          terminals: state.terminals.map(t => ({
            id: t.id,
            label: t.label,
            cwd: t.cwd,
            color: t.color,
          })),
          projectTerminals: state.projectTerminals.map(t => ({
            id: t.id,
            name: t.name,
            projectPath: t.projectPath,
            cwd: t.cwd,
            color: t.color,
            createdAt: t.createdAt,
          })),
          // Persist manual projects
          manualProjects: state.manualProjects,
        }),
      }
    )
  )
);