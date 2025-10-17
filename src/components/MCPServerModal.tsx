import { useState, useEffect } from "react";
import type { MCPServer, MCPTemplate, MCPServerType } from "../types";

/**
 * MCP Server Modal - Add/Edit MCP server configuration
 * Supports both manual configuration and template-based setup
 */

interface MCPServerModalProps {
  server: MCPServer | null;
  template: MCPTemplate | null;
  templates: MCPTemplate[];
  onSave: (server: MCPServer) => Promise<void>;
  onClose: () => void;
}

export default function MCPServerModal({
  server,
  template,
  templates,
  onSave,
  onClose,
}: MCPServerModalProps) {
  const [formData, setFormData] = useState<MCPServer>({
    id: server?.id || template?.id || "",
    name: server?.name || template?.name || "",
    type: server?.type || template?.type || ("custom" as MCPServerType),
    command: server?.command || template?.config.command || "",
    args: server?.args || template?.config.args || [],
    env: server?.env || template?.config.env || {},
    enabled: server?.enabled ?? true,
    status: "stopped",
    scope: server?.scope || "project", // Default to project scope for new servers
  });

  const [argsText, setArgsText] = useState(
    formData.args.join(" ")
  );

  const [envText, setEnvText] = useState(
    formData.env
      ? Object.entries(formData.env)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n")
      : ""
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState(
    template?.id || ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTemplateId) {
      const foundTemplate = templates.find((t) => t.id === selectedTemplateId);
      if (foundTemplate) {
        setFormData({
          ...formData,
          id: foundTemplate.id,
          name: foundTemplate.name,
          type: foundTemplate.type,
          command: foundTemplate.config.command,
          args: foundTemplate.config.args,
          env: foundTemplate.config.env || {},
        });
        setArgsText(foundTemplate.config.args.join(" "));
        setEnvText(
          foundTemplate.config.env
            ? Object.entries(foundTemplate.config.env)
                .map(([key, value]) => `${key}=${value}`)
                .join("\n")
            : ""
        );
      }
    }
  }, [selectedTemplateId, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Parse args from text
      const args = argsText
        .trim()
        .split(/\s+/)
        .filter((arg) => arg.length > 0);

      // Parse env from text (KEY=value format, one per line)
      const env: Record<string, string> = {};
      if (envText.trim()) {
        envText.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (trimmed) {
            const [key, ...valueParts] = trimmed.split("=");
            if (key) {
              env[key.trim()] = valueParts.join("=").trim();
            }
          }
        });
      }

      const serverToSave: MCPServer = {
        ...formData,
        args,
        env: Object.keys(env).length > 0 ? env : undefined,
      };

      await onSave(serverToSave);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg shadow-xl"
        style={{
          background: "#0c1018",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "#f28c52" }}>
            {server ? "Edit MCP Server" : "Add MCP Server"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Template selector (only for new servers) */}
          {!server && templates.length > 0 && (
            <div>
              <label
                className="block text-xs font-medium mb-2"
                style={{ color: "rgba(255, 255, 255, 0.7)" }}
              >
                Template (optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                <option value="">Custom configuration</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} - {t.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Server ID */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              Server ID *
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              disabled={!!server} // Can't change ID when editing
              required
              placeholder="e.g., github, filesystem"
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            />
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Unique identifier for this server
            </p>
          </div>

          {/* Server Name */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              placeholder="e.g., GitHub Integration"
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            />
          </div>

          {/* Command */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              Command *
            </label>
            <input
              type="text"
              value={formData.command}
              onChange={(e) =>
                setFormData({ ...formData, command: e.target.value })
              }
              required
              placeholder="e.g., npx"
              className="w-full px-3 py-2 rounded text-sm font-mono"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            />
          </div>

          {/* Arguments */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              Arguments *
            </label>
            <input
              type="text"
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              required
              placeholder="e.g., @modelcontextprotocol/server-github"
              className="w-full px-3 py-2 rounded text-sm font-mono"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            />
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Space-separated command arguments
            </p>
          </div>

          {/* Environment Variables */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              Environment Variables (optional)
            </label>
            <textarea
              value={envText}
              onChange={(e) => setEnvText(e.target.value)}
              rows={4}
              placeholder="KEY=value&#10;ANOTHER_KEY=another_value&#10;TOKEN=${YOUR_TOKEN}"
              className="w-full px-3 py-2 rounded text-sm font-mono resize-none"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            />
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              One per line in KEY=value format. Use ${"{"}VAR{"}"} for system
              environment variables.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="p-3 rounded text-sm"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#EF4444",
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style={{
                background: "rgba(242, 140, 82, 0.2)",
                border: "1px solid rgba(242, 140, 82, 0.5)",
                color: "#f28c52",
              }}
            >
              {saving ? "Saving..." : server ? "Update Server" : "Add Server"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
