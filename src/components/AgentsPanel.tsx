import type { AgentInfo, AgentDetails } from "../types";

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
  onRefresh,
}: AgentsPanelProps) {
  const getAgentColor = (colorName: string): string => {
    return AGENT_COLORS[colorName.toLowerCase()] || "#6B7280";
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

        {!loading && !error && agents.length > 0 && (
          <div className="p-3 space-y-2">
            {agents.map((agent) => (
              <button
                key={agent.name}
                type="button"
                onClick={() => onSelectAgent(agent)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left"
                style={{
                  background: "rgba(12, 16, 24, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(242, 140, 82, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.3)";
                  e.currentTarget.style.transform = "translateX(4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(12, 16, 24, 0.6)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                {/* Agent Badge */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getAgentColor(agent.color),
                  }}
                />

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
            ))}
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
          {agents.length} {agents.length === 1 ? "agent" : "agents"} active
        </div>
      )}
    </div>
  );
}
