import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { TerminalInfo, NativeTerminal, AgentTerminal } from '../types';

interface TerminalState {
  // State
  terminals: TerminalInfo[];
  activeId: string | null;
  nativeTerminals: NativeTerminal[];
  agentTerminals: AgentTerminal[];

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

  // Agent terminal actions
  setAgentTerminals: (terminals: AgentTerminal[]) => void;
  addAgentTerminal: (terminal: AgentTerminal) => void;
  removeAgentTerminal: (id: string) => void;
  updateAgentTerminal: (id: string, updates: Partial<AgentTerminal>) => void;

  // Selectors (derived state)
  getTerminalById: (id: string) => TerminalInfo | undefined;
  getActiveTerminal: () => TerminalInfo | null;
  getNativeTerminalById: (id: string) => NativeTerminal | undefined;
  getAgentTerminalById: (id: string) => AgentTerminal | undefined;
}

export const useTerminalStore = create<TerminalState>()(
  devtools(
    persist(
      (set, get) => ({
        terminals: [],
        activeId: null,
        nativeTerminals: [],
        agentTerminals: [],

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

        // Agent terminal actions
        setAgentTerminals: (terminals) => set({ agentTerminals: terminals }),

        addAgentTerminal: (terminal) => set((state) => ({
          agentTerminals: [...state.agentTerminals, terminal],
        })),

        removeAgentTerminal: (id) => set((state) => ({
          agentTerminals: state.agentTerminals.filter((t) => t.id !== id),
        })),

        updateAgentTerminal: (id, updates) => set((state) => ({
          agentTerminals: state.agentTerminals.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

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

        getAgentTerminalById: (id) => {
          const state = get();
          return state.agentTerminals.find((t) => t.id === id);
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
        }),
      }
    )
  )
);