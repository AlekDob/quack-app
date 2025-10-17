import type { MCPServer } from "../types";

/**
 * MCP Server Card - Individual server display with controls
 * Shows server name, type, status, and action buttons
 */

interface MCPServerCardProps {
  server: MCPServer;
  onEdit: (server: MCPServer) => void;
  onDelete: (serverId: string) => void;
  onToggleEnabled: (server: MCPServer) => void;
  onTestConnection: (server: MCPServer) => void;
}

// Status colors and icons
const STATUS_CONFIG = {
  stopped: {
    color: "#6B7280",
    label: "Stopped",
    icon: "○",
  },
  starting: {
    color: "#EAB308",
    label: "Starting",
    icon: "◐",
  },
  running: {
    color: "#10B981",
    label: "Running",
    icon: "●",
  },
  error: {
    color: "#EF4444",
    label: "Error",
    icon: "⚠",
  },
};

// Server type icons
const TYPE_ICONS: Record<string, string> = {
  filesystem: "📁",
  github: "🔗",
  slack: "💬",
  database: "🗄️",
  puppeteer: "🌐",
  playwright: "🎭",
  custom: "⚙️",
};

export default function MCPServerCard({
  server,
  onEdit,
  onDelete,
  onToggleEnabled,
  onTestConnection,
}: MCPServerCardProps) {
  const statusConfig = STATUS_CONFIG[server.status] || STATUS_CONFIG.stopped;
  const typeIcon = TYPE_ICONS[server.type] || TYPE_ICONS.custom;

  return (
    <div
      className="rounded-lg border transition-all duration-200"
      style={{
        background: "rgba(12, 16, 24, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        opacity: server.enabled ? 1 : 0.5,
      }}
    >
      {/* Main content */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div
            className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-lg"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            {typeIcon}
          </div>

          {/* Server info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-sm font-medium truncate"
                style={{ color: "rgba(255, 255, 255, 0.9)" }}
              >
                {server.name}
              </span>
              {/* Status indicator */}
              <div className="flex items-center gap-1">
                <span style={{ color: statusConfig.color, fontSize: "10px" }}>
                  {statusConfig.icon}
                </span>
                <span
                  className="text-xs"
                  style={{ color: statusConfig.color }}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>

            {/* Command */}
            <div
              className="text-xs font-mono truncate mb-2"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {server.command} {server.args.join(" ")}
            </div>

            {/* Error message */}
            {server.error && (
              <div
                className="text-xs p-2 rounded mb-2"
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#EF4444",
                }}
              >
                {server.error}
              </div>
            )}

            {/* Environment variables count */}
            {server.env && Object.keys(server.env).length > 0 && (
              <div
                className="text-xs"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                {Object.keys(server.env).length} environment{" "}
                {Object.keys(server.env).length === 1
                  ? "variable"
                  : "variables"}
              </div>
            )}
          </div>

          {/* Enable toggle */}
          <button
            type="button"
            onClick={() => onToggleEnabled(server)}
            className="flex-shrink-0 w-10 h-5 rounded-full transition-all duration-200"
            style={{
              background: server.enabled
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(255, 255, 255, 0.1)",
              border: server.enabled
                ? "1px solid rgba(16, 185, 129, 0.5)"
                : "1px solid rgba(255, 255, 255, 0.2)",
              position: "relative",
            }}
          >
            <div
              className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-200"
              style={{
                left: server.enabled ? "calc(100% - 1rem)" : "0.125rem",
                background: server.enabled ? "#10B981" : "#6B7280",
              }}
            />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div
        className="px-3 pb-3 flex items-center gap-2"
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          paddingTop: "0.75rem",
        }}
      >
        <button
          type="button"
          onClick={() => onEdit(server)}
          className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "rgba(255, 255, 255, 0.9)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          }}
        >
          Edit
        </button>

        <button
          type="button"
          onClick={() => onTestConnection(server)}
          className="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
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
          Test
        </button>

        <button
          type="button"
          onClick={() => onDelete(server.id)}
          className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#EF4444",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
