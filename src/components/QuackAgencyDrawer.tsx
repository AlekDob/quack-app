import { useState, useEffect, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AgentInfo, AgentDetails } from "../types";
import QuackAgencySetupWizard from "./QuackAgencySetupWizard";
import MarkdownText from "./MarkdownText";
import CodeEditorCodeMirror from "./CodeEditorCodeMirror";
import RevealInFinderButton from "./RevealInFinderButton";

interface QuackAgencyDrawerProps {
  open: boolean;
  agents: AgentInfo[];
  selectedAgent: AgentDetails | null;
  loading: boolean;
  error: string | null;
  workingDir?: string;
  directoryExists: boolean;
  onClose: () => void;
  onSelectAgent: (agent: AgentInfo) => void;
  onRefresh: () => void;
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
  refresh: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-6-6 6 6 0 0 1 6-6V2l4 3-4 3V6a4 4 0 0 0-4 4 4 4 0 0 0 4 4 4 4 0 0 0 4-4h2Z"
        fill="currentColor"
      />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 6 6 10l4 4m4-4H6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  plus: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 4v12M4 10h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export default function QuackAgencyDrawer({
  open,
  agents,
  selectedAgent,
  loading,
  error,
  workingDir,
  directoryExists,
  onClose,
  onSelectAgent,
  onRefresh,
}: QuackAgencyDrawerProps) {
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track previous open state to detect drawer opening
  const prevOpenRef = useRef(open);

  // Edit form state (content, model, color, description)
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [editModel, setEditModel] = useState("");
  const [originalModel, setOriginalModel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [originalColor, setOriginalColor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");

  const handleAgentClick = (agent: AgentInfo) => {
    setIsAnimating(true);
    onSelectAgent(agent);

    // Small delay before showing detail view for animation
    setTimeout(() => {
      setViewMode("detail");
      setTimeout(() => setIsAnimating(false), 50);
    }, 150);

    setIsEditing(false);
  };

  const handleEdit = () => {
    if (!selectedAgent) return;

    // Populate edit form with current values
    setEditContent(selectedAgent.content);
    setOriginalContent(selectedAgent.content);
    setEditModel(selectedAgent.model);
    setOriginalModel(selectedAgent.model);
    setEditColor(selectedAgent.color);
    setOriginalColor(selectedAgent.color);
    setEditDescription(selectedAgent.description);
    setOriginalDescription(selectedAgent.description);
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
    if (!selectedAgent) return;

    setIsSaving(true);

    try {
      // Get the scope from the selected agent
      const scope = agents.find(a => a.name === selectedAgent.name)?.scope || "project";

      // Save content, model, color, and description
      await invoke("save_agent_content", {
        name: selectedAgent.name,
        content: editContent,
        model: editModel,
        color: editColor,
        description: editDescription,
        scope: scope,
        workingDir,
      });

      // Refresh agents list
      onRefresh();

      // Exit edit mode
      setIsEditing(false);
      setHasChanges(false);

      // Re-select the agent to refresh the view
      setTimeout(() => {
        const agentToSelect = agents.find(a => a.name === selectedAgent.name);
        if (agentToSelect) {
          onSelectAgent(agentToSelect);
        }
      }, 100);
    } catch (error) {
      console.error("Failed to save agent:", error);
      alert(`Failed to save agent: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the agent "${selectedAgent.name.replace(/-/g, " ")}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const scope = agents.find(a => a.name === selectedAgent.name)?.scope || "project";

      await invoke("delete_agent", {
        name: selectedAgent.name,
        scope: scope,
        workingDir,
      });

      // Refresh agents list
      onRefresh();

      // Return to list view
      setViewMode("list");
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to delete agent:", error);
      alert(`Failed to delete agent: ${error}`);
    }
  };

  const getAgentColor = (colorName: string): string => {
    return AGENT_COLORS[colorName.toLowerCase()] || "#6B7280";
  };

  // Auto-switch to detail view when drawer opens with a selected agent
  // (e.g., when clicking agent from AgentsPanel)
  useEffect(() => {
    const wasOpening = !prevOpenRef.current && open;

    if (wasOpening && selectedAgent) {
      setViewMode("detail");
    }

    prevOpenRef.current = open;
  }, [open, selectedAgent]);

  // Reset to list view when drawer closes
  useEffect(() => {
    if (!open) {
      setViewMode("list");
      setIsEditing(false);
    }
  }, [open]);

  return (
    <div className={`quack-agency-drawer ${open ? "open" : ""}`}>
      <div className="quack-agency-drawer-backdrop" onClick={onClose} />
      <div className="quack-agency-drawer-panel">
        <header className="quack-agency-drawer-header">
          <div className="quack-agency-header-content">
            <h2>Quack Agency</h2>
            {viewMode === "detail" && selectedAgent && !isEditing && (
              <div className="quack-agency-header-buttons">
                <button
                  type="button"
                  className="quack-agency-edit-header-button"
                  onClick={handleEdit}
                  title="Edit Agent"
                >
                  {icons.edit}
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  className="quack-agency-delete-header-button"
                  onClick={handleDelete}
                  title="Delete Agent"
                >
                  {icons.delete}
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="quack-agency-drawer-close"
            title="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="quack-agency-drawer-body">
          {loading && (
            <div className="quack-agency-loading">Loading agents...</div>
          )}

          {error && (
            <div className="quack-agency-error">
              <p>❌ Error loading agents:</p>
              <pre>{error}</pre>
            </div>
          )}

          {!loading && !error && viewMode === "list" && (
            <div className={`quack-agency-list-view ${isAnimating ? "animating" : ""}`}>
              {agents.length === 0 && !directoryExists && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="text-6xl mb-6">🦆</div>
                  <h3
                    className="text-2xl font-bold mb-4"
                    style={{ color: "#f28c52" }}
                  >
                    Setup Quack Agency
                  </h3>
                  <p
                    className="text-base mb-3 max-w-md"
                    style={{ color: "rgba(255, 255, 255, 0.7)" }}
                  >
                    Quack Agency helps you manage AI agents for this project.
                  </p>
                  <p
                    className="text-sm mb-8 max-w-md"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    Click the button below to create the{" "}
                    <code
                      className="px-2 py-1 rounded text-xs font-mono"
                      style={{
                        background: "rgba(242, 140, 82, 0.1)",
                        color: "#f28c52",
                      }}
                    >
                      .claude/agents/
                    </code>{" "}
                    directory structure.
                  </p>
                  <button
                    type="button"
                    className="px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200"
                    style={{
                      background: "linear-gradient(135deg, #f28c52 0%, #e67339 100%)",
                      color: "#ffffff",
                      boxShadow: "0 4px 12px rgba(242, 140, 82, 0.3)",
                    }}
                    onClick={() => setShowWizard(true)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(242, 140, 82, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(242, 140, 82, 0.3)";
                    }}
                  >
                    🚀 Setup Quack Agency
                  </button>
                </div>
              )}

              {agents.length === 0 && directoryExists && (
                <div className="quack-agency-empty">
                  <p>No agents found.</p>
                  <p>
                    Add agent files to the <code>.claude/agents/</code> directory.
                  </p>
                </div>
              )}

              {agents.length > 0 && (
                <div className="quack-agency-agents-list">
                  {agents.map((agent) => (
                    <article
                      key={agent.name}
                      className="agent-card"
                      onClick={() => handleAgentClick(agent)}
                    >
                      <img
                        src="/agent-setting.jpeg"
                        alt="Agent avatar"
                        className="agent-card-avatar"
                      />
                      <div className="agent-card-content">
                        <div className="agent-card-header">
                          <span
                            className="agent-card-badge"
                            style={{
                              backgroundColor: getAgentColor(agent.color),
                            }}
                          />
                          <div className="agent-card-title">
                            <strong>{agent.name.replace(/-/g, " ")}</strong>
                            <span className="agent-card-model">{agent.model}</span>
                          </div>
                        </div>
                        <p className="agent-card-description">
                          {agent.description.substring(0, 120)}
                          {agent.description.length > 120 ? "..." : ""}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !error && viewMode === "detail" && selectedAgent && (
            <div className={`quack-agency-detail ${isAnimating ? "animating" : ""}`}>
              {!isEditing ? (
                <>
                  <div className="agent-detail-header">
                    {/* Avatar small on the left */}
                    <img
                      src="/agent-setting.jpeg"
                      alt="Agent avatar"
                      className="agent-detail-avatar-small"
                    />

                    <div className="agent-detail-title">
                      <div className="agent-detail-title-row">
                        <span
                          className="agent-detail-badge"
                          style={{
                            backgroundColor: getAgentColor(selectedAgent.color),
                          }}
                        />
                        <h3>{selectedAgent.name.replace(/-/g, " ")}</h3>
                      </div>
                      <div className="agent-detail-meta">
                        <span className="agent-detail-model">
                          Model: {selectedAgent.model}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Unified Markdown Content */}
                  <div className="agent-detail-markdown-viewer">
                    <MarkdownText>
                      {selectedAgent.description
                        ? `**${selectedAgent.description}**\n\n${selectedAgent.content}`
                        : selectedAgent.content}
                    </MarkdownText>
                  </div>
                </>
              ) : (
                <div className="agent-edit-form">
                  <div className="agent-edit-header">
                    <h3>Edit Agent Documentation</h3>
                    <div className="agent-edit-actions">
                      <button
                        type="button"
                        className="agent-cancel-button"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        <span>Cancel</span>
                      </button>
                      {hasChanges && (
                        <button
                          type="button"
                          className="agent-save-button"
                          onClick={handleSave}
                          disabled={isSaving}
                        >
                          {icons.save}
                          <span>{isSaving ? "Saving..." : "Save"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description, Model and Color Selectors */}
                  <div className="agent-edit-fields">
                    <div className="agent-edit-field">
                      <label className="agent-edit-label">Description:</label>
                      <textarea
                        className="agent-description-input"
                        value={editDescription}
                        onChange={(e) => handleDescriptionChange(e.target.value)}
                        disabled={isSaving}
                        placeholder="Agent description..."
                        rows={3}
                      />
                    </div>

                    <div className="agent-edit-field">
                      <label className="agent-edit-label">Model:</label>
                      <select
                        className="agent-model-select"
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

                    <div className="agent-edit-field">
                      <label className="agent-edit-label">Color:</label>
                      <div className="agent-color-picker-container">
                        <div className="agent-color-swatches">
                          {Object.entries(AGENT_COLORS).map(([colorName, colorValue]) => (
                            <button
                              key={colorName}
                              type="button"
                              className={`agent-color-swatch ${editColor.toLowerCase() === colorName ? "selected" : ""}`}
                              style={{ backgroundColor: colorValue }}
                              onClick={() => handleColorChange(colorName)}
                              disabled={isSaving}
                              title={colorName}
                            />
                          ))}
                        </div>
                        <input
                          type="color"
                          className="agent-custom-color-picker"
                          value={AGENT_COLORS[editColor.toLowerCase()] || editColor}
                          onChange={(e) => handleColorChange(e.target.value)}
                          disabled={isSaving}
                          title="Custom color"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="agent-markdown-editor">
                    <CodeEditorCodeMirror
                      content={editContent}
                      filename={`${selectedAgent.name}.md`}
                      onChange={handleContentChange}
                      language="markdown"
                      readOnly={false}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="quack-agency-drawer-footer">
          <div className="quack-agency-drawer-stats">
            {viewMode === "detail" && selectedAgent ? (
              <>
                <span>{selectedAgent.file_path}</span>
                <RevealInFinderButton path={selectedAgent.file_path} iconOnly />
              </>
            ) : (
              <span>{agents.length} {agents.length === 1 ? "agent" : "agents"} active</span>
            )}
          </div>
          <button type="button" onClick={onRefresh} disabled={loading}>
            {icons.refresh}
            <span>Refresh</span>
          </button>
        </footer>
      </div>

      {/* Setup Wizard */}
      <QuackAgencySetupWizard
        open={showWizard}
        workingDir={workingDir}
        onClose={() => setShowWizard(false)}
        onComplete={() => {
          setShowWizard(false);
          // Refresh agents after setup completes
          onRefresh();
        }}
      />
    </div>
  );
}
