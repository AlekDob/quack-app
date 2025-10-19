import { useState } from "react";
import type { Plugin, PluginScope } from "../types";

/**
 * Plugin Card - Individual plugin display with install/uninstall actions
 */

interface PluginCardProps {
  plugin: Plugin;
  onInstall: (plugin: Plugin, scope: PluginScope) => void;
  onUninstall: (pluginId: string) => void;
  onViewDetails: (plugin: Plugin) => void;
}

export default function PluginCard({
  plugin,
  onInstall,
  onUninstall,
  onViewDetails,
}: PluginCardProps) {
  const [selectedScope, setSelectedScope] = useState<PluginScope>("project");
  const [isInstalling, setIsInstalling] = useState(false);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "agent":
        return "#8b5cf6"; // purple
      case "command":
        return "#3b82f6"; // blue
      case "hook":
        return "#10b981"; // green
      case "setting":
        return "#f59e0b"; // amber
      case "mcp":
        return "#ec4899"; // pink
      case "stack":
        return "#f28c52"; // orange
      default:
        return "#6b7280"; // gray
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "agent":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        );
      case "command":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        );
      case "hook":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case "setting":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        );
      case "mcp":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        );
      case "stack":
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
            <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
            <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="plugin-card rounded-lg p-4 transition-all duration-200"
      style={{
        background: "rgba(12, 16, 24, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(12, 16, 24, 0.8)";
        e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.3)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(12, 16, 24, 0.6)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Header with category badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
            style={{
              background: `${getCategoryColor(plugin.category)}20`,
              color: getCategoryColor(plugin.category),
            }}
          >
            {getCategoryIcon(plugin.category)}
            {plugin.category}
          </div>
          {plugin.installed && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {plugin.scope ? `Installed (${plugin.scope === 'global' ? 'Global' : 'Project'})` : 'Installed'}
            </div>
          )}
        </div>
        <div
          className="text-xs"
          style={{ color: "rgba(255, 255, 255, 0.5)" }}
        >
          v{plugin.version}
        </div>
      </div>

      {/* Plugin name and description */}
      <h3
        className="text-base font-semibold mb-2"
        style={{ color: "rgba(255, 255, 255, 0.9)" }}
      >
        {plugin.name}
      </h3>
      <p
        className="text-sm mb-3 line-clamp-2"
        style={{ color: "rgba(255, 255, 255, 0.6)" }}
      >
        {plugin.description}
      </p>

      {/* Tags */}
      {plugin.metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {plugin.metadata.tags.slice(0, 3).map((tag) => (
            <div
              key={tag}
              className="px-2 py-0.5 rounded text-xs"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                color: "rgba(255, 255, 255, 0.5)",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      )}

      {/* Author and source */}
      <div
        className="flex items-center justify-between text-xs mb-3"
        style={{ color: "rgba(255, 255, 255, 0.5)" }}
      >
        <span>by {plugin.author}</span>
        <span className="capitalize">{plugin.source}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => onViewDetails(plugin)}
          className="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all duration-200"
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
          Details
        </button>
        {plugin.installed ? (
          <button
            type="button"
            onClick={() => onUninstall(plugin.id)}
            className="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all duration-200"
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
            Uninstall
          </button>
        ) : (
          <div className="flex-1 flex gap-1.5">
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value as PluginScope)}
              className="px-1.5 py-1.5 rounded text-xs font-medium transition-all duration-200"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
                cursor: "pointer",
                minWidth: "70px",
              }}
              disabled={isInstalling}
            >
              <option value="project">Project</option>
              <option value="global">Global</option>
            </select>
            <button
              type="button"
              onClick={async () => {
                setIsInstalling(true);
                try {
                  await onInstall(plugin, selectedScope);
                } finally {
                  setIsInstalling(false);
                }
              }}
              disabled={isInstalling}
              className="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              style={{
                background: "rgba(242, 140, 82, 0.1)",
                border: "1px solid rgba(242, 140, 82, 0.3)",
                color: "#f28c52",
              }}
              onMouseEnter={(e) => {
                if (!isInstalling) {
                  e.currentTarget.style.background = "rgba(242, 140, 82, 0.2)";
                  e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.5)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(242, 140, 82, 0.1)";
                e.currentTarget.style.borderColor = "rgba(242, 140, 82, 0.3)";
              }}
            >
              {isInstalling ? (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-spin"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Installing...
                </>
              ) : (
                "Install"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
