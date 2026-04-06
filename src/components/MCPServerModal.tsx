import { useState, useEffect } from "react";
import type { MCPServer, MCPTemplate, MCPServerType, MCPTransportType } from "../types";
import MCPTemplateCard from "./MCPTemplateCard";

/**
 * MCP Server Modal - Add/Edit MCP server configuration
 * Supports both manual configuration and template-based setup
 * Supports stdio, HTTP, and SSE transport types
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
  // Determine initial transport type from server or template
  const getInitialTransport = (): MCPTransportType => {
    if (server) return server.transport;
    if (template && 'type' in template.config) return template.config.type as MCPTransportType;
    return 'stdio'; // Default to stdio
  };

  const [transport, setTransport] = useState<MCPTransportType>(getInitialTransport());

  const [formData, setFormData] = useState<MCPServer>({
    id: server?.id || template?.id || "",
    name: server?.name || template?.name || "",
    type: server?.type || template?.type || ("custom" as MCPServerType),
    transport,
    // Stdio fields
    command: server?.command || (template && 'command' in template.config ? template.config.command : undefined),
    args: server?.args || (template && 'args' in template.config ? template.config.args : undefined),
    // HTTP/SSE fields
    url: server?.url || (template && 'url' in template.config ? template.config.url : undefined),
    headers: server?.headers || (template && 'headers' in template.config ? template.config.headers : undefined),
    method: server?.method || (template && 'method' in template.config ? template.config.method : undefined),
    // Common fields
    env: server?.env || template?.config.env || {},
    enabled: server?.enabled ?? true,
    status: "stopped",
    scope: server?.scope || "project", // Default to project scope for new servers
  });

  const [argsText, setArgsText] = useState(
    formData.args?.join(" ") || ""
  );

  const [envText, setEnvText] = useState(
    formData.env
      ? Object.entries(formData.env)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n")
      : ""
  );

  const [headersText, setHeadersText] = useState(
    formData.headers
      ? Object.entries(formData.headers)
          .map(([key, value]) => `${key}: ${value}`)
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
        const templateTransport = foundTemplate.config.type as MCPTransportType;
        setTransport(templateTransport);

        setFormData({
          ...formData,
          id: foundTemplate.id,
          name: foundTemplate.name,
          type: foundTemplate.type,
          transport: templateTransport,
          command: 'command' in foundTemplate.config ? foundTemplate.config.command : undefined,
          args: 'args' in foundTemplate.config ? foundTemplate.config.args : undefined,
          url: 'url' in foundTemplate.config ? foundTemplate.config.url : undefined,
          headers: 'headers' in foundTemplate.config ? foundTemplate.config.headers : undefined,
          method: 'method' in foundTemplate.config ? foundTemplate.config.method : undefined,
          env: foundTemplate.config.env || {},
        });

        if ('args' in foundTemplate.config && foundTemplate.config.args) {
          setArgsText(foundTemplate.config.args.join(" "));
        }

        if ('headers' in foundTemplate.config && foundTemplate.config.headers) {
          setHeadersText(
            Object.entries(foundTemplate.config.headers)
              .map(([key, value]) => `${key}: ${value}`)
              .join("\n")
          );
        }

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

      // Parse headers from text (KEY: value format, one per line)
      const headers: Record<string, string> = {};
      if (headersText.trim()) {
        headersText.split("\n").forEach((line) => {
          const trimmed = line.trim();
          if (trimmed) {
            const [key, ...valueParts] = trimmed.split(":");
            if (key) {
              headers[key.trim()] = valueParts.join(":").trim();
            }
          }
        });
      }

      let serverToSave: MCPServer;

      if (transport === 'stdio') {
        // Parse args from text for stdio transport
        const args = argsText
          .trim()
          .split(/\s+/)
          .filter((arg) => arg.length > 0);

        serverToSave = {
          ...formData,
          transport: 'stdio',
          command: formData.command,
          args,
          url: undefined,
          headers: undefined,
          method: undefined,
          env: Object.keys(env).length > 0 ? env : undefined,
        };
      } else {
        // HTTP/SSE transport
        serverToSave = {
          ...formData,
          transport,
          command: undefined,
          args: undefined,
          url: formData.url,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          method: transport === 'http' ? (formData.method || 'POST') : undefined,
          env: Object.keys(env).length > 0 ? env : undefined,
        };
      }

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
          <h2 className="text-lg font-semibold" style={{ color: "var(--accent-color)" }}>
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

        {/* Template Cards Section - Only show when adding new server */}
        {!server && templates.length > 0 && (
          <div
            className="px-6 py-4 border-b"
            style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              Quick start with templates:
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((t) => (
                <MCPTemplateCard
                  key={t.id}
                  template={t}
                  onClick={(template) => setSelectedTemplateId(template.id)}
                />
              ))}
            </div>
            <div
              className="mt-3 pt-3 border-t text-center text-xs"
              style={{
                borderColor: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.5)",
              }}
            >
              Or configure a custom server below
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Template indicator when template is selected */}
          {selectedTemplateId && (
            <div
              className="p-3 rounded-lg flex items-start gap-3"
              style={{
                background: "rgba(var(--accent-rgb), 0.1)",
                border: "1px solid rgba(var(--accent-rgb), 0.3)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--accent-color)", flexShrink: 0 }}
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--accent-color)" }}>
                  Using {templates.find((t) => t.id === selectedTemplateId)?.name} template
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  Fields below are pre-filled. You can customize them before saving.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedTemplateId("")}
                  className="text-xs mt-2 underline"
                  style={{ color: "var(--accent-color)" }}
                >
                  Clear and start from scratch
                </button>
              </div>
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

          {/* Transport Type */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              Transport Type *
            </label>
            <select
              value={transport}
              onChange={(e) => {
                const newTransport = e.target.value as MCPTransportType;
                setTransport(newTransport);
                setFormData({ ...formData, transport: newTransport });
              }}
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            >
              <option value="stdio">stdio (Command-line)</option>
              <option value="http">HTTP (REST API)</option>
              <option value="sse">SSE (Server-Sent Events)</option>
            </select>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Protocol used to communicate with the MCP server
            </p>
          </div>

          {/* Conditional fields based on transport type */}
          {transport === 'stdio' && (
            <>
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
                  value={formData.command || ""}
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
            </>
          )}

          {(transport === 'http' || transport === 'sse') && (
            <>
              {/* URL */}
              <div>
                <label
                  className="block text-xs font-medium mb-2"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  URL *
                </label>
                <input
                  type="url"
                  value={formData.url || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  required
                  placeholder="https://example.com/mcp"
                  className="w-full px-3 py-2 rounded text-sm font-mono"
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "rgba(255, 255, 255, 0.9)",
                  }}
                />
              </div>

              {/* HTTP Method (only for HTTP transport) */}
              {transport === 'http' && (
                <div>
                  <label
                    className="block text-xs font-medium mb-2"
                    style={{ color: "rgba(255, 255, 255, 0.7)" }}
                  >
                    HTTP Method (optional)
                  </label>
                  <select
                    value={formData.method || "POST"}
                    onChange={(e) =>
                      setFormData({ ...formData, method: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "rgba(255, 255, 255, 0.9)",
                    }}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
              )}

              {/* HTTP Headers */}
              <div>
                <label
                  className="block text-xs font-medium mb-2"
                  style={{ color: "rgba(255, 255, 255, 0.7)" }}
                >
                  HTTP Headers (optional)
                </label>
                <textarea
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                  rows={4}
                  placeholder="Authorization: Bearer YOUR_TOKEN&#10;Content-Type: application/json&#10;X-Custom-Header: value"
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
                  One per line in KEY: VALUE format (e.g., Authorization: Bearer token)
                </p>
              </div>
            </>
          )}

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
                background: "rgba(var(--accent-rgb), 0.2)",
                border: "1px solid rgba(var(--accent-rgb), 0.5)",
                color: "var(--accent-color)",
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
