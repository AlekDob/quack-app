import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import MarkdownText from "./MarkdownText";
import CodeEditorCodeMirror from "./CodeEditorCodeMirror";
import RevealInFinderButton from "./RevealInFinderButton";
import "./CommandViewer.css";

interface CommandViewerProps {
  commandName: string;
  commandScope: 'global' | 'project';
  workingDir?: string;
  onRefresh?: () => void;
  isNewCommand?: boolean; // If true, start in edit mode for creating new command
}

interface CommandDetails {
  name: string;
  description: string;
  content: string;
  parameters?: string[];
  file_path: string;
  scope: 'global' | 'project';
}

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
  terminal: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <text
        x="10"
        y="14"
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="600"
        fontFamily="monospace"
      >
        /
      </text>
    </svg>
  ),
};

export default function CommandViewer({
  commandName,
  commandScope,
  workingDir,
  onRefresh,
  isNewCommand = false,
}: CommandViewerProps) {
  const [command, setCommand] = useState<CommandDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNewCommand);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(commandName);
  const [originalName, setOriginalName] = useState(commandName);
  const [editDescription, setEditDescription] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [editParameters, setEditParameters] = useState("");
  const [originalParameters, setOriginalParameters] = useState("");
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [editScope, setEditScope] = useState<'global' | 'project'>(commandScope);
  const [originalScope, setOriginalScope] = useState<'global' | 'project'>(commandScope);

  // Load command details (skip if creating new command)
  useEffect(() => {
    if (isNewCommand) {
      // For new commands, initialize with empty state
      setCommand({
        name: "",
        description: "",
        content: "",
        parameters: [],
        file_path: "",
        scope: commandScope,
      });
      // Initialize edit form states for new command
      setEditName("");
      setEditDescription("");
      setEditParameters("");
      setEditContent("");
      setEditScope(commandScope);
      setHasChanges(true); // Enable save button for new commands
      setLoading(false);
      return;
    }

    const loadCommand = async () => {
      setLoading(true);
      setError(null);

      try {
        const details = await invoke<CommandDetails>("get_command_details", {
          name: commandName,
          workingDir,
          scope: commandScope,
        });

        setCommand(details);
      } catch (err) {
        console.error("Failed to load command details:", err);
        setError(`Failed to load command: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    void loadCommand();
  }, [commandName, commandScope, workingDir, isNewCommand]);

  const handleEdit = () => {
    if (!command) return;

    const parametersStr = command.parameters ? command.parameters.join(", ") : "";
    setEditName(command.name);
    setOriginalName(command.name);
    setEditDescription(command.description);
    setOriginalDescription(command.description);
    setEditParameters(parametersStr);
    setOriginalParameters(parametersStr);
    setEditContent(command.content);
    setOriginalContent(command.content);
    setEditScope(command.scope);
    setOriginalScope(command.scope);
    setHasChanges(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isNewCommand) {
      // Close the tab if creating new command and user cancels
      if (onRefresh) {
        onRefresh();
      }
    }
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent);
    setHasChanges(
      newContent !== originalContent ||
      editName !== originalName ||
      editDescription !== originalDescription ||
      editParameters !== originalParameters ||
      editScope !== originalScope
    );
  };

  const handleNameChange = (newName: string) => {
    setEditName(newName);
    setHasChanges(
      editContent !== originalContent ||
      newName !== originalName ||
      editDescription !== originalDescription ||
      editParameters !== originalParameters ||
      editScope !== originalScope
    );
  };

  const handleDescriptionChange = (newDescription: string) => {
    setEditDescription(newDescription);
    setHasChanges(
      editContent !== originalContent ||
      editName !== originalName ||
      newDescription !== originalDescription ||
      editParameters !== originalParameters ||
      editScope !== originalScope
    );
  };

  const handleParametersChange = (newParameters: string) => {
    setEditParameters(newParameters);
    setHasChanges(
      editContent !== originalContent ||
      editName !== originalName ||
      editDescription !== originalDescription ||
      newParameters !== originalParameters ||
      editScope !== originalScope
    );
  };

  const handleScopeChange = (newScope: 'global' | 'project') => {
    setEditScope(newScope);
    setHasChanges(
      editContent !== originalContent ||
      editName !== originalName ||
      editDescription !== originalDescription ||
      editParameters !== originalParameters ||
      newScope !== originalScope
    );
  };

  const handleSave = async () => {
    if (!command && !isNewCommand) return;

    setIsSaving(true);

    try {
      // Parse parameters (comma-separated)
      const parametersArray = editParameters
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      await invoke("save_command_content", {
        name: editName,
        content: editContent,
        description: editDescription,
        parameters: parametersArray,
        scope: editScope,
        workingDir,
      });

      // Refresh command details
      const updatedDetails = await invoke<CommandDetails>("get_command_details", {
        name: editName,
        workingDir,
        scope: editScope,
      });

      setCommand(updatedDetails);
      setIsEditing(false);
      setHasChanges(false);

      // Notify parent to refresh commands list
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to save command:", error);
      alert(`Failed to save command: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!command) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the command "/${command.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await invoke("delete_slash_command", {
        basePath: workingDir || "",
        name: command.name,
        scope: commandScope,
      });

      // Notify parent to refresh and close tab
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to delete command:", error);
      alert(`Failed to delete command: ${error}`);
    }
  };

  if (loading) {
    return (
      <div className="command-viewer">
        <div className="command-viewer-loading">Loading command details...</div>
      </div>
    );
  }

  if (error || !command) {
    return (
      <div className="command-viewer">
        <div className="command-viewer-error">
          <p>{error || "Command not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="command-viewer">
      {!isEditing ? (
        <>
          {/* Header with terminal icon and metadata */}
          <div className="command-viewer-header">
            <div className="command-viewer-icon-section">
              <div className="command-viewer-icon">{icons.terminal}</div>
            </div>

            <div className="command-viewer-info">
              <div className="command-viewer-title-row">
                <h1 className="command-viewer-title">/{command.name}</h1>
              </div>

              <div className="command-viewer-meta">
                {command.description && (
                  <span className="command-viewer-description">{command.description}</span>
                )}
                <span className="command-viewer-scope">
                  {commandScope === 'global' ? 'Global' : 'Project'}
                </span>
              </div>

              {command.parameters && command.parameters.length > 0 && (
                <div className="command-viewer-parameters">
                  <span className="command-viewer-parameters-label">Parameters:</span>
                  {command.parameters.map((param, idx) => (
                    <span key={idx} className="command-viewer-parameter-tag">
                      {param}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="command-viewer-actions">
              <button
                type="button"
                className="command-viewer-icon-button command-viewer-edit"
                onClick={handleEdit}
                title="Edit Command"
                aria-label="Edit Command"
              >
                {icons.edit}
              </button>
              <button
                type="button"
                className="command-viewer-icon-button command-viewer-delete"
                onClick={handleDelete}
                title="Delete Command"
                aria-label="Delete Command"
              >
                {icons.delete}
              </button>
            </div>
          </div>

          {/* Markdown Content */}
          <div className="command-viewer-content">
            <MarkdownText>{command.content}</MarkdownText>
          </div>

          {/* Footer with file path */}
          {command.file_path && (
            <div className="command-viewer-footer">
              <span className="command-viewer-path">{command.file_path}</span>
              <RevealInFinderButton path={command.file_path} iconOnly />
            </div>
          )}
        </>
      ) : (
        <div className="command-viewer-edit">
          <div className="command-viewer-edit-header">
            <h2>{isNewCommand ? 'Create New Command' : 'Edit Command'}</h2>
            <div className="command-viewer-edit-actions">
              <button
                type="button"
                className="command-viewer-button command-viewer-cancel"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className="command-viewer-button command-viewer-save"
                onClick={handleSave}
                disabled={isSaving || (!hasChanges && !isNewCommand) || (isNewCommand && !editName.trim())}
              >
                {icons.save}
                <span>{isSaving ? "Saving..." : (isNewCommand ? "Create" : "Save")}</span>
              </button>
            </div>
          </div>

          {/* Edit Fields */}
          <div className="command-viewer-edit-fields">
            <div className="command-viewer-field">
              <label className="command-viewer-label">Name:</label>
              <input
                type="text"
                className="command-viewer-input"
                value={editName}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={!isNewCommand || isSaving}
                placeholder="command-name"
              />
            </div>

            <div className="command-viewer-field">
              <label className="command-viewer-label">Description:</label>
              <textarea
                className="command-viewer-textarea"
                value={editDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={isSaving}
                placeholder="Brief description of what this command does..."
                rows={2}
              />
            </div>

            <div className="command-viewer-field">
              <label className="command-viewer-label">Parameters (comma-separated):</label>
              <input
                type="text"
                className="command-viewer-input"
                value={editParameters}
                onChange={(e) => handleParametersChange(e.target.value)}
                disabled={isSaving}
                placeholder="param1, param2, param3"
              />
            </div>

            {isNewCommand && (
              <div className="command-viewer-field">
                <label className="command-viewer-label">Scope:</label>
                <div className="command-viewer-scope-picker">
                  <label className="command-viewer-radio-label">
                    <input
                      type="radio"
                      name="scope"
                      value="project"
                      checked={editScope === 'project'}
                      onChange={() => handleScopeChange('project')}
                      disabled={isSaving}
                    />
                    <span>Project</span>
                  </label>
                  <label className="command-viewer-radio-label">
                    <input
                      type="radio"
                      name="scope"
                      value="global"
                      checked={editScope === 'global'}
                      onChange={() => handleScopeChange('global')}
                      disabled={isSaving}
                    />
                    <span>Global</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Code Editor Section */}
          <div className="command-viewer-editor-section">
            <div className="command-viewer-editor-header">
              <span className="command-viewer-editor-label">Content (Markdown)</span>
            </div>
            <div className="command-viewer-editor">
              <CodeEditorCodeMirror
                content={editContent}
                filename={`${editName}.md`}
                onChange={handleContentChange}
                language="markdown"
                readOnly={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
