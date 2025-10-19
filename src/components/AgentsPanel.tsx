import { useState } from 'react';
import type { AgentInfo, AgentDetails } from "../types";
import { getAgentAvatar } from "../utils/agentAvatars";

/**
 * Agents Panel - Inline list view of agents
 * Compact version without modal overlay
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
}

// Agent color mapping
const AGENT_COLORS: Record<string, string> = {
  blue: "#4A9EFF",
  purple: "#A855F7",
  green: "#10B981",
  orange: "#F59E0B",
  yellow: "#EAB308",
  red: "#EF4444",
  pink: "#EC4899",
};

export default function AgentsPanel({
  agents,
  loading,
  error,
  directoryExists,
  onSelectAgent,
  onUseAgent,
  onRefresh,
}: AgentsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const getAgentColor = (colorName: string): string => {
    return AGENT_COLORS[colorName.toLowerCase()] || "#6B7280";
  };

  // Filter agents based on search query
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="agents-panel">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "#f28c52" }}>
          AI Agents
        </h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 disabled:opacity-50"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "rgba(255, 255, 255, 0.9)",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          }}
        >
          {loading ? "..." : "↻ Refresh"}
        </button>
      </div>

      {/* Search */}
      {agents.length > 0 && (
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents..."
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
            {/* Global Agents Section */}
            {filteredAgents.filter((a) => a.scope === "global").length > 0 && (
              <div>
                <div
                  className="flex items-center text-xs font-semibold mb-2 px-2 py-1.5 rounded"
                  style={{
                    color: "rgba(255, 255, 255, 0.7)",
                    background: "rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Global Agents
                  <span
                    className="ml-2 text-xs opacity-60"
                    style={{ fontWeight: "normal" }}
                  >
                    (from ~/.claude/agents/)
                  </span>
                </div>
                <div className="space-y-2">
                  {filteredAgents
                    .filter((a) => a.scope === "global")
                    .map((agent) => (
                      <div
                        key={agent.name}
                        className="rounded-lg border transition-all duration-200"
                        style={{
                          background: "rgba(12, 16, 24, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        {/* Main clickable area for details */}
                        <button
                          type="button"
                          onClick={() => onSelectAgent(agent)}
                          className="w-full flex items-center gap-3 p-3 text-left transition-all duration-200"
                          onMouseEnter={(e) => {
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.style.background = "rgba(242, 140, 82, 0.08)";
                              parent.style.borderColor = "rgba(242, 140, 82, 0.2)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.style.background = "rgba(12, 16, 24, 0.6)";
                              parent.style.borderColor = "rgba(255, 255, 255, 0.08)";
                            }
                          }}
                        >
                          {/* Agent Avatar or Badge */}
                          {(() => {
                            const avatarPath = getAgentAvatar(agent.name);
                            if (avatarPath) {
                              return (
                                <div
                                  className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
                                  style={{
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                  }}
                                >
                                  <img
                                    src={avatarPath}
                                    alt={agent.name}
                                    style={{
                                      width: "110%",
                                      height: "110%",
                                      objectFit: "contain",
                                      objectPosition: "center",
                                      transform: "scale(1.1)",
                                    }}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: getAgentColor(agent.color),
                                }}
                              />
                            );
                          })()}

                          {/* Agent Info */}
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-sm font-medium mb-0.5 truncate"
                              style={{ color: "rgba(255, 255, 255, 0.9)" }}
                            >
                              {agent.name.replace(/-/g, " ")}
                            </div>
                            <div
                              className="text-xs truncate"
                              style={{ color: "rgba(255, 255, 255, 0.5)" }}
                            >
                              {agent.description.substring(0, 60)}
                              {agent.description.length > 60 ? "..." : ""}
                            </div>
                          </div>

                          {/* Model badge */}
                          <div
                            className="px-2 py-1 rounded text-xs font-mono flex-shrink-0"
                            style={{
                              background: "rgba(242, 140, 82, 0.1)",
                              color: "#f28c52",
                            }}
                          >
                            {agent.model}
                          </div>
                        </button>

                        {/* Use this agent button */}
                        <div
                          className="px-3 pb-3"
                          style={{
                            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUseAgent(agent);
                            }}
                            className="w-full px-3 py-1.5 mt-2 rounded text-xs font-medium transition-all duration-200"
                            style={{
                              background: "rgba(242, 140, 82, 0.1)",
                              border: "1px solid rgba(242, 140, 82, 0.3)",
                              color: "#f28c52",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(242, 140, 82, 0.2)";
                              e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.5)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(242, 140, 82, 0.1)";
                              e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.3)";
                            }}
                          >
                            Use this agent
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Project Agents Section */}
            {filteredAgents.filter((a) => a.scope === "project").length > 0 && (
              <div>
                <div
                  className="flex items-center text-xs font-semibold mb-2 px-2 py-1.5 rounded"
                  style={{
                    color: "rgba(255, 255, 255, 0.7)",
                    background: "rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  Project Agents
                  <span
                    className="ml-2 text-xs opacity-60"
                    style={{ fontWeight: "normal" }}
                  >
                    (from .claude/agents/)
                  </span>
                </div>
                <div className="space-y-2">
                  {filteredAgents
                    .filter((a) => a.scope === "project")
                    .map((agent) => (
                      <div
                        key={agent.name}
                        className="rounded-lg border transition-all duration-200"
                        style={{
                          background: "rgba(12, 16, 24, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        {/* Main clickable area for details */}
                        <button
                          type="button"
                          onClick={() => onSelectAgent(agent)}
                          className="w-full flex items-center gap-3 p-3 text-left transition-all duration-200"
                          onMouseEnter={(e) => {
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.style.background = "rgba(242, 140, 82, 0.08)";
                              parent.style.borderColor = "rgba(242, 140, 82, 0.2)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.style.background = "rgba(12, 16, 24, 0.6)";
                              parent.style.borderColor = "rgba(255, 255, 255, 0.08)";
                            }
                          }}
                        >
                          {/* Agent Avatar or Badge */}
                          {(() => {
                            const avatarPath = getAgentAvatar(agent.name);
                            if (avatarPath) {
                              return (
                                <div
                                  className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
                                  style={{
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid rgba(255, 255, 255, 0.1)",
                                  }}
                                >
                                  <img
                                    src={avatarPath}
                                    alt={agent.name}
                                    style={{
                                      width: "110%",
                                      height: "110%",
                                      objectFit: "contain",
                                      objectPosition: "center",
                                      transform: "scale(1.1)",
                                    }}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: getAgentColor(agent.color),
                                }}
                              />
                            );
                          })()}

                          {/* Agent Info */}
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-sm font-medium mb-0.5 truncate"
                              style={{ color: "rgba(255, 255, 255, 0.9)" }}
                            >
                              {agent.name.replace(/-/g, " ")}
                            </div>
                            <div
                              className="text-xs truncate"
                              style={{ color: "rgba(255, 255, 255, 0.5)" }}
                            >
                              {agent.description.substring(0, 60)}
                              {agent.description.length > 60 ? "..." : ""}
                            </div>
                          </div>

                          {/* Model badge */}
                          <div
                            className="px-2 py-1 rounded text-xs font-mono flex-shrink-0"
                            style={{
                              background: "rgba(242, 140, 82, 0.1)",
                              color: "#f28c52",
                            }}
                          >
                            {agent.model}
                          </div>
                        </button>

                        {/* Use this agent button */}
                        <div
                          className="px-3 pb-3"
                          style={{
                            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUseAgent(agent);
                            }}
                            className="w-full px-3 py-1.5 mt-2 rounded text-xs font-medium transition-all duration-200"
                            style={{
                              background: "rgba(242, 140, 82, 0.1)",
                              border: "1px solid rgba(242, 140, 82, 0.3)",
                              color: "#f28c52",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(242, 140, 82, 0.2)";
                              e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.5)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(242, 140, 82, 0.1)";
                              e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.3)";
                            }}
                          >
                            Use this agent
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
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
