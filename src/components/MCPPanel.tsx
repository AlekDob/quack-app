import { useState, useRef, useEffect } from "react";
import type { MCPServer } from "../types";
import { useMCPServers } from "../hooks/useMCPServers";
import MCPServerCard from "./MCPServerCard";
import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";

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
    loading,
    error,
    refreshServers,
    deleteServer,
    testConnection,
  } = useMCPServers(workingDir);

  const [deletingServer, setDeletingServer] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showEditDropdown, setShowEditDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEditDropdown(false);
      }
    }
    if (showEditDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEditDropdown]);

  const handleRefresh = async () => {
    await refreshServers();
    onRefresh?.();
  };

  const handleOpenMcpJson = async (scope: "project" | "global" | "claude-global") => {
    setShowEditDropdown(false);
    try {
      let filePath: string;
      if (scope === "project" && workingDir) {
        filePath = await join(workingDir, ".mcp.json");
      } else if (scope === "claude-global") {
        const home = await homeDir();
        filePath = await join(home, ".claude", ".mcp.json");
      } else {
        const home = await homeDir();
        filePath = await join(home, ".mcp.json");
      }

      // Check if file exists, if not ask to create it
      try {
        await invoke<string>("read_file_content", { path: filePath });
      } catch {
        const label = scope === "project" ? "Project" : scope === "claude-global" ? "Claude Code global" : "Global";
        const shouldCreate = window.confirm(
          `${label} .mcp.json doesn't exist yet.\n\nCreate it now?`
        );
        if (!shouldCreate) return;
        await invoke("write_file_content", {
          path: filePath,
          content: JSON.stringify({ mcpServers: {} }, null, 2) + "\n",
        });
      }

      onOpenMcpConfig?.(filePath);
    } catch (err) {
      console.error("Failed to open .mcp.json:", err);
    }
  };

  const handleDeleteServer = (serverId: string) => {
    setConfirmDeleteId(serverId);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      setDeletingServer(confirmDeleteId);
      setConfirmDeleteId(null);
      await deleteServer(confirmDeleteId);
    } catch (err) {
      console.error("Failed to delete server:", err);
    } finally {
      setDeletingServer(null);
    }
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const handleEditServer = (server: MCPServer) => {
    handleOpenMcpJson(server.scope === "project" ? "project" : "global");
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
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowEditDropdown(!showEditDropdown)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-white/70 hover:text-white hover:bg-white/10 border border-white/15 transition-colors duration-200 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit JSON
                <svg className={`w-3 h-3 transition-transform ${showEditDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showEditDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg overflow-hidden shadow-xl z-50" style={{ background: 'rgba(30, 30, 30, 0.95)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                  {workingDir && (
                    <button
                      type="button"
                      onClick={() => handleOpenMcpJson("project")}
                      className="w-full px-3 py-2.5 text-left text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
                      style={{ color: 'rgba(255, 255, 255, 0.8)' }}
                    >
                      <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      Project .mcp.json
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenMcpJson("global")}
                    className="w-full px-3 py-2.5 text-left text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
                    style={{ color: 'rgba(255, 255, 255, 0.8)', borderTop: workingDir ? '1px solid rgba(255, 255, 255, 0.08)' : 'none' }}
                  >
                    <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Global .mcp.json
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenMcpJson("claude-global")}
                    className="w-full px-3 py-2.5 text-left text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
                    style={{ color: 'rgba(255, 255, 255, 0.8)', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
                  >
                    <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Claude Code .mcp.json
                  </button>
                </div>
              )}
            </div>
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
              className="text-sm mb-4 max-w-md leading-relaxed"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              MCP (Model Context Protocol) servers extend Claude's capabilities
              with external tools, APIs, and data sources.
            </p>
            <p
              className="text-xs mb-6 max-w-md leading-relaxed"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
            >
              Use the "Edit JSON" button above to open your .mcp.json file and
              add server configurations.
            </p>
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

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl" style={{ background: '#1e1e1e', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <h4 className="text-sm font-semibold text-white mb-2">Delete MCP Server</h4>
            <p className="text-xs text-white/60 mb-5">
              Are you sure you want to delete <span className="text-white/90 font-medium">{servers.find(s => s.id === confirmDeleteId)?.name ?? confirmDeleteId}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelDelete}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingServer !== null}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-red-500/90 hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {deletingServer ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
