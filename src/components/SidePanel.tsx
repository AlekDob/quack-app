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
    <aside className="flex flex-col h-full" style={{ background: "#0c1018" }}>
      {/* Tab Navigation */}
      <div
        className="flex items-center border-b"
        style={{
          borderColor: "rgba(255, 255, 255, 0.1)",
          background: "rgba(12, 16, 24, 0.8)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const hasAgents = tab.id === "agents" && tab.hasContent;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 flex-1"
              style={{
                color: isActive
                  ? "#f28c52"
                  : "rgba(255, 255, 255, 0.6)",
                borderBottomColor: isActive ? "#f28c52" : "transparent",
                background: isActive
                  ? "rgba(242, 140, 82, 0.05)"
                  : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                }
              }}
            >
              <span className="flex items-center">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === "agents" && typeof tab.badge === "number" && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: hasAgents
                      ? "linear-gradient(135deg, #f28c52 0%, #e67339 100%)"
                      : "rgba(255, 255, 255, 0.2)",
                    color: hasAgents ? "#ffffff" : "rgba(255, 255, 255, 0.6)",
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "explorer" && (
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
        )}

        {activeTab === "agents" && (
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
        )}

        {activeTab === "context" && <ContextPanel />}
      </div>
    </aside>
  );
}
