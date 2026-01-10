import { useState } from 'react';
import type { AgentInfo, AgentDetails } from "../types";

/**
 * Agents Panel - Inline list view of agents
 * Uses tab-based editing like Commands and Rules
 */

interface AgentsPanelProps {
  agents: AgentInfo[];
  selectedAgent: AgentDetails | null;
  loading: boolean;
  error: string | null;
  directoryExists: boolean;
  workingDir?: string;
  onSelectAgent: (agent: AgentInfo) => void;
  onUseAgent: (agent: AgentInfo) => void;
  onRefresh: () => void;
  onCreateAgent: (
    name: string,
    description: string,
    model: string,
    color: string,
    content: string,
    scope: 'global' | 'project',
    workingOn?: string,
    avatar?: string
  ) => Promise<void>;
  onSelectDroid?: (agentName: string, agentScope: 'global' | 'project', isNew?: boolean) => void;
}

// Drag handler for droid/agent items
const handleDroidDragStart = (e: React.DragEvent, agent: AgentInfo) => {
  const droidData = {
    type: 'droid',
    name: agent.name,
    path: agent.file_path,
    description: agent.description,
    color: agent.color,
  };
  e.dataTransfer.setData('application/quack-droid', JSON.stringify(droidData));
  e.dataTransfer.setData('text/plain', JSON.stringify(droidData));
  e.dataTransfer.effectAllowed = 'copy';
};

export default function AgentsPanel({
  agents,
  loading,
  error,
  directoryExists,
  onSelectAgent,
  onUseAgent,
  onRefresh,
  onSelectDroid,
}: AgentsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [projectExpanded, setProjectExpanded] = useState(true);

  // Filter agents based on search query
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Simple alphabetical sort - no unread indicators for subagents
  const sortAgents = (agentsToSort: AgentInfo[]) => {
    return [...agentsToSort].sort((a, b) => a.name.localeCompare(b.name));
  };

  // Handle new droid creation via tab (like Commands/Rules)
  const handleNewDroid = () => {
    if (onSelectDroid) {
      onSelectDroid('', 'project', true);
    }
  };

  // Handle editing an existing droid via tab
  const handleEditDroid = (agent: AgentInfo) => {
    if (onSelectDroid) {
      onSelectDroid(agent.name, agent.scope as 'global' | 'project', false);
    } else {
      // Fallback to onSelectAgent
      onSelectAgent(agent);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Droids</h3>
            <p className="text-xs text-white/50 mt-0.5">Sub Agents</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleNewDroid}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
            >
              + New Droid
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      {agents.length > 0 && (
        <div className="px-4 pb-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search droids..."
              className="w-full px-3 py-2 pl-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div
            className="flex items-center justify-center py-8 text-sm"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            Loading agents...
          </div>
        )}

        {error && (
          <div className="p-4">
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#EF4444",
              }}
            >
              <p className="font-medium mb-1">Error loading agents</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && agents.length === 0 && !directoryExists && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="text-5xl mb-4">🦆</div>
            <h4
              className="text-base font-semibold mb-2"
              style={{ color: "#f28c52" }}
            >
              No Agents Yet
            </h4>
            <p
              className="text-sm mb-6 max-w-xs"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              Create your first Quack Agency agent to get started with AI-powered assistance.
            </p>
            <p
              className="text-xs"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Use the 🦆 button in the toolbar to setup Quack Agency
            </p>
          </div>
        )}

        {!loading && !error && agents.length === 0 && directoryExists && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="text-5xl mb-4">📂</div>
            <h4
              className="text-base font-semibold mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              No agents found
            </h4>
            <p
              className="text-sm"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Add agent files to{" "}
              <code
                className="px-1.5 py-0.5 rounded text-xs font-mono"
                style={{
                  background: "rgba(242, 140, 82, 0.1)",
                  color: "#f28c52",
                }}
              >
                .claude/agents/
              </code>
            </p>
          </div>
        )}

        {!loading && !error && agents.length > 0 && filteredAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h4
              className="text-base font-semibold mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              No agents match your search
            </h4>
            <p
              className="text-sm"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Try a different search term
            </p>
          </div>
        )}

        {!loading && !error && filteredAgents.length > 0 && (
          <div className="p-3 space-y-4">
            {/* Project Agents Section */}
            {filteredAgents.filter((a) => a.scope === "project").length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setProjectExpanded(!projectExpanded)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <span className={`transition-transform ${projectExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>Project Droids</span>
                  <span className="ml-auto text-xs text-white/40">{filteredAgents.filter((a) => a.scope === "project").length}</span>
                </button>
                {projectExpanded && (
                <div className="space-y-1">
                  {sortAgents(filteredAgents.filter((a) => a.scope === "project"))
                    .map((agent) => (
                      <div
                        key={`project-${agent.name}`}
                        className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-grab active:cursor-grabbing"
                        onClick={() => handleEditDroid(agent)}
                        draggable
                        onDragStart={(e) => handleDroidDragStart(e, agent)}
                      >
                        {/* Robot Icon */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(78, 205, 196, 0.15)" }}>
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#4ecdc4" strokeWidth="1.5">
                            <rect x="4" y="6" width="12" height="12" rx="2" />
                            <circle cx="8" cy="10" r="1.3" fill="#4ecdc4"/>
                            <circle cx="12" cy="10" r="1.3" fill="#4ecdc4"/>
                            <line x1="7" y1="13" x2="13" y2="13"/>
                            <line x1="10" y1="2" x2="10" y2="6"/>
                            <circle cx="10" cy="2" r="1"/>
                          </svg>
                        </div>

                        {/* Agent Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white/90 truncate">
                            {agent.name.replace(/-/g, " ")}
                          </div>
                          {agent.description && (
                            <div className="text-xs text-white/50 truncate">
                              {agent.description}
                            </div>
                          )}
                        </div>

                        {/* Use button on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUseAgent(agent);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded text-xs font-medium transition-all duration-200 bg-white/5 hover:bg-white/10 text-white/70"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                </div>
                )}
              </div>
            )}

            {/* Global Agents Section */}
            {filteredAgents.filter((a) => a.scope === "global").length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setGlobalExpanded(!globalExpanded)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <span className={`transition-transform ${globalExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20" />
                  </svg>
                  <span>Global Droids</span>
                  <span className="ml-auto text-xs text-white/40">{filteredAgents.filter((a) => a.scope === "global").length}</span>
                </button>
                {globalExpanded && (
                <div className="space-y-1">
                  {sortAgents(filteredAgents.filter((a) => a.scope === "global"))
                    .map((agent) => (
                      <div
                        key={`global-${agent.name}`}
                        className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-grab active:cursor-grabbing"
                        onClick={() => handleEditDroid(agent)}
                        draggable
                        onDragStart={(e) => handleDroidDragStart(e, agent)}
                      >
                        {/* Robot Icon */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(78, 205, 196, 0.15)" }}>
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#4ecdc4" strokeWidth="1.5">
                            <rect x="4" y="6" width="12" height="12" rx="2" />
                            <circle cx="8" cy="10" r="1.3" fill="#4ecdc4"/>
                            <circle cx="12" cy="10" r="1.3" fill="#4ecdc4"/>
                            <line x1="7" y1="13" x2="13" y2="13"/>
                            <line x1="10" y1="2" x2="10" y2="6"/>
                            <circle cx="10" cy="2" r="1"/>
                          </svg>
                        </div>

                        {/* Agent Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white/90 truncate">
                            {agent.name.replace(/-/g, " ")}
                          </div>
                          {agent.description && (
                            <div className="text-xs text-white/50 truncate">
                              {agent.description}
                            </div>
                          )}
                        </div>

                        {/* Use button on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUseAgent(agent);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded text-xs font-medium transition-all duration-200 bg-white/5 hover:bg-white/10 text-white/70"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {agents.length > 0 && (
        <div
          className="px-4 py-2.5 border-t text-xs text-center"
          style={{
            borderColor: "rgba(255, 255, 255, 0.1)",
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          {searchQuery.trim() ? (
            <>
              {filteredAgents.length} of {agents.length} {agents.length === 1 ? "agent" : "agents"}
            </>
          ) : (
            <>
              {agents.length} {agents.length === 1 ? "agent" : "agents"} active
            </>
          )}
        </div>
      )}

    </div>
  );
}
