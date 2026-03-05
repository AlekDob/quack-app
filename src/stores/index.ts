// Zustand Stores for Quack App
// Centralized state management with granular subscriptions

export { useTerminalStore } from './terminalStore';
export { useChatStore } from './chatStore';
export { useUIStore } from './uiStore';
export { useFileSystemStore } from './fileSystemStore';
export { useGitStore } from './gitStore';
export { useSettingsStore } from './settingsStore';
export { useBackgroundAgentStore } from './backgroundAgentStore';

// Store types can be inferred from the hook return types
// Example usage:
// type TerminalStore = ReturnType<typeof useTerminalStore>;
// type ChatStore = ReturnType<typeof useChatStore>;
// type BackgroundAgentStore = ReturnType<typeof useBackgroundAgentStore>;
// etc.