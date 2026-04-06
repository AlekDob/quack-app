import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Store } from '@tauri-apps/plugin-store';
import { toast } from 'sonner';
import type {
  TerminalInfo,
  TerminalDataEvent,
  TerminalExitEvent,
  AgentTerminal,
  NativeTerminal,
  AgentPersonality
} from '../types';

interface TerminalMetadata {
  label: string;
  color: string;
  cwd: string;
  workingOn?: string;
  avatar?: string;
  branch?: string;
  personality?: Partial<AgentPersonality>;
}

interface TerminalContextValue {
  // Terminal state
  terminals: TerminalInfo[];
  activeId: string | null;
  agentTerminals: AgentTerminal[];
  nativeTerminals: NativeTerminal[];

  // Actions
  setActiveId: (id: string | null) => void;
  createTerminal: (options: {
    name: string;
    path: string;
    color: string;
    workingOn?: string;
    avatar?: string;
    branch?: string;
    useWorktree?: boolean;
    personality?: Partial<AgentPersonality>;
  }) => Promise<void>;
  removeTerminal: (id: string) => Promise<void>;
  updateTerminal: (id: string, updates: Partial<TerminalInfo>) => void;
  updateTerminalStatus: (id: string, status: 'idle' | 'busy') => void;
  clearTerminal: (id: string) => Promise<void>;
  reloadTerminal: (id: string) => Promise<void>;

  // Agent terminals
  addAgentTerminal: (terminal: AgentTerminal) => void;
  removeAgentTerminal: (id: string) => void;
  updateAgentTerminal: (id: string, updates: Partial<AgentTerminal>) => void;

  // Native terminals
  addNativeTerminal: (terminal: NativeTerminal) => void;
  removeNativeTerminal: (id: string) => void;
  updateNativeTerminal: (id: string, updates: Partial<NativeTerminal>) => void;

  // Utilities
  getTerminalById: (id: string) => TerminalInfo | undefined;
  getTerminalByLabel: (label: string) => TerminalInfo | undefined;
  loadSavedTerminals: () => Promise<void>;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

const COLORS = [
  'var(--accent-color)',
  '#ffb26f',
  '#ffd166',
  '#f77aa6',
  '#4dd4b3',
  '#8fa6ff',
  '#f2a57b',
];

const STORAGE_KEY = 'terminals';

export const TerminalProvider = ({ children }: { children: React.ReactNode }) => {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [agentTerminals, setAgentTerminals] = useState<AgentTerminal[]>([]);
  const [nativeTerminals, setNativeTerminals] = useState<NativeTerminal[]>([]);

  const unlistenersRef = useRef<UnlistenFn[]>([]);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Save terminals to storage with debouncing
  const saveTerminalsToStorage = useCallback(async (terms: TerminalInfo[]) => {
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = setTimeout(async () => {
      try {
        const store = await Store.load('quack-terminals.json');
        const metadata = terms.map((t) => ({
          label: t.label,
          color: t.color,
          cwd: t.cwd,
          workingOn: t.workingOn,
          avatar: t.avatar,
          branch: t.branch,
          personality: t.personality,
        }));
        await store.set(STORAGE_KEY, metadata);
        await store.save();
        console.log(`Saved ${metadata.length} terminals with personality data`);
      } catch (error) {
        console.warn('Unable to save terminals', error);
      }
    }, 1000);
  }, []);

  // Load terminals from storage
  const loadTerminalsFromStorage = useCallback(async (): Promise<TerminalMetadata[]> => {
    try {
      const store = await Store.load('quack-terminals.json');
      const stored = await store.get<TerminalMetadata[]>(STORAGE_KEY);
      return stored ?? [];
    } catch (error) {
      console.warn('Unable to load saved terminals', error);
      return [];
    }
  }, []);

  // Create a new terminal
  const createTerminal = useCallback(async (options: {
    name: string;
    path: string;
    color: string;
    workingOn?: string;
    avatar?: string;
    branch?: string;
    useWorktree?: boolean;
    personality?: Partial<AgentPersonality>;
  }) => {
    try {
      const id = await invoke<string>('create_terminal', {
        label: options.name,
        cwd: options.path,
      });

      const newTerminal: TerminalInfo = {
        id,
        label: options.name,
        color: options.color || COLORS[terminals.length % COLORS.length],
        cwd: options.path,
        alive: true,
        status: 'idle',
        workingOn: options.workingOn,
        avatar: options.avatar,
        branch: options.branch,
        useWorktree: options.useWorktree,
        worktreePath: options.useWorktree ? options.path : undefined,
        personality: options.personality,
      };

      setTerminals(prev => {
        const updated = [...prev, newTerminal];
        saveTerminalsToStorage(updated);
        return updated;
      });

      setActiveId(id);
      toast.success(`Terminal "${options.name}" created`);
    } catch (error) {
      console.error('Failed to create terminal:', error);
      toast.error(`Failed to create terminal: ${error}`);
      throw error;
    }
  }, [terminals.length, saveTerminalsToStorage]);

  // Remove a terminal
  const removeTerminal = useCallback(async (id: string) => {
    try {
      await invoke('kill_terminal', { id });

      setTerminals(prev => {
        const updated = prev.filter(t => t.id !== id);
        saveTerminalsToStorage(updated);
        return updated;
      });

      // Update active terminal if needed
      setActiveId(current => {
        if (current === id) {
          const remaining = terminals.filter(t => t.id !== id);
          return remaining.length > 0 ? remaining[0].id : null;
        }
        return current;
      });

      toast.success('Terminal removed');
    } catch (error) {
      console.error('Failed to remove terminal:', error);
      toast.error(`Failed to remove terminal: ${error}`);
    }
  }, [terminals, saveTerminalsToStorage]);

  // Update terminal
  const updateTerminal = useCallback((id: string, updates: Partial<TerminalInfo>) => {
    setTerminals(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      saveTerminalsToStorage(updated);
      return updated;
    });
  }, [saveTerminalsToStorage]);

  // Update terminal status
  const updateTerminalStatus = useCallback((id: string, status: 'idle' | 'busy') => {
    setTerminals(prev => prev.map(t =>
      t.id === id ? { ...t, status } : t
    ));
  }, []);

  // Clear terminal
  const clearTerminal = useCallback(async (id: string) => {
    try {
      await invoke('clear_terminal', { id });
      toast.success('Terminal cleared');
    } catch (error) {
      console.error('Failed to clear terminal:', error);
      toast.error(`Failed to clear terminal: ${error}`);
    }
  }, []);

  // Reload terminal
  const reloadTerminal = useCallback(async (id: string) => {
    const terminal = terminals.find(t => t.id === id);
    if (!terminal) return;

    try {
      await invoke('kill_terminal', { id });
      const newId = await invoke<string>('create_terminal', {
        label: terminal.label,
        cwd: terminal.cwd,
      });

      updateTerminal(id, { id: newId, alive: true });
      toast.success('Terminal reloaded');
    } catch (error) {
      console.error('Failed to reload terminal:', error);
      toast.error(`Failed to reload terminal: ${error}`);
    }
  }, [terminals, updateTerminal]);

  // Agent terminal management
  const addAgentTerminal = useCallback((terminal: AgentTerminal) => {
    setAgentTerminals(prev => [...prev, terminal]);
  }, []);

  const removeAgentTerminal = useCallback((id: string) => {
    setAgentTerminals(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateAgentTerminal = useCallback((id: string, updates: Partial<AgentTerminal>) => {
    setAgentTerminals(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
  }, []);

  // Native terminal management
  const addNativeTerminal = useCallback((terminal: NativeTerminal) => {
    setNativeTerminals(prev => [...prev, terminal]);
  }, []);

  const removeNativeTerminal = useCallback((id: string) => {
    setNativeTerminals(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateNativeTerminal = useCallback((id: string, updates: Partial<NativeTerminal>) => {
    setNativeTerminals(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
  }, []);

  // Utilities
  const getTerminalById = useCallback((id: string) => {
    return terminals.find(t => t.id === id);
  }, [terminals]);

  const getTerminalByLabel = useCallback((label: string) => {
    return terminals.find(t => t.label.toLowerCase() === label.toLowerCase());
  }, [terminals]);

  // Load saved terminals on mount
  const loadSavedTerminals = useCallback(async () => {
    const savedMetadata = await loadTerminalsFromStorage();

    for (const metadata of savedMetadata) {
      try {
        const id = await invoke<string>('create_terminal', {
          label: metadata.label,
          cwd: metadata.cwd,
        });

        const terminal: TerminalInfo = {
          id,
          label: metadata.label,
          color: metadata.color,
          cwd: metadata.cwd,
          alive: true,
          status: 'idle',
          workingOn: metadata.workingOn,
          avatar: metadata.avatar,
          branch: metadata.branch,
          personality: metadata.personality,
        };

        setTerminals(prev => [...prev, terminal]);
      } catch (error) {
        console.error(`Failed to restore terminal "${metadata.label}":`, error);
      }
    }
  }, [loadTerminalsFromStorage]);

  // Setup event listeners
  useEffect(() => {
    const setupListeners = async () => {
      // Terminal data events
      const unlistenData = await listen<TerminalDataEvent>('terminal-data', (event) => {
        // Handle terminal data (update status based on output patterns)
        const { id, data } = event.payload;

        // Simple heuristic: if we receive data, terminal might be busy
        // This should be improved with better pattern matching
        if (data && data.length > 0) {
          updateTerminalStatus(id, 'busy');

          // Check for prompt patterns to detect idle state
          setTimeout(() => {
            const terminal = terminals.find(t => t.id === id);
            if (terminal && terminal.status === 'busy') {
              // Check if output contains a prompt
              if (data.includes('$') || data.includes('#') || data.includes('>')) {
                updateTerminalStatus(id, 'idle');
              }
            }
          }, 500);
        }
      });

      // Terminal exit events
      const unlistenExit = await listen<TerminalExitEvent>('terminal-exit', (event) => {
        const { id } = event.payload;
        updateTerminal(id, { alive: false, status: 'idle' });
      });

      // External status updates
      const unlistenExternal = await listen<{ id: string; status: 'idle' | 'busy' }>('external-terminal-status', (event) => {
        const { id, status } = event.payload;
        const terminal = terminals.find(t => t.label === id || t.id === id);
        if (terminal) {
          updateTerminalStatus(terminal.id, status);
        }
      });

      unlistenersRef.current = [unlistenData, unlistenExit, unlistenExternal];
    };

    setupListeners();

    return () => {
      unlistenersRef.current.forEach(unlisten => unlisten());
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [terminals, updateTerminal, updateTerminalStatus]);

  const value: TerminalContextValue = {
    terminals,
    activeId,
    agentTerminals,
    nativeTerminals,
    setActiveId,
    createTerminal,
    removeTerminal,
    updateTerminal,
    updateTerminalStatus,
    clearTerminal,
    reloadTerminal,
    addAgentTerminal,
    removeAgentTerminal,
    updateAgentTerminal,
    addNativeTerminal,
    removeNativeTerminal,
    updateNativeTerminal,
    getTerminalById,
    getTerminalByLabel,
    loadSavedTerminals,
  };

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminals = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminals must be used within TerminalProvider');
  }
  return context;
};