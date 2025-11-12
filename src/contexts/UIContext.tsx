import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import type { SavedCommand, SessionInfo, AgentDetails, SkillInfo } from '../types';
import type { Tab } from '../components/TabBar';

type UpgradeLimitType = 'terminals' | 'groups' | 'backgrounds' | 'agency' | 'sync';

interface UIContextValue {
  // Modals
  showNewTerminalModal: boolean;
  showAddNativeTerminalModal: boolean;
  showBackgroundsModal: boolean;
  showLicenseModal: boolean;
  showUpgradeModal: boolean;
  upgradeLimitType: UpgradeLimitType;
  savedCommandModalOpen: boolean;
  editingCommand: SavedCommand | null;

  // Drawers
  showGitDrawer: boolean;
  showDiffDrawer: boolean;
  showPluginsDrawer: boolean;
  showSettings: boolean;
  savedCommandsDrawerOpen: boolean;
  sessionDetailsDrawerOpen: boolean;
  showQuackAgencyDrawer: boolean;
  showContextDrawer: boolean;
  showSkillDrawer: boolean;
  showTelegramSetup: boolean;

  // Panels
  sidePanelCollapsed: boolean;
  showPerformanceMonitor: boolean;
  showAIAssistant: boolean;
  proBannerExpanded: boolean;

  // Tabs
  tabs: Tab[];
  activeTabId: string;
  tabsByTerminal: Map<string, Tab[]>;

  // Selected items
  selectedSession: SessionInfo | null;
  selectedAgent: AgentDetails | null;
  selectedSkill: SkillInfo | null;
  contextScope: string | null;

  // Terminal editing
  editingTerminal: any | null;
  newTerminalName: string;
  newTerminalPath: string;
  newTerminalColor: string;
  newTerminalWorkingOn: string;
  newTerminalAvatar: string;
  newTerminalBranch: string;
  newTerminalUseWorktree: boolean;
  newTerminalPersonality: any;
  newTerminalError: string | null;

  // Settings
  quackSoundEnabled: boolean;
  currentBackground: string;
  collapsedGroups: Set<string>;

  // Saved commands
  savedCommands: SavedCommand[];

  // Actions - Modals
  setShowNewTerminalModal: (show: boolean) => void;
  setShowAddNativeTerminalModal: (show: boolean) => void;
  setShowBackgroundsModal: (show: boolean) => void;
  setShowLicenseModal: (show: boolean) => void;
  setShowUpgradeModal: (show: boolean, limitType?: UpgradeLimitType) => void;
  setSavedCommandModalOpen: (open: boolean) => void;
  setEditingCommand: (command: SavedCommand | null) => void;

  // Actions - Drawers
  setShowGitDrawer: (show: boolean) => void;
  setShowDiffDrawer: (show: boolean) => void;
  setShowPluginsDrawer: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setSavedCommandsDrawerOpen: (open: boolean) => void;
  setSessionDetailsDrawerOpen: (open: boolean) => void;
  setShowQuackAgencyDrawer: (show: boolean) => void;
  setShowContextDrawer: (show: boolean) => void;
  setShowSkillDrawer: (show: boolean) => void;
  setShowTelegramSetup: (show: boolean) => void;

  // Actions - Panels
  setSidePanelCollapsed: (collapsed: boolean) => void;
  setShowPerformanceMonitor: (show: boolean) => void;
  setShowAIAssistant: (show: boolean) => void;
  setProBannerExpanded: (expanded: boolean) => void;

  // Actions - Tabs
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: (id: string) => void;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  setTabsByTerminal: (terminalId: string, tabs: Tab[]) => void;
  getTabsByTerminal: (terminalId: string) => Tab[];

  // Actions - Selected items
  setSelectedSession: (session: SessionInfo | null) => void;
  setSelectedAgent: (agent: AgentDetails | null) => void;
  setSelectedSkill: (skill: SkillInfo | null) => void;
  setContextScope: (scope: string | null) => void;

  // Actions - Terminal editing
  setEditingTerminal: (terminal: any | null) => void;
  setNewTerminalName: (name: string) => void;
  setNewTerminalPath: (path: string) => void;
  setNewTerminalColor: (color: string) => void;
  setNewTerminalWorkingOn: (workingOn: string) => void;
  setNewTerminalAvatar: (avatar: string) => void;
  setNewTerminalBranch: (branch: string) => void;
  setNewTerminalUseWorktree: (use: boolean) => void;
  setNewTerminalPersonality: (personality: any) => void;
  setNewTerminalError: (error: string | null) => void;
  resetNewTerminalForm: () => void;

  // Actions - Settings
  setQuackSoundEnabled: (enabled: boolean) => void;
  setCurrentBackground: (background: string) => void;
  toggleGroupCollapse: (groupName: string) => void;

  // Actions - Saved commands
  setSavedCommands: (commands: SavedCommand[]) => void;
  addSavedCommand: (command: SavedCommand) => void;
  updateSavedCommand: (id: string, updates: Partial<SavedCommand>) => void;
  deleteSavedCommand: (id: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

const COLORS = [
  '#f28c52',
  '#ffb26f',
  '#ffd166',
  '#f77aa6',
  '#4dd4b3',
  '#8fa6ff',
  '#f2a57b',
];

const DEFAULT_AVATAR = '68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg';

export const UIProvider = ({ children }: { children: React.ReactNode }) => {
  // Modals
  const [showNewTerminalModal, setShowNewTerminalModal] = useState(false);
  const [showAddNativeTerminalModal, setShowAddNativeTerminalModal] = useState(false);
  const [showBackgroundsModal, setShowBackgroundsModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModalState] = useState(false);
  const [upgradeLimitType, setUpgradeLimitType] = useState<UpgradeLimitType>('terminals');
  const [savedCommandModalOpen, setSavedCommandModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SavedCommand | null>(null);

  // Drawers
  const [showGitDrawer, setShowGitDrawer] = useState(false);
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);
  const [showPluginsDrawer, setShowPluginsDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [savedCommandsDrawerOpen, setSavedCommandsDrawerOpen] = useState(false);
  const [sessionDetailsDrawerOpen, setSessionDetailsDrawerOpen] = useState(false);
  const [showQuackAgencyDrawer, setShowQuackAgencyDrawer] = useState(false);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [showSkillDrawer, setShowSkillDrawer] = useState(false);
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);

  // Panels
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [proBannerExpanded, setProBannerExpanded] = useState(true);

  // Tabs
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'chat', label: 'Chat', icon: 'chat' as const, type: 'chat' as const, closable: false },
  ]);
  const [activeTabId, setActiveTabId] = useState('chat');
  const [tabsByTerminal, setTabsByTerminalState] = useState<Map<string, Tab[]>>(new Map());

  // Selected items
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDetails | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);
  const [contextScope, setContextScope] = useState<string | null>(null);

  // Terminal editing
  const [editingTerminal, setEditingTerminal] = useState<any | null>(null);
  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalPath, setNewTerminalPath] = useState('');
  const [newTerminalColor, setNewTerminalColor] = useState(COLORS[0]);
  const [newTerminalWorkingOn, setNewTerminalWorkingOn] = useState('');
  const [newTerminalAvatar, setNewTerminalAvatar] = useState(DEFAULT_AVATAR);
  const [newTerminalBranch, setNewTerminalBranch] = useState('');
  const [newTerminalUseWorktree, setNewTerminalUseWorktree] = useState(false);
  const [newTerminalPersonality, setNewTerminalPersonality] = useState<any>({
    sarcasmLevel: 5,
    helpfulnessLevel: 8,
    creativityLevel: 7,
    formalityLevel: 3,
    verbosityLevel: 5,
    humorStyle: 'witty',
    responseStyle: 'friendly',
  });
  const [newTerminalError, setNewTerminalError] = useState<string | null>(null);

  // Settings
  const [quackSoundEnabled, setQuackSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('quackSoundEnabled');
    return stored !== null ? stored === 'true' : true;
  });
  const [currentBackground, setCurrentBackground] = useState('duck.png');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('collapsedGroups');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Saved commands
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);

  // Custom setShowUpgradeModal that also sets the limit type
  const setShowUpgradeModal = useCallback((show: boolean, limitType?: UpgradeLimitType) => {
    setShowUpgradeModalState(show);
    if (limitType) {
      setUpgradeLimitType(limitType);
    }
  }, []);

  // Tab management
  const addTab = useCallback((tab: Tab) => {
    setTabs(prev => {
      const exists = prev.find(t => t.id === tab.id);
      if (exists) return prev;
      return [...prev, tab];
    });
  }, []);

  const removeTab = useCallback((id: string) => {
    setTabs(prev => prev.filter(t => t.id !== id));
    setActiveTabId(current => current === id ? 'chat' : current);
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const setTabsByTerminal = useCallback((terminalId: string, tabs: Tab[]) => {
    setTabsByTerminalState(prev => {
      const newMap = new Map(prev);
      newMap.set(terminalId, tabs);
      return newMap;
    });
  }, []);

  const getTabsByTerminal = useCallback((terminalId: string): Tab[] => {
    return tabsByTerminal.get(terminalId) || [];
  }, [tabsByTerminal]);

  // Reset new terminal form
  const resetNewTerminalForm = useCallback(() => {
    setNewTerminalName('');
    setNewTerminalPath('');
    setNewTerminalColor(COLORS[0]);
    setNewTerminalWorkingOn('');
    setNewTerminalAvatar(DEFAULT_AVATAR);
    setNewTerminalBranch('');
    setNewTerminalUseWorktree(false);
    setNewTerminalPersonality({
      sarcasmLevel: 5,
      helpfulnessLevel: 8,
      creativityLevel: 7,
      formalityLevel: 3,
      verbosityLevel: 5,
      humorStyle: 'witty',
      responseStyle: 'friendly',
    });
    setNewTerminalError(null);
  }, []);

  // Toggle group collapse
  const toggleGroupCollapse = useCallback((groupName: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      localStorage.setItem('collapsedGroups', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  }, []);

  // Saved commands management
  const addSavedCommand = useCallback((command: SavedCommand) => {
    setSavedCommands(prev => [...prev, command]);
  }, []);

  const updateSavedCommand = useCallback((id: string, updates: Partial<SavedCommand>) => {
    setSavedCommands(prev => prev.map(cmd =>
      cmd.id === id ? { ...cmd, ...updates } : cmd
    ));
  }, []);

  const deleteSavedCommand = useCallback((id: string) => {
    setSavedCommands(prev => prev.filter(cmd => cmd.id !== id));
  }, []);

  // Load saved commands from storage
  useEffect(() => {
    const loadSavedCommands = async () => {
      try {
        const store = await Store.load('quack-commands.json');
        const commands = await store.get<SavedCommand[]>('commands');
        if (commands) {
          setSavedCommands(commands);
        }
      } catch (error) {
        console.error('Failed to load saved commands:', error);
      }
    };

    loadSavedCommands();
  }, []);

  // Save commands when they change
  useEffect(() => {
    const saveCommands = async () => {
      try {
        const store = await Store.load('quack-commands.json');
        await store.set('commands', savedCommands);
        await store.save();
      } catch (error) {
        console.error('Failed to save commands:', error);
      }
    };

    if (savedCommands.length > 0) {
      saveCommands();
    }
  }, [savedCommands]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('quackSoundEnabled', String(quackSoundEnabled));
  }, [quackSoundEnabled]);

  const value: UIContextValue = {
    // Modals
    showNewTerminalModal,
    showAddNativeTerminalModal,
    showBackgroundsModal,
    showLicenseModal,
    showUpgradeModal,
    upgradeLimitType,
    savedCommandModalOpen,
    editingCommand,

    // Drawers
    showGitDrawer,
    showDiffDrawer,
    showPluginsDrawer,
    showSettings,
    savedCommandsDrawerOpen,
    sessionDetailsDrawerOpen,
    showQuackAgencyDrawer,
    showContextDrawer,
    showSkillDrawer,
    showTelegramSetup,

    // Panels
    sidePanelCollapsed,
    showPerformanceMonitor,
    showAIAssistant,
    proBannerExpanded,

    // Tabs
    tabs,
    activeTabId,
    tabsByTerminal,

    // Selected items
    selectedSession,
    selectedAgent,
    selectedSkill,
    contextScope,

    // Terminal editing
    editingTerminal,
    newTerminalName,
    newTerminalPath,
    newTerminalColor,
    newTerminalWorkingOn,
    newTerminalAvatar,
    newTerminalBranch,
    newTerminalUseWorktree,
    newTerminalPersonality,
    newTerminalError,

    // Settings
    quackSoundEnabled,
    currentBackground,
    collapsedGroups,

    // Saved commands
    savedCommands,

    // Actions
    setShowNewTerminalModal,
    setShowAddNativeTerminalModal,
    setShowBackgroundsModal,
    setShowLicenseModal,
    setShowUpgradeModal,
    setSavedCommandModalOpen,
    setEditingCommand,
    setShowGitDrawer,
    setShowDiffDrawer,
    setShowPluginsDrawer,
    setShowSettings,
    setSavedCommandsDrawerOpen,
    setSessionDetailsDrawerOpen,
    setShowQuackAgencyDrawer,
    setShowContextDrawer,
    setShowSkillDrawer,
    setShowTelegramSetup,
    setSidePanelCollapsed,
    setShowPerformanceMonitor,
    setShowAIAssistant,
    setProBannerExpanded,
    setTabs,
    setActiveTabId,
    addTab,
    removeTab,
    updateTab,
    setTabsByTerminal,
    getTabsByTerminal,
    setSelectedSession,
    setSelectedAgent,
    setSelectedSkill,
    setContextScope,
    setEditingTerminal,
    setNewTerminalName,
    setNewTerminalPath,
    setNewTerminalColor,
    setNewTerminalWorkingOn,
    setNewTerminalAvatar,
    setNewTerminalBranch,
    setNewTerminalUseWorktree,
    setNewTerminalPersonality,
    setNewTerminalError,
    resetNewTerminalForm,
    setQuackSoundEnabled,
    setCurrentBackground,
    toggleGroupCollapse,
    setSavedCommands,
    addSavedCommand,
    updateSavedCommand,
    deleteSavedCommand,
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};