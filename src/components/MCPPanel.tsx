import { useState } from "react";
import type { MCPServer, MCPTemplate } from "../types";
import { useMCPServers } from "../hooks/useMCPServers";
import MCPServerCard from "./MCPServerCard";
import MCPServerModal from "./MCPServerModal";

/**
 * MCP Panel - Management interface for MCP (Model Context Protocol) servers
 * Displays installed MCP servers with their status and controls
 */

interface MCPPanelProps {
  workingDir?: string;
  onRefresh?: () => void;
}

export default function MCPPanel({ workingDir, onRefresh }: MCPPanelProps) {
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
  } = useMCPServers(workingDir);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<MCPTemplate | null>(
    null
  );

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
    if (window.confirm("Are you sure you want to delete this MCP server?")) {
      try {
        await deleteServer(serverId);
      } catch (err) {
        console.error("Failed to delete server:", err);
        alert(`Failed to delete server: ${err}`);
      }
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

  return (
    <div className="mcp-panel">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "#f28c52" }}>
          MCP Servers
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
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
          <button
            type="button"
            onClick={handleAddServer}
            className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
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
            + Add Server
          </button>
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
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="text-5xl mb-4">🔌</div>
            <h4
              className="text-base font-semibold mb-2"
              style={{ color: "#f28c52" }}
            >
              No MCP Servers
            </h4>
            <p
              className="text-sm mb-6 max-w-xs"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              Add your first MCP server to extend Claude's capabilities with
              external tools and services.
            </p>

            {/* Quick templates */}
            {templates.length > 0 && (
              <div className="w-full max-w-sm mt-4">
                <p
                  className="text-xs font-medium mb-3"
                  style={{ color: "rgba(255, 255, 255, 0.5)" }}
                >
                  Quick start with templates:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {templates.slice(0, 4).map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleUseTemplate(template)}
                      className="p-3 rounded-lg text-left transition-all duration-200"
                      style={{
                        background: "rgba(12, 16, 24, 0.6)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(242, 140, 82, 0.08)";
                        e.currentTarget.style.borderColor =
                          "rgba(242, 140, 82, 0.2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "rgba(12, 16, 24, 0.6)";
                        e.currentTarget.style.borderColor =
                          "rgba(255, 255, 255, 0.08)";
                      }}
                    >
                      <div
                        className="text-xs font-medium"
                        style={{ color: "rgba(255, 255, 255, 0.9)" }}
                      >
                        {template.name}
                      </div>
                      <div
                        className="text-xs mt-1"
                        style={{ color: "rgba(255, 255, 255, 0.5)" }}
                      >
                        {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && servers.length > 0 && (
          <div className="p-3 space-y-4">
            {/* Global Servers Section */}
            {servers.filter((s) => s.scope === "global").length > 0 && (
              <div>
                <div
                  className="text-xs font-semibold mb-2 px-2 py-1.5 rounded"
                  style={{
                    color: "rgba(255, 255, 255, 0.7)",
                    background: "rgba(255, 255, 255, 0.05)",
                  }}
                >
                  🌍 Global Servers
                  <span
                    className="ml-2 text-xs opacity-60"
                    style={{ fontWeight: "normal" }}
                  >
                    (from ~/.claude.json)
                  </span>
                </div>
                <div className="space-y-2">
                  {servers
                    .filter((s) => s.scope === "global")
                    .map((server) => (
                      <MCPServerCard
                        key={server.id}
                        server={server}
                        onEdit={handleEditServer}
                        onDelete={handleDeleteServer}
                        onToggleEnabled={handleToggleEnabled}
                        onTestConnection={handleTestConnection}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Project Servers Section */}
            {servers.filter((s) => s.scope === "project").length > 0 && (
              <div>
                <div
                  className="text-xs font-semibold mb-2 px-2 py-1.5 rounded"
                  style={{
                    color: "rgba(255, 255, 255, 0.7)",
                    background: "rgba(255, 255, 255, 0.05)",
                  }}
                >
                  📁 Project Servers
                  <span
                    className="ml-2 text-xs opacity-60"
                    style={{ fontWeight: "normal" }}
                  >
                    (from .mcp.json)
                  </span>
                </div>
                <div className="space-y-2">
                  {servers
                    .filter((s) => s.scope === "project")
                    .map((server) => (
                      <MCPServerCard
                        key={server.id}
                        server={server}
                        onEdit={handleEditServer}
                        onDelete={handleDeleteServer}
                        onToggleEnabled={handleToggleEnabled}
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
