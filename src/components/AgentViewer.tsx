import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AgentDetails } from "../types";
import MarkdownText from "./MarkdownText";
import CodeEditorCodeMirror from "./CodeEditorCodeMirror";
import RevealInFinderButton from "./RevealInFinderButton";
import { AgentAvatar } from "./AgentAvatar";
import "./AgentViewer.css";

interface AgentViewerProps {
  agentName: string;
  agentScope: 'global' | 'project';
  workingDir?: string;
  onRefresh?: () => void;
  isNewAgent?: boolean; // If true, start in edit mode for creating new agent
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

// Normalize legacy full API model IDs to short names
// Short IDs from modelService (e.g. "sonnet5", "opus") pass through unchanged
const getModelDisplayName = (model: string): string => {
  if (model.startsWith("claude-")) {
    if (model.includes("opus")) return "opus";
    if (model.includes("haiku")) return "haiku";
    if (model.includes("sonnet")) return "sonnet";
  }
  return model;
};

// Convert full model name to short name for storage
const getShortModelName = (model: string): string => {
  return getModelDisplayName(model);
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
  isNewAgent = false,
}: AgentViewerProps) {
  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [loading, setLoading] = useState(!isNewAgent);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNewAgent);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [editModel, setEditModel] = useState("sonnet");
  const [originalModel, setOriginalModel] = useState("");
  const [editColor, setEditColor] = useState("blue");
  const [originalColor, setOriginalColor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [editScope, setEditScope] = useState<'global' | 'project'>(agentScope);

  // Load agent details
  useEffect(() => {
    if (isNewAgent) {
      // Initialize empty agent for creation mode
      setAgent({
        name: "",
        description: "",
        model: "sonnet",
        color: "blue",
        content: "",
        file_path: "",
        scope: agentScope,
      });
      // Initialize edit form states for new agent
      setEditName("");
      setEditDescription("");
      setEditModel("sonnet");
      setEditColor("blue");
      setEditContent("");
      setEditScope(agentScope);
      setHasChanges(true); // Enable save button for new agents
      setLoading(false);
      return;
    }

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
  }, [agentName, agentScope, workingDir, isNewAgent]);

  const getAgentColor = (colorName: string): string => {
    return AGENT_COLORS[colorName.toLowerCase()] || "#6B7280";
  };

  const handleEdit = () => {
    if (!agent) return;

    const shortModel = getShortModelName(agent.model);
    setEditContent(agent.content);
    setOriginalContent(agent.content);
    setEditModel(shortModel);
    setOriginalModel(shortModel);
    setEditColor(agent.color);
    setOriginalColor(agent.color);
    setEditDescription(agent.description);
    setOriginalDescription(agent.description);
    setHasChanges(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isNewAgent) {
      // Close the tab when canceling new agent creation
      if (onRefresh) {
        onRefresh();
      }
      return;
    }
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
    if (!agent && !isNewAgent) return;

    setIsSaving(true);

    try {
      const nameToUse = isNewAgent ? editName : agent!.name;
      const scopeToUse = isNewAgent ? editScope : agentScope;

      await invoke("save_agent_content", {
        name: nameToUse,
        content: editContent,
        model: editModel,
        color: editColor,
        description: editDescription,
        scope: scopeToUse,
        workingDir,
      });

      if (isNewAgent) {
        // For new agents, just close and refresh the list
        setIsEditing(false);
        if (onRefresh) {
          onRefresh();
        }
      } else {
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

  if (error || (!agent && !isNewAgent)) {
    return (
      <div className="agent-viewer">
        <div className="agent-viewer-error">
          <p>{error || "Agent not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-viewer">
      {!isEditing && agent ? (
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
                <span className="agent-viewer-model">Model: {getModelDisplayName(agent.model)}</span>
                <span className="agent-viewer-scope">
                  {agentScope === 'global' ? 'Global' : 'Project'}
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
      ) : isEditing ? (
        <div className="agent-viewer-edit">
          <div className="agent-viewer-edit-header">
            <h2>{isNewAgent ? 'Create New Agent' : 'Edit Agent Documentation'}</h2>
            <div className="agent-viewer-edit-actions">
              <button
                type="button"
                className="agent-viewer-button agent-viewer-cancel"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className="agent-viewer-button agent-viewer-save"
                onClick={handleSave}
                disabled={isSaving || (!hasChanges && !isNewAgent) || (isNewAgent && !editName.trim())}
              >
                {icons.save}
                <span>{isSaving ? "Saving..." : (isNewAgent ? "Create" : "Save")}</span>
              </button>
            </div>
          </div>

          {/* Edit Fields */}
          <div className="agent-viewer-edit-fields">
            {isNewAgent && (
              <>
                <div className="agent-viewer-field">
                  <label className="agent-viewer-label">Name:</label>
                  <input
                    type="text"
                    className="agent-viewer-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={isSaving}
                    placeholder="agent-name"
                  />
                </div>

                <div className="agent-viewer-field">
                  <label className="agent-viewer-label">Scope:</label>
                  <div className="agent-viewer-radio-group">
                    <label className="agent-viewer-radio-label">
                      <input
                        type="radio"
                        name="scope"
                        value="project"
                        checked={editScope === 'project'}
                        onChange={(e) => setEditScope(e.target.value as 'global' | 'project')}
                        disabled={isSaving}
                      />
                      <span>Project</span>
                    </label>
                    <label className="agent-viewer-radio-label">
                      <input
                        type="radio"
                        name="scope"
                        value="global"
                        checked={editScope === 'global'}
                        onChange={(e) => setEditScope(e.target.value as 'global' | 'project')}
                        disabled={isSaving}
                      />
                      <span>Global</span>
                    </label>
                  </div>
                </div>
              </>
            )}

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
                <option value="opus">opus</option>
                <option value="sonnet">sonnet</option>
                <option value="haiku">haiku (4.5)</option>
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

          {/* Code Editor Section */}
          <div className="agent-viewer-editor-section">
            <div className="agent-viewer-editor-header">
              <span className="agent-viewer-editor-label">Content (Markdown)</span>
            </div>
            <div className="agent-viewer-editor">
              <CodeEditorCodeMirror
                content={editContent}
                filename={`${isNewAgent ? editName || 'new-agent' : agent?.name || 'agent'}.md`}
                onChange={handleContentChange}
                language="markdown"
                readOnly={false}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
