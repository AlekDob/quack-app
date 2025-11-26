import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Tab } from '../components/TabBar';

interface UIState {
  // Modals
  showNewTerminalModal: boolean;
  showBackgroundsModal: boolean;
  showLicenseModal: boolean;
  showSettings: boolean;
  showSavedCommandModal: boolean;

  // Drawers
  showGitDrawer: boolean;
  showDiffDrawer: boolean;
  showPluginsDrawer: boolean;
  showAIAssistant: boolean;
  showFilePreviewDrawer: boolean;
  showSavedCommandsDrawer: boolean;
  showProcessesDrawer: boolean;
  showPreviewDrawer: boolean;
  showQuackAgencyDrawer: boolean;
  sidePanelCollapsed: boolean;

  // Windows
  showTerminalWindow: boolean;

  // Tabs
  tabs: Tab[];
  activeTabId: string;
  tabsByTerminal: Map<string, Tab[]>;

  // Theme and appearance
  theme: 'dark' | 'light';
  terminalFontSize: number;
  terminalFontFamily: string;

  // Actions - Modals
  openModal: (modal: keyof UIState) => void;
  closeModal: (modal: keyof UIState) => void;
  toggleModal: (modal: keyof UIState) => void;

  // Actions - Drawers
  openDrawer: (drawer: keyof UIState) => void;
  closeDrawer: (drawer: keyof UIState) => void;
  toggleDrawer: (drawer: keyof UIState) => void;
  closeAllDrawers: () => void;

  // Actions - Windows
  openWindow: (window: keyof UIState) => void;
  closeWindow: (window: keyof UIState) => void;
  toggleWindow: (window: keyof UIState) => void;

  // Actions - Side Panel
  toggleSidePanel: () => void;
  setSidePanelCollapsed: (collapsed: boolean) => void;

  // Actions - Tabs
  setActiveTab: (tabId: string) => void;
  addTab: (tab: Tab) => void;
  removeTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  clearTabs: () => void;

  // Actions - Theme
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setTerminalFontSize: (size: number) => void;
  setTerminalFontFamily: (family: string) => void;

  // Selectors
  getActiveTab: () => Tab | undefined;
  getTabById: (id: string) => Tab | undefined;
  isModalOpen: (modal: keyof UIState) => boolean;
  isDrawerOpen: (drawer: keyof UIState) => boolean;
}

const modalKeys = [
  'showNewTerminalModal',
  'showBackgroundsModal',
  'showLicenseModal',
  'showSettings',
  'showSavedCommandModal',
];

const drawerKeys = [
  'showGitDrawer',
  'showDiffDrawer',
  'showPluginsDrawer',
  'showAIAssistant',
  'showFilePreviewDrawer',
  'showSavedCommandsDrawer',
  'showProcessesDrawer',
  'showPreviewDrawer',
  'showQuackAgencyDrawer',
];

const windowKeys = [
  'showTerminalWindow',
];

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set, get) => ({
        // Modals
        showNewTerminalModal: false,
        showBackgroundsModal: false,
        showLicenseModal: false,
        showSettings: false,
        showSavedCommandModal: false,

        // Drawers
        showGitDrawer: false,
        showDiffDrawer: false,
        showPluginsDrawer: false,
        showAIAssistant: false,
        showFilePreviewDrawer: false,
        showSavedCommandsDrawer: false,
        showProcessesDrawer: false,
        showPreviewDrawer: false,
        showQuackAgencyDrawer: false,
        sidePanelCollapsed: false,

        // Windows
        showTerminalWindow: false,

        // Tabs
        tabs: [{ id: 'chat', label: 'Chat', type: 'chat', closable: false }],
        activeTabId: 'chat',
        tabsByTerminal: new Map(),

        // Theme
        theme: 'dark',
        terminalFontSize: 14,
        terminalFontFamily: 'monospace',

        // Modal actions
        openModal: (modal) => {
          if (modalKeys.includes(modal)) {
            set({ [modal]: true });
          }
        },

        closeModal: (modal) => {
          if (modalKeys.includes(modal)) {
            set({ [modal]: false });
          }
        },

        toggleModal: (modal) => {
          if (modalKeys.includes(modal)) {
            set((state) => ({ [modal]: !state[modal as keyof UIState] }));
          }
        },

        // Drawer actions
        openDrawer: (drawer) => {
          if (drawerKeys.includes(drawer)) {
            set({ [drawer]: true });
          }
        },

        closeDrawer: (drawer) => {
          if (drawerKeys.includes(drawer)) {
            set({ [drawer]: false });
          }
        },

        toggleDrawer: (drawer) => {
          if (drawerKeys.includes(drawer)) {
            set((state) => ({ [drawer]: !state[drawer as keyof UIState] }));
          }
        },

        closeAllDrawers: () => {
          const updates: Partial<UIState> = {};
          drawerKeys.forEach((drawer) => {
            (updates as any)[drawer] = false;
          });
          set(updates);
        },

        // Window actions
        openWindow: (window) => {
          if (windowKeys.includes(window)) {
            set({ [window]: true });
          }
        },

        closeWindow: (window) => {
          if (windowKeys.includes(window)) {
            set({ [window]: false });
          }
        },

        toggleWindow: (window) => {
          if (windowKeys.includes(window)) {
            set((state) => ({ [window]: !state[window as keyof UIState] }));
          }
        },

        // Side panel actions
        toggleSidePanel: () => set((state) => ({ sidePanelCollapsed: !state.sidePanelCollapsed })),
        setSidePanelCollapsed: (collapsed) => set({ sidePanelCollapsed: collapsed }),

        // Tab actions
        setActiveTab: (tabId) => set({ activeTabId: tabId }),

        addTab: (tab) => set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
        })),

        removeTab: (tabId) => set((state) => {
          const filteredTabs = state.tabs.filter((t) => t.id !== tabId);
          return {
            tabs: filteredTabs,
            activeTabId: state.activeTabId === tabId
              ? (filteredTabs[0]?.id || 'chat')
              : state.activeTabId,
          };
        }),

        updateTab: (tabId, updates) => set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, ...updates } : t
          ),
        })),

        clearTabs: () => set({
          tabs: [{ id: 'chat', label: 'Chat', type: 'chat', closable: false }],
          activeTabId: 'chat',
        }),

        // Theme actions
        setTheme: (theme) => set({ theme }),
        toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
        setTerminalFontSize: (size) => set({ terminalFontSize: size }),
        setTerminalFontFamily: (family) => set({ terminalFontFamily: family }),

        // Selectors
        getActiveTab: () => {
          const state = get();
          return state.tabs.find((t) => t.id === state.activeTabId);
        },

        getTabById: (id) => {
          const state = get();
          return state.tabs.find((t) => t.id === id);
        },

        isModalOpen: (modal) => {
          const state = get();
          return modalKeys.includes(modal) ? state[modal as keyof UIState] === true : false;
        },

        isDrawerOpen: (drawer) => {
          const state = get();
          return drawerKeys.includes(drawer) ? state[drawer as keyof UIState] === true : false;
        },
      }),
      {
        name: 'ui-storage',
        partialize: (state) => ({
          sidePanelCollapsed: state.sidePanelCollapsed,
          theme: state.theme,
          terminalFontSize: state.terminalFontSize,
          terminalFontFamily: state.terminalFontFamily,
        }),
      }
    ),
    { name: 'ui-store' }
  )
);