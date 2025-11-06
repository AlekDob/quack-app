import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AgentDetails } from "../types";
import MarkdownText from "./MarkdownText";
import CodeEditor from "./CodeEditor";
import RevealInFinderButton from "./RevealInFinderButton";
import { AgentAvatar } from "./AgentAvatar";
import "./AgentViewer.css";

interface AgentViewerProps {
  agentName: string;
  agentScope: 'global' | 'project';
  workingDir?: string;
  onRefresh?: () => void;
}

// Agent color mapping for consistent styling
const AGENT_COLORS: Record<string, string> = {
  blue: "#4A9EFF",
  purple: "#A855F7",
  green: "#10B981",
  orange: "#F59E0B",
  yellow: "#EAB308",
  red: "#EF4444",
  pink: "#EC4899",
};

// Icon components
const icons: Record<string, ReactNode> = {
  edit: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 14.5V16h1.5l8.6-8.6-1.5-1.5L4 14.5Zm9.9-9.9 1.5 1.5 1.1-1.1a1.1 1.1 0 0 0 0-1.5l-.5-.5a1.1 1.1 0 0 0-1.5 0l-1.1 1.1Z"
        fill="currentColor"
      />
    </svg>
  ),
  save: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5 4v12h10V7.5L12.5 5H5Zm2 1h4v2H7V5Zm5 11H8v-4h4v4Z"
        fill="currentColor"
      />
    </svg>
  ),
  delete: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M8 3.5V2h4v1.5M3 5.5h14M16 5.5l-.5 10a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L4 5.5M8 8v6M12 8v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export default function AgentViewer({
  agentName,
  agentScope,
  workingDir,
  onRefresh,
}: AgentViewerProps) {
  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Edit form state
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [editModel, setEditModel] = useState("");
  const [originalModel, setOriginalModel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [originalColor, setOriginalColor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");

  // Load agent details
  useEffect(() => {
    const loadAgent = async () => {
      setLoading(true);
      setError(null);

      try {
        const details = await invoke<AgentDetails>("get_agent_details", {
          name: agentName,
          workingDir,
          scope: agentScope,
        });

        setAgent(details);
      } catch (err) {
        console.error("Failed to load agent details:", err);
        setError(`Failed to load agent: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    void loadAgent();
  }, [agentName, agentScope, workingDir]);

  const getAgentColor = (colorName: string): string => {
    return AGENT_COLORS[colorName.toLowerCase()] || "#6B7280";
  };

  const handleEdit = () => {
    if (!agent) return;

    setEditContent(agent.content);
    setOriginalContent(agent.content);
    setEditModel(agent.model);
    setOriginalModel(agent.model);
    setEditColor(agent.color);
    setOriginalColor(agent.color);
    setEditDescription(agent.description);
    setOriginalDescription(agent.description);
    setHasChanges(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent);
    setHasChanges(
      newContent !== originalContent ||
      editModel !== originalModel ||
      editColor !== originalColor ||
      editDescription !== originalDescription
    );
  };

  const handleModelChange = (newModel: string) => {
    setEditModel(newModel);
    setHasChanges(
      editContent !== originalContent ||
      newModel !== originalModel ||
      editColor !== originalColor ||
      editDescription !== originalDescription
    );
  };

  const handleColorChange = (newColor: string) => {
    setEditColor(newColor);
    setHasChanges(
      editContent !== originalContent ||
      editModel !== originalModel ||
      newColor !== originalColor ||
      editDescription !== originalDescription
    );
  };

  const handleDescriptionChange = (newDescription: string) => {
    setEditDescription(newDescription);
    setHasChanges(
      editContent !== originalContent ||
      editModel !== originalModel ||
      editColor !== originalColor ||
      newDescription !== originalDescription
    );
  };

  const handleSave = async () => {
    if (!agent) return;

    setIsSaving(true);

    try {
      await invoke("save_agent_content", {
        name: agent.name,
        content: editContent,
        model: editModel,
        color: editColor,
        description: editDescription,
        scope: agentScope,
        workingDir,
      });

      // Refresh agent details
      const updatedDetails = await invoke<AgentDetails>("get_agent_details", {
        name: agentName,
        workingDir,
        scope: agentScope,
      });

      setAgent(updatedDetails);
      setIsEditing(false);
      setHasChanges(false);

      // Notify parent to refresh agents list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to save agent:", error);
      alert(`Failed to save agent: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the agent "${agent.name.replace(/-/g, " ")}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await invoke("delete_agent", {
        name: agent.name,
        scope: agentScope,
        workingDir,
      });

      // Notify parent to refresh and close tab
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to delete agent:", error);
      alert(`Failed to delete agent: ${error}`);
    }
  };

  if (loading) {
    return (
      <div className="agent-viewer">
        <div className="agent-viewer-loading">Loading agent details...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="agent-viewer">
        <div className="agent-viewer-error">
          <p>❌ {error || "Agent not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-viewer">
      {!isEditing ? (
        <>
          {/* Header with avatar and metadata */}
          <div className="agent-viewer-header">
            <div className="agent-viewer-avatar-section">
              <AgentAvatar
                agentName={agent.name}
                avatarFilename={agent.avatar}
                alt={agent.name}
                className="agent-viewer-avatar"
              />
            </div>

            <div className="agent-viewer-info">
              <div className="agent-viewer-title-row">
                <span
                  className="agent-viewer-badge"
                  style={{
                    backgroundColor: getAgentColor(agent.color),
                  }}
                />
                <h1 className="agent-viewer-title">{agent.name.replace(/-/g, " ")}</h1>
              </div>

              <div className="agent-viewer-meta">
                <span className="agent-viewer-model">Model: {agent.model}</span>
                <span className="agent-viewer-scope">
                  {agentScope === 'global' ? '🌍 Global' : '📁 Project'}
                </span>
              </div>
            </div>

            <div className="agent-viewer-actions">
              <button
                type="button"
                className="agent-viewer-icon-button agent-viewer-edit"
                onClick={handleEdit}
                title="Edit Agent"
                aria-label="Edit Agent"
              >
                {icons.edit}
              </button>
              <button
                type="button"
                className="agent-viewer-icon-button agent-viewer-delete"
                onClick={handleDelete}
                title="Delete Agent"
                aria-label="Delete Agent"
              >
                {icons.delete}
              </button>
            </div>
          </div>

          {/* Markdown Content */}
          <div className="agent-viewer-content">
            <MarkdownText>
              {agent.description
                ? `**${agent.description}**\n\n${agent.content}`
                : agent.content}
            </MarkdownText>
          </div>

          {/* Footer with file path */}
          <div className="agent-viewer-footer">
            <span className="agent-viewer-path">{agent.file_path}</span>
            <RevealInFinderButton path={agent.file_path} iconOnly />
          </div>
        </>
      ) : (
        <div className="agent-viewer-edit">
          <div className="agent-viewer-edit-header">
            <h2>Edit Agent Documentation</h2>
            <div className="agent-viewer-edit-actions">
              <button
                type="button"
                className="agent-viewer-button agent-viewer-cancel"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <span>Cancel</span>
              </button>
              {hasChanges && (
                <button
                  type="button"
                  className="agent-viewer-button agent-viewer-save"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {icons.save}
                  <span>{isSaving ? "Saving..." : "Save"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Edit Fields */}
          <div className="agent-viewer-edit-fields">
            <div className="agent-viewer-field">
              <label className="agent-viewer-label">Description:</label>
              <textarea
                className="agent-viewer-textarea"
                value={editDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={isSaving}
                placeholder="Agent description..."
                rows={3}
              />
            </div>

            <div className="agent-viewer-field">
              <label className="agent-viewer-label">Model:</label>
              <select
                className="agent-viewer-select"
                value={editModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={isSaving}
              >
                <option value="claude-opus-4-20250514">claude-opus-4-20250514</option>
                <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
                <option value="claude-sonnet-3-5-20241022">claude-sonnet-3-5-20241022</option>
                <option value="claude-haiku-3-5-20241022">claude-haiku-3-5-20241022</option>
              </select>
            </div>

            <div className="agent-viewer-field">
              <label className="agent-viewer-label">Color:</label>
              <div className="agent-viewer-color-picker">
                <div className="agent-viewer-color-swatches">
                  {Object.entries(AGENT_COLORS).map(([colorName, colorValue]) => (
                    <button
                      key={colorName}
                      type="button"
                      className={`agent-viewer-color-swatch ${editColor.toLowerCase() === colorName ? "selected" : ""}`}
                      style={{ backgroundColor: colorValue }}
                      onClick={() => handleColorChange(colorName)}
                      disabled={isSaving}
                      title={colorName}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  className="agent-viewer-custom-color"
                  value={AGENT_COLORS[editColor.toLowerCase()] || editColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  disabled={isSaving}
                  title="Custom color"
                />
              </div>
            </div>
          </div>

          {/* Code Editor */}
          <div className="agent-viewer-editor">
            <CodeEditor
              content={editContent}
              filename={`${agent.name}.md`}
              onChange={handleContentChange}
              language="markdown"
              readOnly={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
