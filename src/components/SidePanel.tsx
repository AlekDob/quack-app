import { useState, type ReactNode } from "react";
import FileExplorer from "./FileExplorer";
import AgentsPanel from "./AgentsPanel";
import MCPPanel from "./MCPPanel";
import { CommandsPanel } from "./CommandsPanel";
import ContextPanel from "./ContextPanel";
import TerminalView from "./TerminalView";
import TerminalToolBar from "./TerminalToolBar";
import { NativeTerminalPanel } from "./NativeTerminalPanel";
import type { DirectoryEntry, GitStatusEntry, AgentInfo, AgentDetails, TerminalInfo, NativeTerminal } from "../types";
import type { SlashCommand } from "../hooks/useSlashCommands";

/**
 * Side Panel with tab navigation
 * Tabs: File Explorer, Agents, MCP, Commands, Context, Terminal, Native Terminals
 */

type TabId = "explorer" | "agents" | "mcp" | "commands" | "context" | "terminal" | "native-terminals";

// Tab icons - SVG icons matching the app style
const icons: Record<string, ReactNode> = {
  folder: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h3.5l1.5 1.5h5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M10 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 9a3 3 0 0 0-3 3v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1a3 3 0 0 0-3-3H5Z"
        fill="currentColor"
      />
    </svg>
  ),
  mcp: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="8" r="1.5" fill="currentColor" />
      <circle cx="13" cy="8" r="1.5" fill="currentColor" />
      <path
        d="M7 12h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  commands: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 7l2 2-2 2M10 11h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="14"
        cy="7"
        r="1.5"
        fill="currentColor"
      />
    </svg>
  ),
  context: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M5 4h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 8h8M6 11h8M6 14h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 8l2 2-2 2M10 12h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  nativeTerminals: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 8l2 2-2 2M10 12h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

interface SidePanelProps {
  // FileExplorer props
  rootPath: string | null;
  tree: Record<string, DirectoryEntry[]>;
  loading: boolean;
  error: string | null;
  activePath: string;
  activeFilePath: string | null;
  onOpenFile: (entry: DirectoryEntry) => void;
  onLoadChildren: (path: string) => Promise<DirectoryEntry[]>;
  onMentionFile?: (filePath: string, fileName: string) => void;
  modifiedEntries: GitStatusEntry[] | null;
  gitRootPath: string | null;

  // Agents props
  agents: AgentInfo[];
  selectedAgent: AgentDetails | null;
  loadingAgents: boolean;
  agentsError: string | null;
  agentsDirectoryExists: boolean;
  workingDir?: string;
  onSelectAgent: (agent: AgentInfo) => void;
  onUseAgent: (agent: AgentInfo) => void;
  onRefreshAgents: () => void;
  onCreateAgent: (
    name: string,
    description: string,
    model: string,
    color: string,
    content: string,
    scope: 'global' | 'project'
  ) => Promise<void>;

  // Commands props
  onUseCommand: (command: SlashCommand) => void;

  // Context props
  tauriAvailable: boolean;
  onOpenContextDrawer: (scope: string) => void;

  // Terminal props
  activeTerminalId: string | null;
  terminals: TerminalInfo[];
  onTerminalInput: (id: string, data: string) => void;
  onTerminalOutput: (id: string, data: string) => void;
  onUpdateRecentCommands: (commands: string[]) => void;
  onSelectTerminal: (id: string) => void;

  // TerminalToolBar props
  onExecuteCommand: (command: string, label: string) => void;
  onToggleSavedCommands: () => void;
  savedCommandsOpen: boolean;
  onCreateTerminal: () => void;

  // Native Terminals props
  nativeTerminals: NativeTerminal[];
  onAddNativeTerminal: () => void;
  onRemoveNativeTerminal: (id: string) => void;
  onOpenNativeTerminal: (terminal: NativeTerminal) => void;
  onFocusNativeTerminal: (terminal: NativeTerminal) => void;
}

export default function SidePanel({
  // FileExplorer
  rootPath,
  tree,
  loading,
  error,
  activePath,
  activeFilePath,
  onOpenFile,
  onLoadChildren,
  onMentionFile,
  modifiedEntries,
  gitRootPath,

  // Agents
  agents,
  selectedAgent,
  loadingAgents,
  agentsError,
  agentsDirectoryExists,
  workingDir,
  onSelectAgent,
  onUseAgent,
  onRefreshAgents,
  onCreateAgent,

  // Commands
  onUseCommand,

  // Context
  tauriAvailable,
  onOpenContextDrawer,

  // Terminal
  activeTerminalId,
  terminals,
  onTerminalInput,
  onTerminalOutput,
  onUpdateRecentCommands,
  onSelectTerminal,

  // TerminalToolBar
  onExecuteCommand,
  onToggleSavedCommands,
  savedCommandsOpen,
  onCreateTerminal,

  // Native Terminals
  nativeTerminals,
  onAddNativeTerminal,
  onRemoveNativeTerminal,
  onOpenNativeTerminal,
  onFocusNativeTerminal,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("explorer");

  // Tab configuration
  const tabs = [
    {
      id: "explorer" as TabId,
      label: "File Explorer",
      icon: icons.folder,
    },
    {
      id: "agents" as TabId,
      label: "Agents",
      icon: icons.agents,
      badge: agents.length,
      hasContent: agents.length > 0,
    },
    {
      id: "mcp" as TabId,
      label: "MCP Servers",
      icon: icons.mcp,
    },
    {
      id: "commands" as TabId,
      label: "Commands",
      icon: icons.commands,
    },
    {
      id: "context" as TabId,
      label: "Context",
      icon: icons.context,
    },
    {
      id: "terminal" as TabId,
      label: "Terminal",
      icon: icons.terminal,
    },
    {
      id: "native-terminals" as TabId,
      label: "Native Terminals",
      icon: icons.nativeTerminals,
      badge: nativeTerminals.length,
      hasContent: nativeTerminals.length > 0,
    },
  ];

  return (
    <aside className="side-panel">
      <div className="side-panel-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const hasContent = tab.hasContent;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`side-panel-tab ${isActive ? "active" : ""}`}
              data-tooltip={tab.label}
              aria-label={tab.label}
            >
              <span className="tab-icon">{tab.icon}</span>
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span
                  className={`side-panel-tab-badge ${
                    hasContent ? "has-content" : ""
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="side-panel-content">
        {activeTab === "explorer" && (
          <div className="side-panel-pane">
          <FileExplorer
            rootPath={rootPath}
            tree={tree}
            loading={loading}
            error={error}
            activePath={activePath}
            activeFilePath={activeFilePath}
            onOpenFile={onOpenFile}
            onLoadChildren={onLoadChildren}
            onMentionFile={onMentionFile}
            modifiedEntries={modifiedEntries}
            gitRootPath={gitRootPath}
          />
          </div>
        )}

        {activeTab === "agents" && (
          <div className="side-panel-pane">
            <AgentsPanel
              agents={agents}
              selectedAgent={selectedAgent}
              loading={loadingAgents}
              error={agentsError}
              directoryExists={agentsDirectoryExists}
              workingDir={workingDir}
              onSelectAgent={onSelectAgent}
              onUseAgent={onUseAgent}
              onRefresh={onRefreshAgents}
              onCreateAgent={onCreateAgent}
            />
          </div>
        )}

        {activeTab === "mcp" && (
          <div className="side-panel-pane">
            <MCPPanel workingDir={workingDir} />
          </div>
        )}

        {activeTab === "commands" && (
          <div className="side-panel-pane">
            <CommandsPanel
              basePath={rootPath || ''}
              onUseCommand={onUseCommand}
            />
          </div>
        )}

        {activeTab === "context" && (
          <div className="side-panel-pane">
            <ContextPanel
              tauriAvailable={tauriAvailable}
              onOpenContextDrawer={onOpenContextDrawer}
            />
          </div>
        )}

        {activeTab === "terminal" && (
          <div className="side-panel-pane terminal-panel-pane">
            {terminals.length > 0 ? (
              (() => {
                // Find active terminal's CWD
                const activeTerminal = terminals.find((t) => t.id === activeTerminalId);
                const activeCwd = activeTerminal?.cwd;

                // Filter terminals with same CWD as active terminal
                const groupTerminals = activeCwd
                  ? terminals.filter((t) => t.cwd === activeCwd)
                  : (activeTerminal ? [activeTerminal] : []);

                return (
                  <div className="terminal-container-with-iconbar">
                    {/* Active terminal view */}
                    <TerminalView
                      activeId={activeTerminalId}
                      terminals={terminals}
                      onUserInput={onTerminalInput}
                      onOutput={onTerminalOutput}
                      onUpdateRecentCommands={onUpdateRecentCommands}
                    />
                    {/* Vertical icon bar on the right - shows only terminals from same group */}
                    <div className="terminal-icon-bar">
                      {/* Add terminal button - at the top */}
                      <button
                        type="button"
                        className="terminal-icon add-terminal"
                        onClick={onCreateTerminal}
                        title="New Terminal"
                      >
                        +
                      </button>
                      {/* Terminal icons - numbered 1, 2, 3... within this group */}
                      {groupTerminals.map((terminal, index) => (
                        <button
                          key={terminal.id}
                          type="button"
                          className={`terminal-icon ${terminal.id === activeTerminalId ? 'active' : ''}`}
                          onClick={() => onSelectTerminal(terminal.id)}
                          style={{
                            backgroundColor: terminal.id === activeTerminalId ? terminal.color : 'transparent',
                            borderColor: terminal.color,
                          }}
                          title={terminal.label}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                    <TerminalToolBar
                      onExecuteCommand={onExecuteCommand}
                      onToggleSavedCommands={onToggleSavedCommands}
                      savedCommandsOpen={savedCommandsOpen}
                      onCreateTerminal={onCreateTerminal}
                    />
                  </div>
                );
              })()
            ) : (
              <div className="terminal-placeholder">
                <p>No terminals open</p>
                <p>Click + to create a new terminal</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "native-terminals" && (
          <div className="side-panel-pane">
            <NativeTerminalPanel
              terminals={nativeTerminals}
              onAdd={onAddNativeTerminal}
              onRemove={onRemoveNativeTerminal}
              onOpen={onOpenNativeTerminal}
              onFocus={onFocusNativeTerminal}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
