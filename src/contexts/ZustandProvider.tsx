import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import {
  useTerminalStore,
  useChatStore,
  useUIStore,
  useFileSystemStore,
  useGitStore,
  useSettingsStore,
} from '../stores';

// Create a unified context that provides all stores
interface StoresContextValue {
  terminalStore: ReturnType<typeof useTerminalStore>;
  chatStore: ReturnType<typeof useChatStore>;
  uiStore: ReturnType<typeof useUIStore>;
  fileSystemStore: ReturnType<typeof useFileSystemStore>;
  gitStore: ReturnType<typeof useGitStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
}

const StoresContext = createContext<StoresContextValue | null>(null);

/**
 * Provider component that makes all Zustand stores available via context
 * This is optional - you can also use the store hooks directly in components
 */
export function ZustandProvider({ children }: { children: ReactNode }) {
  // Note: This is not the recommended pattern for Zustand
  // It's provided for backward compatibility with existing context-based code
  // Prefer using store hooks directly in components for better performance

  const value: StoresContextValue = {
    terminalStore: useTerminalStore(),
    chatStore: useChatStore(),
    uiStore: useUIStore(),
    fileSystemStore: useFileSystemStore(),
    gitStore: useGitStore(),
    settingsStore: useSettingsStore(),
  };

  return (
    <StoresContext.Provider value={value}>
      {children}
    </StoresContext.Provider>
  );
}

/**
 * Hook to access all stores from context
 * @deprecated Use individual store hooks directly for better performance
 */
export function useStores() {
  const context = useContext(StoresContext);
  if (!context) {
    throw new Error('useStores must be used within ZustandProvider');
  }
  return context;
}

/**
 * Migration helpers for gradual transition from Context API to Zustand
 * These hooks maintain the same API as existing context hooks
 * but use Zustand stores internally
 */

// Terminal context migration
export function useTerminal() {
  const store = useTerminalStore();
  return {
    terminals: store.terminals,
    activeTerminalId: store.activeId,
    setActiveTerminalId: store.setActiveId,
    addTerminal: store.addTerminal,
    removeTerminal: store.removeTerminal,
    updateTerminal: store.updateTerminal,
    getTerminalById: store.getTerminalById,
  };
}

// UI context migration
export function useUI() {
  const store = useUIStore();
  return {
    showNewTerminalModal: store.showNewTerminalModal,
    setShowNewTerminalModal: (show: boolean) =>
      show ? store.openModal('showNewTerminalModal') : store.closeModal('showNewTerminalModal'),
    showAIAssistant: store.showAIAssistant,
    setShowAIAssistant: (show: boolean) =>
      show ? store.openDrawer('showAIAssistant') : store.closeDrawer('showAIAssistant'),
    sidePanelCollapsed: store.sidePanelCollapsed,
    toggleSidePanel: store.toggleSidePanel,
    tabs: store.tabs,
    activeTabId: store.activeTabId,
    setActiveTab: store.setActiveTab,
    addTab: store.addTab,
    removeTab: store.removeTab,
  };
}

// Git context migration
export function useGit() {
  const store = useGitStore();
  return {
    gitSummary: store.gitSummary,
    setGitSummary: store.setGitSummary,
    selectedGitPath: store.selectedGitPath,
    setSelectedGitPath: store.setSelectedGitPath,
    diffContent: store.diffContent,
    setDiffContent: store.setDiffContent,
    diffView: store.diffView,
    setDiffView: store.setDiffView,
    commitMessage: store.commitMessage,
    setCommitMessage: store.setCommitMessage,
    loadingGit: store.loadingGit,
    setLoadingGit: store.setLoadingGit,
    committing: store.committing,
    setCommitting: store.setCommitting,
  };
}

// File system context migration
export function useFileSystem() {
  const store = useFileSystemStore();
  return {
    explorerPath: store.explorerPath,
    setExplorerPath: store.setExplorerPath,
    explorerTree: store.explorerTree,
    setExplorerTree: store.setExplorerTree,
    explorerRoot: store.explorerRoot,
    setExplorerRoot: store.setExplorerRoot,
    loadingExplorer: store.loadingExplorer,
    setLoadingExplorer: store.setLoadingExplorer,
    selectedFile: store.selectedFile,
    setSelectedFile: store.setSelectedFile,
  };
}

// Chat context migration
export function useChat() {
  const store = useChatStore();
  return {
    messages: store.getSession('default'), // Use default session for backward compat
    addMessage: (message: any) => store.addMessage('default', message),
    updateMessage: (id: string, updates: any) => store.updateMessage('default', id, updates),
    clearMessages: () => store.clearSession('default'),
    isLoading: store.isSessionLoading('default'),
    setLoading: (loading: boolean) => store.setLoading('default', loading),
    activeAgent: store.activeAgent,
    setActiveAgent: store.setActiveAgent,
  };
}