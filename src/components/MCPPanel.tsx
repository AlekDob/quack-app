import { useState } from "react";
import type { MCPServer, MCPTemplate } from "../types";
import { useMCPServers } from "../hooks/useMCPServers";
import MCPServerCard from "./MCPServerCard";
import MCPServerModal from "./MCPServerModal";
import MCPTemplateCard from "./MCPTemplateCard";

/**
 * MCP Panel - Management interface for MCP (Model Context Protocol) servers
 * Displays installed MCP servers with their status and controls
 */

interface MCPPanelProps {
  workingDir?: string;
  onRefresh?: () => void;
  onOpenMcpConfig?: (filePath: string) => void; // NEW: Open .mcp.json in editor
}

export default function MCPPanel({ workingDir, onRefresh, onOpenMcpConfig }: MCPPanelProps) {
  const {
    servers,
    templates,
    loading,
    error,
    refreshServers,
    addServer,
    updateServer,
    deleteServer,
    testConnection,
    stopServer,
    restartServer,
  } = useMCPServers(workingDir);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<MCPTemplate | null>(
    null
  );
  const [deletingServer, setDeletingServer] = useState<string | null>(null);

  const handleRefresh = async () => {
    await refreshServers();
    onRefresh?.();
  };

  const handleAddServer = () => {
    setEditingServer(null);
    setSelectedTemplate(null);
    setModalOpen(true);
  };

  const handleEditServer = (server: MCPServer) => {
    setEditingServer(server);
    setSelectedTemplate(null);
    setModalOpen(true);
  };

  const handleUseTemplate = (template: MCPTemplate) => {
    setEditingServer(null);
    setSelectedTemplate(template);
    setModalOpen(true);
  };

  const handleSaveServer = async (server: MCPServer) => {
    try {
      if (editingServer) {
        await updateServer(server);
      } else {
        await addServer(server);
      }
      setModalOpen(false);
      setEditingServer(null);
      setSelectedTemplate(null);
    } catch (err) {
      console.error("Failed to save server:", err);
      throw err;
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    // Prevent double deletion (in case of double-click or race condition)
    if (deletingServer === serverId) {
      return;
    }

    const confirmed = window.confirm("Are you sure you want to delete this MCP server?");

    if (!confirmed) {
      return; // User cancelled
    }

    try {
      setDeletingServer(serverId);
      await deleteServer(serverId);
    } catch (err) {
      console.error("Failed to delete server:", err);
      alert(`Failed to delete server: ${err}`);
    } finally {
      setDeletingServer(null);
    }
  };

  const handleToggleEnabled = async (server: MCPServer) => {
    try {
      await updateServer({
        ...server,
        enabled: !server.enabled,
      });
    } catch (err) {
      console.error("Failed to toggle server:", err);
    }
  };

  const handleTestConnection = async (server: MCPServer) => {
    const success = await testConnection(server);
    if (success) {
      alert("Connection test successful!");
    } else {
      alert("Connection test failed. Please check your configuration.");
    }
  };

  const handleStopServer = async (serverId: string) => {
    try {
      await stopServer(serverId);
    } catch (err) {
      console.error("Failed to stop server:", err);
      alert(`Failed to stop server: ${err}`);
    }
  };

  const handleRestartServer = async (serverId: string) => {
    try {
      await restartServer(serverId);
    } catch (err) {
      console.error("Failed to restart server:", err);
      alert(`Failed to restart server: ${err}`);
    }
  };

  return (
    <div className="mcp-panel flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">MCP Servers</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
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
              onClick={handleAddServer}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200"
            >
              + Add Server
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div
            className="flex items-center justify-center py-8 text-sm"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            Loading MCP servers...
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
              <p className="font-medium mb-1">Error loading MCP servers</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && servers.length === 0 && (
          <div className="flex flex-col items-center py-12 px-6 text-center">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-6"
              style={{ color: "rgba(242, 140, 82, 0.4)" }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" />
            </svg>
            <h4
              className="text-lg font-bold mb-2"
              style={{ color: "#f28c52" }}
            >
              No MCP Servers
            </h4>
            <p
              className="text-sm mb-8 max-w-md leading-relaxed"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              MCP (Model Context Protocol) servers extend Claude's capabilities
              with external tools, APIs, and data sources. Get started by adding
              a server from templates or create a custom one.
            </p>

            {/* Template cards grid */}
            {templates.length > 0 && (
              <div className="w-full max-w-2xl">
                <p
                  className="text-sm font-semibold mb-4 text-left"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  Quick start with templates:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((template) => (
                    <MCPTemplateCard
                      key={template.id}
                      template={template}
                      onClick={handleUseTemplate}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddServer}
                  className="mt-6 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "rgba(255, 255, 255, 0.8)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.05)";
                  }}
                >
                  Or create a custom server
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && !error && servers.length > 0 && (
          <div className="p-3 space-y-4">
            {/* Project Servers Section */}
            {servers.filter((s) => s.scope === "project").length > 0 && (
              <div>
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span>Project Servers</span>
                    <span className="text-xs text-white/40">{servers.filter((s) => s.scope === "project").length}</span>
                  </div>
                  {/* Edit JSON button */}
                  {onOpenMcpConfig && workingDir && (
                    <button
                      type="button"
                      onClick={() => onOpenMcpConfig(workingDir)}
                      className="px-2 py-1 text-[10px] font-medium rounded hover:bg-white/10 text-white/50 hover:text-white/70 transition-colors duration-200"
                      title="Edit .mcp.json"
                    >
                      Edit JSON
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {servers
                    .filter((s) => s.scope === "project")
                    .map((server) => (
                      <MCPServerCard
                        key={server.id}
                        server={server}
                        onEdit={handleEditServer}
                        onDelete={handleDeleteServer}
                        onTestConnection={handleTestConnection}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Global Servers Section */}
            {servers.filter((s) => s.scope === "global").length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/70">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20" />
                  </svg>
                  <span>Global Servers</span>
                  <span className="text-xs text-white/40">{servers.filter((s) => s.scope === "global").length}</span>
                </div>
                <div className="space-y-1">
                  {servers
                    .filter((s) => s.scope === "global")
                    .map((server) => (
                      <MCPServerCard
                        key={server.id}
                        server={server}
                        onEdit={handleEditServer}
                        onDelete={handleDeleteServer}
                        onTestConnection={handleTestConnection}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {servers.length > 0 && (
        <div
          className="px-4 py-2.5 border-t text-xs text-center"
          style={{
            borderColor: "rgba(255, 255, 255, 0.1)",
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          {servers.length} {servers.length === 1 ? "server" : "servers"}{" "}
          configured
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <MCPServerModal
          server={editingServer}
          template={selectedTemplate}
          templates={templates}
          onSave={handleSaveServer}
          onClose={() => {
            setModalOpen(false);
            setEditingServer(null);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
}
