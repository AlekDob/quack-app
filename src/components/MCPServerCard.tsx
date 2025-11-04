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

// Status colors
const STATUS_CONFIG = {
  stopped: {
    color: "#6B7280",
    label: "Stopped",
  },
  starting: {
    color: "#EAB308",
    label: "Starting",
  },
  running: {
    color: "#10B981",
    label: "Running",
  },
  error: {
    color: "#EF4444",
    label: "Error",
  },
};

// Server type SVG paths
const TYPE_ICONS: Record<string, JSX.Element> = {
  filesystem: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  github: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  slack: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  database: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  puppeteer: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  playwright: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  ),
  custom: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
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
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: statusConfig.color,
                    boxShadow: `0 0 4px ${statusConfig.color}40`
                  }}
                />
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
