import type { MCPServer } from "../types";

/**
 * MCP Server Card - Individual server display with controls
 * Shows server name, type, status, and action buttons
 */

interface MCPServerCardProps {
  server: MCPServer;
  onEdit: (server: MCPServer) => void;
  onDelete: (serverId: string) => void;
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
const TYPE_ICONS: Record<string, React.ReactElement> = {
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
  onTestConnection,
}: MCPServerCardProps) {
  const statusConfig = STATUS_CONFIG[server.status] || STATUS_CONFIG.stopped;
  const typeIcon = TYPE_ICONS[server.type] || TYPE_ICONS.custom;

  return (
    <div
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-all duration-200 cursor-pointer"
      style={{ opacity: server.enabled ? 1 : 0.5 }}
      onClick={() => onEdit(server)}
    >
      {/* Type icon - MCP green gradient background with white icon (matches AddonsDrawer) */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}
      >
        <span style={{ color: 'white' }}>{typeIcon}</span>
      </div>

      {/* Server info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/90 truncate">
            {server.name}
          </span>
          {/* Status indicator */}
          <div className="flex items-center gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: statusConfig.color }}
            />
            <span className="text-[10px]" style={{ color: statusConfig.color }}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Command/URL */}
        <div className="text-xs font-mono text-white/50 truncate mt-0.5">
          {server.transport === "stdio" && server.command && server.args && (
            <>{server.command} {server.args.join(" ")}</>
          )}
          {(server.transport === "http" || server.transport === "sse") && server.url && (
            <>{server.transport.toUpperCase()}: {server.url}</>
          )}
        </div>

        {/* Environment variables count */}
        {server.env && Object.keys(server.env).length > 0 && (
          <div className="text-[10px] text-white/40 mt-0.5">
            {Object.keys(server.env).length} environment{" "}
            {Object.keys(server.env).length === 1 ? "variable" : "variables"}
          </div>
        )}

        {/* Error message */}
        {server.error && (
          <div className="text-[10px] text-red-400 mt-1 truncate">
            {server.error}
          </div>
        )}
      </div>

      {/* Actions - show on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTestConnection(server); }}
          className="px-2 py-1 rounded text-xs font-medium transition-all duration-200 bg-white/5 hover:bg-white/10 text-white/70"
        >
          Test
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(server.id); }}
          className="px-2 py-1 rounded text-xs font-medium transition-all duration-200 hover:bg-white/10 text-white/50 hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
