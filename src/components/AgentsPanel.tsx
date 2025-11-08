import { useState } from 'react';
import type { AgentInfo, AgentDetails } from "../types";
import { NewAgentModal } from "./NewAgentModal";
import { AgentAvatar } from "./AgentAvatar";
import './AgentsPanel.css';

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
}

export default function AgentsPanel({
  agents,
  loading,
  error,
  directoryExists,
  onSelectAgent,
  onUseAgent,
  onRefresh,
  onCreateAgent,
}: AgentsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [projectExpanded, setProjectExpanded] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Filter agents based on search query
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort agents within each scope: unread messages first, then by timestamp
  const sortAgents = (agentsToSort: AgentInfo[]) => {
    return [...agentsToSort].sort((a, b) => {
      // First, prioritize agents with unread messages
      if (a.hasUnreadMessages && !b.hasUnreadMessages) return -1;
      if (!a.hasUnreadMessages && b.hasUnreadMessages) return 1;

      // Then sort by last message timestamp (newest first)
      const timeA = a.lastMessageTimestamp ?? 0;
      const timeB = b.lastMessageTimestamp ?? 0;
      return timeB - timeA;
    });
  };

  // Helper to render unread indicator
  const renderUnreadIndicator = (agent: AgentInfo) => {
    if (agent.isEmpty) {
      // Empty chat - show sleeping indicator
      return (
        <span className="text-base" title="No messages yet">
          💤
        </span>
      );
    }

    if (agent.hasUnreadMessages) {
      // Unread messages - show pulsing chat indicator
      return (
        <span
          className="text-base animate-pulse-unread"
          title="Unread messages"
          style={{
            animation: 'pulse-unread 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        >
          💬
        </span>
      );
    }

    // All messages read - no indicator
    return null;
  };

  const handleCreateAgent = async (
    name: string,
    description: string,
    model: string,
    color: string,
    content: string,
    scope: 'global' | 'project',
    workingOn?: string,
    avatar?: string
  ) => {
    await onCreateAgent(name, description, model, color, content, scope, workingOn, avatar);
    setModalOpen(false);
    onRefresh();
  };

  return (
    <div className="agents-panel">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "#f28c52" }}>
            Duck Agents
          </h3>
          <p className="text-xs" style={{ color: "rgba(255, 255, 255, 0.5)", marginTop: "2px" }}>
            Sub Agents
          </p>
        </div>
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

      {/* Search and New Agent Button */}
      {agents.length > 0 && (
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
          <div className="flex items-center gap-2 mb-0">
            <div className="relative flex-1">
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
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200 whitespace-nowrap"
            >
              + New Agent
            </button>
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
                  <span>Global Protocol Droids</span>
                  <span className="ml-auto text-xs text-white/40">{filteredAgents.filter((a) => a.scope === "global").length}</span>
                </button>
                {globalExpanded && (
                <div className="space-y-2">
                  {sortAgents(filteredAgents.filter((a) => a.scope === "global"))
                    .map((agent) => (
                      <div
                        key={`global-${agent.name}`}
                        className="rounded-lg border transition-all duration-200"
                        style={{
                          background: "rgba(12, 16, 24, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        {/* Agent card with avatar on left, content in middle, Use button on right */}
                        <div
                          className="w-full flex items-start gap-3 p-3 transition-all duration-200 cursor-pointer"
                          onClick={() => onSelectAgent(agent)}
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
                          {/* Smaller Agent Avatar - 40px (w-10 h-10) with less rounded corners */}
                          <div
                            className="w-10 h-10 flex-shrink-0 overflow-hidden flex items-center justify-center"
                            style={{
                              background: "rgba(255, 255, 255, 0.05)",
                              border: `1px solid ${agent.color}`,
                              boxShadow: `0 0 8px ${agent.color}40`,
                              borderRadius: "6px",
                            }}
                          >
                            <AgentAvatar
                              agentName={agent.name}
                              avatarFilename={agent.avatar}
                              alt={agent.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                objectPosition: "center",
                              }}
                            />
                          </div>

                          {/* Agent Info - 4 lines */}
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            {/* Line 1: Model tag */}
                            <div
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono self-start"
                              style={{
                                background: "rgba(242, 140, 82, 0.1)",
                                color: "#f28c52",
                              }}
                            >
                              {agent.model}
                            </div>

                            {/* Line 2: Agent Name with unread indicator */}
                            <div className="flex items-center gap-2">
                              <div
                                className="text-sm font-medium text-left"
                                style={{ color: "rgba(255, 255, 255, 0.9)" }}
                              >
                                {agent.name.replace(/-/g, " ")}
                              </div>
                              {renderUnreadIndicator(agent)}
                            </div>

                            {/* Line 2.5: Working On (if exists) */}
                            {agent.workingOn && (
                              <div
                                className="text-[10px] italic truncate"
                                style={{ color: "rgba(255, 255, 255, 0.4)" }}
                              >
                                {agent.workingOn}
                              </div>
                            )}

                            {/* Line 3: Description */}
                            <div
                              className="text-xs truncate"
                              style={{ color: "rgba(255, 255, 255, 0.5)" }}
                            >
                              {agent.description.substring(0, 45)}
                              {agent.description.length > 45 ? "..." : ""}
                            </div>
                          </div>

                          {/* Smaller "Use" button on right */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUseAgent(agent);
                            }}
                            className="px-2.5 py-1.5 rounded text-xs font-medium flex-shrink-0 self-start transition-all duration-200"
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
                            Use
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
                )}
              </div>
            )}

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
                  <span>Project Protocol Droids</span>
                  <span className="ml-auto text-xs text-white/40">{filteredAgents.filter((a) => a.scope === "project").length}</span>
                </button>
                {projectExpanded && (
                <div className="space-y-2">
                  {sortAgents(filteredAgents.filter((a) => a.scope === "project"))
                    .map((agent) => (
                      <div
                        key={`project-${agent.name}`}
                        className="rounded-lg border transition-all duration-200"
                        style={{
                          background: "rgba(12, 16, 24, 0.6)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        {/* Agent card with avatar on left, content in middle, Use button on right */}
                        <div
                          className="w-full flex items-start gap-3 p-3 transition-all duration-200 cursor-pointer"
                          onClick={() => onSelectAgent(agent)}
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
                          {/* Smaller Agent Avatar - 40px (w-10 h-10) with less rounded corners */}
                          <div
                            className="w-10 h-10 flex-shrink-0 overflow-hidden flex items-center justify-center"
                            style={{
                              background: "rgba(255, 255, 255, 0.05)",
                              border: `1px solid ${agent.color}`,
                              boxShadow: `0 0 8px ${agent.color}40`,
                              borderRadius: "6px",
                            }}
                          >
                            <AgentAvatar
                              agentName={agent.name}
                              avatarFilename={agent.avatar}
                              alt={agent.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                objectPosition: "center",
                              }}
                            />
                          </div>

                          {/* Agent Info - 4 lines */}
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            {/* Line 1: Model tag */}
                            <div
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono self-start"
                              style={{
                                background: "rgba(242, 140, 82, 0.1)",
                                color: "#f28c52",
                              }}
                            >
                              {agent.model}
                            </div>

                            {/* Line 2: Agent Name with unread indicator */}
                            <div className="flex items-center gap-2">
                              <div
                                className="text-sm font-medium text-left"
                                style={{ color: "rgba(255, 255, 255, 0.9)" }}
                              >
                                {agent.name.replace(/-/g, " ")}
                              </div>
                              {renderUnreadIndicator(agent)}
                            </div>

                            {/* Line 2.5: Working On (if exists) */}
                            {agent.workingOn && (
                              <div
                                className="text-[10px] italic truncate"
                                style={{ color: "rgba(255, 255, 255, 0.4)" }}
                              >
                                {agent.workingOn}
                              </div>
                            )}

                            {/* Line 3: Description */}
                            <div
                              className="text-xs truncate"
                              style={{ color: "rgba(255, 255, 255, 0.5)" }}
                            >
                              {agent.description.substring(0, 45)}
                              {agent.description.length > 45 ? "..." : ""}
                            </div>
                          </div>

                          {/* Smaller "Use" button on right */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUseAgent(agent);
                            }}
                            className="px-2.5 py-1.5 rounded text-xs font-medium flex-shrink-0 self-start transition-all duration-200"
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
                            Use
                          </button>
                        </div>
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

      {/* New Agent Modal */}
      <NewAgentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreateAgent}
        existingAgents={agents}
      />
    </div>
  );
}
