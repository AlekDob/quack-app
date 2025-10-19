import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Plugin, PluginCategory, PluginScope } from "../types";
import PluginCard from "./PluginCard";

/**
 * Plugins Panel - Browse and manage Claude Code plugins
 */

interface PluginsPanelProps {
  workingDir?: string;
  onRefresh?: () => void;
}

export default function PluginsPanel({
  workingDir,
  onRefresh,
}: PluginsPanelProps) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    PluginCategory | "all"
  >("all");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);

  const categories: Array<{ value: PluginCategory | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "agent", label: "Agents" },
    { value: "command", label: "Commands" },
    { value: "hook", label: "Hooks" },
    { value: "setting", label: "Settings" },
    { value: "mcp", label: "MCP" },
    { value: "stack", label: "Stacks" },
  ];

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const availablePlugins = await invoke<Plugin[]>(
        "list_available_plugins",
        { workingDir }
      );
      setPlugins(availablePlugins);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workingDir]);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.trim() === "") {
        await loadPlugins();
        return;
      }

      try {
        const results = await invoke<Plugin[]>("search_plugins", {
          query,
          workingDir,
        });
        setPlugins(results);
      } catch (err) {
        console.error("Search failed:", err);
      }
    },
    [loadPlugins, workingDir]
  );

  const handleInstall = useCallback(
    async (plugin: Plugin, scope: PluginScope) => {
      try {
        await invoke("install_plugin", { plugin, scope, workingDir });
        await loadPlugins();
        onRefresh?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Failed to install plugin: ${message}`);
      }
    },
    [loadPlugins, onRefresh, workingDir]
  );

  const handleUninstall = useCallback(
    async (pluginId: string) => {
      if (!window.confirm("Are you sure you want to uninstall this plugin?")) {
        return;
      }

      try {
        await invoke("uninstall_plugin", { pluginId, workingDir });
        await loadPlugins();
        onRefresh?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Failed to uninstall plugin: ${message}`);
      }
    },
    [loadPlugins, onRefresh, workingDir]
  );

  const handleViewDetails = useCallback((plugin: Plugin) => {
    setSelectedPlugin(plugin);
  }, []);

  const handleRefresh = useCallback(async () => {
    await loadPlugins();
    onRefresh?.();
  }, [loadPlugins, onRefresh]);

  const filteredPlugins = plugins.filter((plugin) => {
    if (selectedCategory !== "all" && plugin.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  const installedCount = plugins.filter((p) => p.installed).length;

  return (
    <div className="plugins-panel flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold" style={{ color: "#f28c52" }}>
            Plugin Marketplace
          </h3>
          {installedCount > 0 && (
            <div
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
              }}
            >
              {installedCount} installed
            </div>
          )}
        </div>
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
      </div>

      {/* Search and Filters */}
      <div className="px-4 py-3 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 transform -translate-y-1/2"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded text-sm"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          />
        </div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setSelectedCategory(cat.value)}
              className="px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all duration-200"
              style={{
                background:
                  selectedCategory === cat.value
                    ? "rgba(242, 140, 82, 0.2)"
                    : "rgba(255, 255, 255, 0.05)",
                border:
                  selectedCategory === cat.value
                    ? "1px solid rgba(242, 140, 82, 0.4)"
                    : "1px solid rgba(255, 255, 255, 0.12)",
                color:
                  selectedCategory === cat.value
                    ? "#f28c52"
                    : "rgba(255, 255, 255, 0.7)",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-12">
        {loading && (
          <div
            className="flex items-center justify-center py-8 text-sm"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            Loading plugins...
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
              <p className="font-medium mb-1">Error loading plugins</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && filteredPlugins.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-4"
              style={{ color: "rgba(255, 255, 255, 0.3)" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <p
              className="text-sm"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              {searchQuery
                ? "No plugins found matching your search"
                : "No plugins available"}
            </p>
          </div>
        )}

        {!loading && !error && filteredPlugins.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Plugin Details Modal */}
      {selectedPlugin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedPlugin(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg shadow-xl p-6"
            style={{
              background: "#0c1018",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2
                className="text-lg font-semibold"
                style={{ color: "#f28c52" }}
              >
                {selectedPlugin.name}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedPlugin(null)}
                className="text-2xl leading-none"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                ×
              </button>
            </div>

            <p
              className="text-sm mb-4"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              {selectedPlugin.description}
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <p
                  className="text-xs font-medium mb-1"
                  style={{ color: "rgba(255, 255, 255, 0.5)" }}
                >
                  Version
                </p>
                <p
                  className="text-sm"
                  style={{ color: "rgba(255, 255, 255, 0.9)" }}
                >
                  {selectedPlugin.version}
                </p>
              </div>
              <div>
                <p
                  className="text-xs font-medium mb-1"
                  style={{ color: "rgba(255, 255, 255, 0.5)" }}
                >
                  Author
                </p>
                <p
                  className="text-sm"
                  style={{ color: "rgba(255, 255, 255, 0.9)" }}
                >
                  {selectedPlugin.author}
                </p>
              </div>
              {selectedPlugin.repository && (
                <div>
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: "rgba(255, 255, 255, 0.5)" }}
                  >
                    Repository
                  </p>
                  <a
                    href={selectedPlugin.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline"
                    style={{ color: "#f28c52" }}
                  >
                    {selectedPlugin.repository}
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlugin(null)}
                className="flex-1 px-4 py-2 rounded text-sm font-medium transition-all duration-200"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                Close
              </button>
              {selectedPlugin.installed ? (
                <button
                  type="button"
                  onClick={() => {
                    handleUninstall(selectedPlugin.id);
                    setSelectedPlugin(null);
                  }}
                  className="flex-1 px-4 py-2 rounded text-sm font-medium transition-all duration-200"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#EF4444",
                  }}
                >
                  Uninstall
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleInstall(selectedPlugin, "project");
                    setSelectedPlugin(null);
                  }}
                  className="flex-1 px-4 py-2 rounded text-sm font-medium transition-all duration-200"
                  style={{
                    background: "rgba(242, 140, 82, 0.1)",
                    border: "1px solid rgba(242, 140, 82, 0.3)",
                    color: "#f28c52",
                  }}
                >
                  Install (Project)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
