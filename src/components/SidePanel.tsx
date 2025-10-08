import { useState, type ReactNode } from "react";
import FileExplorer from "./FileExplorer";
import AgentsPanel from "./AgentsPanel";
import ContextPanel from "./ContextPanel";
import type { DirectoryEntry, GitStatusEntry, AgentInfo, AgentDetails } from "../types";

/**
 * Side Panel with tab navigation
 * Tabs: File Explorer, Agents, Context
 */

type TabId = "explorer" | "agents" | "context";

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
  onRefreshAgents: () => void;
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
  onRefreshAgents,
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
      id: "context" as TabId,
      label: "Context",
      icon: icons.context,
    },
  ];

  return (
    <aside className="side-panel">
      <div className="side-panel-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const hasAgents = tab.id === "agents" && tab.hasContent;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`side-panel-tab ${isActive ? "active" : ""}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === "agents" && typeof tab.badge === "number" && (
                <span
                  className={`side-panel-tab-badge ${
                    hasAgents ? "has-content" : ""
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
              onRefresh={onRefreshAgents}
            />
          </div>
        )}

        {activeTab === "context" && (
          <div className="side-panel-pane">
            <ContextPanel />
          </div>
        )}
      </div>
    </aside>
  );
}
