import { useState, useEffect, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AgentInfo, AgentDetails } from "../types";
import QuackAgencySetupWizard from "./QuackAgencySetupWizard";

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

  // Track previous open state to detect drawer opening
  const prevOpenRef = useRef(open);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editContent, setEditContent] = useState("");

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

  const handleBackToList = () => {
    setIsAnimating(true);

    setTimeout(() => {
      setViewMode("list");
      setIsEditing(false);
      setIsAnimating(false);
    }, 200);
  };

  const handleEdit = () => {
    if (!selectedAgent) return;

    // Populate edit fields with current values
    setEditName(selectedAgent.name);
    setEditDescription(selectedAgent.description);
    setEditModel(selectedAgent.model);
    setEditColor(selectedAgent.color);
    setEditContent(selectedAgent.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!selectedAgent) return;

    setIsSaving(true);

    try {
      await invoke("save_agent", {
        originalName: selectedAgent.name,
        name: editName,
        description: editDescription,
        model: editModel,
        color: editColor,
        content: editContent,
        workingDir,
      });

      // Refresh agents list
      onRefresh();

      // Update selected agent
      const updatedAgent: AgentDetails = {
        name: editName,
        description: editDescription,
        model: editModel,
        color: editColor,
        scope: selectedAgent.scope,
        file_path: selectedAgent.file_path,
        content: editContent,
      };

      // Exit edit mode
      setIsEditing(false);

      // If name changed, re-select the agent
      if (editName !== selectedAgent.name) {
        setTimeout(() => {
          onSelectAgent(updatedAgent);
        }, 100);
      }
    } catch (error) {
      console.error("Failed to save agent:", error);
      alert(`Failed to save agent: ${error}`);
    } finally {
      setIsSaving(false);
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
              <button
                type="button"
                className="quack-agency-edit-header-button"
                onClick={handleEdit}
                title="Edit Agent"
              >
                {icons.edit}
                <span>Edit</span>
              </button>
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
              <button
                type="button"
                className="quack-agency-back-button"
                onClick={handleBackToList}
              >
                {icons.back}
                <span>Back to list</span>
              </button>

              {!isEditing ? (
                <>
                  <div className="agent-detail-header">
                    <div className="agent-detail-title">
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

                  <div className="agent-detail-description">
                    <strong>Description:</strong>
                    <p>{selectedAgent.description}</p>
                  </div>

                  <div className="agent-detail-content">
                    <strong>Full Documentation:</strong>
                    <div className="agent-detail-markdown">
                      {selectedAgent.content.split("\n").map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="agent-edit-form">
                  <h3>Edit Agent</h3>

                  <div className="agent-form-field">
                    <label htmlFor="agent-name">Name</label>
                    <input
                      id="agent-name"
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Agent name"
                    />
                  </div>

                  <div className="agent-form-field">
                    <label htmlFor="agent-description">Description</label>
                    <textarea
                      id="agent-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Agent description"
                      rows={3}
                    />
                  </div>

                  <div className="agent-form-field">
                    <label htmlFor="agent-model">Model</label>
                    <input
                      id="agent-model"
                      type="text"
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      placeholder="e.g., claude-sonnet-4-5-20250929"
                    />
                  </div>

                  <div className="agent-form-field">
                    <label htmlFor="agent-color">Color</label>
                    <div className="agent-color-selector">
                      {Object.keys(AGENT_COLORS).map((colorName) => (
                        <button
                          key={colorName}
                          type="button"
                          className={`agent-color-option ${editColor === colorName ? "selected" : ""}`}
                          style={{ backgroundColor: AGENT_COLORS[colorName] }}
                          onClick={() => setEditColor(colorName)}
                          title={colorName}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="agent-form-field">
                    <label htmlFor="agent-content">Full Documentation</label>
                    <textarea
                      id="agent-content"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Agent documentation content"
                      rows={12}
                    />
                  </div>

                  <div className="agent-form-actions">
                    <button
                      type="button"
                      className="agent-cancel-button"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <span>Cancel</span>
                    </button>
                    <button
                      type="button"
                      className="agent-save-button"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {icons.save}
                      <span>{isSaving ? "Saving..." : "Save Agent"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="quack-agency-drawer-footer">
          <div className="quack-agency-drawer-stats">
            {agents.length} {agents.length === 1 ? "agent" : "agents"} active
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
