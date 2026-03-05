/**
 * Example component showing Zustand store usage
 * This demonstrates the migration from Context API to Zustand
 */

import { useTerminalStore, useUIStore, useChatStore } from '../stores';
import { useStore, useStoreValue, useStoreActions } from '../stores/useStore';

/**
 * Example 1: Basic Store Usage
 * Shows how to subscribe to specific parts of the store
 */
export function TerminalListExample() {
  // Subscribe to specific slice - component only re-renders when terminals change
  const terminals = useTerminalStore((state) => state.terminals);
  const activeId = useTerminalStore((state) => state.activeId);
  const setActiveId = useTerminalStore((state) => state.setActiveId);

  return (
    <div className="terminal-list">
      <h3>Active Terminals ({terminals.length})</h3>
      {terminals.map((terminal) => (
        <div
          key={terminal.id}
          className={`terminal-item ${activeId === terminal.id ? 'active' : ''}`}
          onClick={() => setActiveId(terminal.id)}
        >
          <span className="terminal-label">{terminal.label}</span>
          <span className="terminal-status">{terminal.status}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Example 2: Using Helper Hooks for Better Performance
 * Shows optimized subscription patterns
 */
export function OptimizedTerminalView() {
  // Use shallow comparison for multiple values
  const { terminals, activeId } = useStore(useTerminalStore, (state) => ({
    terminals: state.terminals,
    activeId: state.activeId,
  }));

  // Use direct value subscription for primitives
  const terminalCount = useStoreValue(useTerminalStore, (state) => state.terminals.length);

  // Get only actions (never causes re-renders)
  const { addTerminal, removeTerminal } = useStoreActions(useTerminalStore, (state) => ({
    addTerminal: state.addTerminal,
    removeTerminal: state.removeTerminal,
  }));

  return (
    <div>
      <p>Total Terminals: {terminalCount}</p>
      <button onClick={() => addTerminal({
        id: crypto.randomUUID(),
        label: `Terminal ${terminalCount + 1}`,
        cwd: '/home/user',
        status: 'idle',
        alive: true,
        color: '#3b82f6',
      })}>
        Add Terminal
      </button>
      {activeId && (
        <button onClick={() => removeTerminal(activeId)}>
          Remove Active Terminal
        </button>
      )}
    </div>
  );
}

/**
 * Example 3: Cross-Store Communication
 * Shows how to use multiple stores together
 */
export function AppStatusBar() {
  // Subscribe to multiple stores
  const activeTerminal = useTerminalStore((state) =>
    state.terminals.find(t => t.id === state.activeId)
  );

  const isAIAssistantOpen = useUIStore((state) => state.showAIAssistant);

  const activeAgent = useChatStore((state) => state.activeAgent);

  const { hasChanges, getStagedCount } = useGitStore((state) => ({
    hasChanges: state.hasChanges(),
    getStagedCount: state.getStagedCount(),
  }));

  return (
    <div className="status-bar">
      <span>Terminal: {activeTerminal?.label || 'None'}</span>
      <span>AI: {isAIAssistantOpen ? 'Open' : 'Closed'}</span>
      <span>Agent: {activeAgent?.name || 'None'}</span>
      <span>Git: {hasChanges ? `${getStagedCount} staged` : 'Clean'}</span>
    </div>
  );
}

/**
 * Example 4: Computed Values and Selectors
 * Shows how to derive state efficiently
 */
export function GitCommitButton() {
  // Use selector functions for computed values
  const canCommit = useGitStore((state) => state.canCommit());
  const stagedCount = useGitStore((state) => state.getStagedCount());
  const commitMessage = useGitStore((state) => state.commitMessage);
  const setCommitMessage = useGitStore((state) => state.setCommitMessage);
  const committing = useGitStore((state) => state.committing);

  const handleCommit = async () => {
    // Actions can be async
    const store = useGitStore.getState();
    store.setCommitting(true);

    try {
      // Perform commit...
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear message on success
      store.setCommitMessage('');
    } finally {
      store.setCommitting(false);
    }
  };

  return (
    <div className="commit-section">
      <textarea
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        placeholder="Commit message..."
        disabled={committing}
      />
      <button
        onClick={handleCommit}
        disabled={!canCommit || committing}
      >
        {committing ? 'Committing...' : `Commit (${stagedCount} files)`}
      </button>
    </div>
  );
}

/**
 * Example 5: Settings Management with Persistence
 * Shows how persisted state works
 */
export function SettingsPanel() {
  const { terminal, general, updateTerminalSettings, toggleNotifications } = useSettingsStore(
    (state) => ({
      terminal: state.terminal,
      general: state.general,
      updateTerminalSettings: state.updateTerminalSettings,
      toggleNotifications: state.toggleNotifications,
    })
  );

  return (
    <div className="settings-panel">
      <h3>Terminal Settings</h3>
      <label>
        Font Size:
        <input
          type="number"
          value={terminal.fontSize}
          onChange={(e) => updateTerminalSettings({
            fontSize: parseInt(e.target.value)
          })}
          min={10}
          max={24}
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={general.enableNotifications}
          onChange={toggleNotifications}
        />
        Enable Notifications
      </label>

      <p className="info">
        These settings are automatically saved and will persist across sessions.
      </p>
    </div>
  );
}

/**
 * Example 6: Modal and Drawer Management
 * Shows UI state management patterns
 */
export function UIControls() {
  // Subscribe to UI state
  const {
    showNewTerminalModal,
    showAIAssistant,
    sidePanelCollapsed
  } = useUIStore((state) => ({
    showNewTerminalModal: state.showNewTerminalModal,
    showAIAssistant: state.showAIAssistant,
    sidePanelCollapsed: state.sidePanelCollapsed,
  }));

  // Get actions separately (stable references)
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const toggleDrawer = useUIStore((state) => state.toggleDrawer);
  const toggleSidePanel = useUIStore((state) => state.toggleSidePanel);

  return (
    <div className="ui-controls">
      <button onClick={() => openModal('showNewTerminalModal')}>
        New Terminal
      </button>

      <button onClick={() => toggleDrawer('showAIAssistant')}>
        {showAIAssistant ? 'Hide' : 'Show'} AI Assistant
      </button>

      <button onClick={toggleSidePanel}>
        {sidePanelCollapsed ? 'Expand' : 'Collapse'} Sidebar
      </button>

      {showNewTerminalModal && (
        <div className="modal-backdrop" onClick={() => closeModal('showNewTerminalModal')}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Terminal</h2>
            {/* Modal content */}
            <button onClick={() => closeModal('showNewTerminalModal')}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Import for Git store
import { useGitStore } from '../stores';
// Import for Settings store
import { useSettingsStore } from '../stores';

export default function ZustandExamples() {
  return (
    <div className="zustand-examples">
      <h1>Zustand Store Examples</h1>

      <section>
        <h2>Terminal Management</h2>
        <TerminalListExample />
        <OptimizedTerminalView />
      </section>

      <section>
        <h2>Cross-Store Status</h2>
        <AppStatusBar />
      </section>

      <section>
        <h2>Git Integration</h2>
        <GitCommitButton />
      </section>

      <section>
        <h2>Settings</h2>
        <SettingsPanel />
      </section>

      <section>
        <h2>UI Controls</h2>
        <UIControls />
      </section>
    </div>
  );
}