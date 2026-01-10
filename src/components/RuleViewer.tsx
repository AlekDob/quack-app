import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Rule } from "../types";
import MarkdownText from "./MarkdownText";
import CodeEditorCodeMirror from "./CodeEditorCodeMirror";
import RevealInFinderButton from "./RevealInFinderButton";
import "./RuleViewer.css";

interface RuleViewerProps {
  ruleName: string;
  ruleScope: 'global' | 'project';
  workingDir?: string;
  onRefresh?: () => void;
  isNewRule?: boolean; // If true, start in edit mode for creating new rule
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
  document: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5 3h7l3 3v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3v3h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export default function RuleViewer({
  ruleName,
  ruleScope,
  workingDir,
  onRefresh,
  isNewRule = false,
}: RuleViewerProps) {
  const [rule, setRule] = useState<Rule | null>(null);
  const [loading, setLoading] = useState(!isNewRule);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNewRule);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(ruleName);
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [editGlobs, setEditGlobs] = useState("");
  const [originalGlobs, setOriginalGlobs] = useState("");
  const [editScope, setEditScope] = useState<'global' | 'project'>(ruleScope);

  // Load rule details
  useEffect(() => {
    if (isNewRule) {
      // Initialize empty rule for creation mode
      setRule({
        id: `new-${Date.now()}`,
        name: "",
        content: "",
        filePath: "",
        scope: ruleScope,
        frontmatter: {
          description: "",
          globs: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Initialize edit form states for new rule
      setEditName("");
      setEditContent("");
      setEditDescription("");
      setEditGlobs("");
      setEditScope(ruleScope);
      setHasChanges(true); // Enable save button for new rules
      setLoading(false);
      return;
    }

    const loadRule = async () => {
      setLoading(true);
      setError(null);

      try {
        const details = await invoke<Rule>("get_rule_details", {
          name: ruleName,
          workingDir,
          scope: ruleScope,
        });

        setRule(details);
      } catch (err) {
        console.error("Failed to load rule details:", err);
        setError(`Failed to load rule: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    void loadRule();
  }, [ruleName, ruleScope, workingDir, isNewRule]);

  const handleEdit = () => {
    if (!rule) return;

    setEditContent(rule.content);
    setOriginalContent(rule.content);
    setEditDescription(rule.frontmatter?.description || "");
    setOriginalDescription(rule.frontmatter?.description || "");
    setEditGlobs(rule.frontmatter?.globs?.join(", ") || "");
    setOriginalGlobs(rule.frontmatter?.globs?.join(", ") || "");
    setHasChanges(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isNewRule) {
      // Close the tab or trigger refresh for new rules
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
      editDescription !== originalDescription ||
      editGlobs !== originalGlobs
    );
  };

  const handleDescriptionChange = (newDescription: string) => {
    setEditDescription(newDescription);
    setHasChanges(
      editContent !== originalContent ||
      newDescription !== originalDescription ||
      editGlobs !== originalGlobs
    );
  };

  const handleGlobsChange = (newGlobs: string) => {
    setEditGlobs(newGlobs);
    setHasChanges(
      editContent !== originalContent ||
      editDescription !== originalDescription ||
      newGlobs !== originalGlobs
    );
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Parse globs from comma-separated string
      const globsArray = editGlobs
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      await invoke("save_rule_content", {
        name: isNewRule ? editName : rule!.name,
        content: editContent,
        description: editDescription || undefined,
        globs: globsArray.length > 0 ? globsArray : undefined,
        scope: editScope,
        workingDir,
      });

      if (isNewRule) {
        // For new rules, refresh the list and close edit mode
        setIsEditing(false);
        if (onRefresh) {
          onRefresh();
        }
      } else {
        // Refresh rule details
        const updatedDetails = await invoke<Rule>("get_rule_details", {
          name: ruleName,
          workingDir,
          scope: ruleScope,
        });

        setRule(updatedDetails);
        setIsEditing(false);
        setHasChanges(false);

        // Notify parent to refresh rules list
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error) {
      console.error("Failed to save rule:", error);
      alert(`Failed to save rule: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!rule) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the rule "${rule.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await invoke("delete_rule", {
        name: rule.name,
        scope: ruleScope,
        workingDir,
      });

      // Notify parent to refresh and close tab
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to delete rule:", error);
      alert(`Failed to delete rule: ${error}`);
    }
  };

  if (loading) {
    return (
      <div className="rule-viewer">
        <div className="rule-viewer-loading">Loading rule details...</div>
      </div>
    );
  }

  if (error || (!rule && !isNewRule)) {
    return (
      <div className="rule-viewer">
        <div className="rule-viewer-error">
          <p>{error || "Rule not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rule-viewer">
      {!isEditing ? (
        <>
          {/* Header with metadata */}
          <div className="rule-viewer-header">
            <div className="rule-viewer-icon-section">
              <div className="rule-viewer-icon">{icons.document}</div>
            </div>

            <div className="rule-viewer-info">
              <div className="rule-viewer-title-row">
                <h1 className="rule-viewer-title">{rule!.name}</h1>
              </div>

              <div className="rule-viewer-meta">
                <span className="rule-viewer-scope">
                  {ruleScope === 'global' ? 'Global' : 'Project'}
                </span>
                {rule!.frontmatter?.description && (
                  <span className="rule-viewer-description">
                    {rule!.frontmatter.description}
                  </span>
                )}
              </div>

              {/* Display globs as tags */}
              {rule!.frontmatter?.globs && rule!.frontmatter.globs.length > 0 && (
                <div className="rule-viewer-globs">
                  {rule!.frontmatter.globs.map((glob, index) => (
                    <span key={index} className="rule-viewer-glob-tag">
                      {glob}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rule-viewer-actions">
              <button
                type="button"
                className="rule-viewer-icon-button rule-viewer-edit"
                onClick={handleEdit}
                title="Edit Rule"
                aria-label="Edit Rule"
              >
                {icons.edit}
              </button>
              <button
                type="button"
                className="rule-viewer-icon-button rule-viewer-delete"
                onClick={handleDelete}
                title="Delete Rule"
                aria-label="Delete Rule"
              >
                {icons.delete}
              </button>
            </div>
          </div>

          {/* Markdown Content */}
          <div className="rule-viewer-content">
            <MarkdownText>{rule!.content}</MarkdownText>
          </div>

          {/* Footer with file path */}
          <div className="rule-viewer-footer">
            <span className="rule-viewer-path">{rule!.filePath}</span>
            <RevealInFinderButton path={rule!.filePath} iconOnly />
          </div>
        </>
      ) : (
        <div className="rule-viewer-edit">
          <div className="rule-viewer-edit-header">
            <h2>{isNewRule ? "Create New Rule" : "Edit Rule"}</h2>
            <div className="rule-viewer-edit-actions">
              <button
                type="button"
                className="rule-viewer-button rule-viewer-cancel"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className="rule-viewer-button rule-viewer-save"
                onClick={handleSave}
                disabled={isSaving || (!hasChanges && !isNewRule) || (isNewRule && !editName.trim())}
              >
                {icons.save}
                <span>{isSaving ? "Saving..." : (isNewRule ? "Create" : "Save")}</span>
              </button>
            </div>
          </div>

          {/* Edit Fields */}
          <div className="rule-viewer-edit-fields">
            {isNewRule && (
              <>
                <div className="rule-viewer-field">
                  <label className="rule-viewer-label">Name:</label>
                  <input
                    type="text"
                    className="rule-viewer-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={isSaving}
                    placeholder="rule-name"
                  />
                </div>

                <div className="rule-viewer-field">
                  <label className="rule-viewer-label">Scope:</label>
                  <div className="rule-viewer-radio-group">
                    <label className="rule-viewer-radio-label">
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
                    <label className="rule-viewer-radio-label">
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

            <div className="rule-viewer-field">
              <label className="rule-viewer-label">Description (optional):</label>
              <input
                type="text"
                className="rule-viewer-input"
                value={editDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={isSaving}
                placeholder="Brief description of this rule"
              />
            </div>

            <div className="rule-viewer-field">
              <label className="rule-viewer-label">File Patterns (optional):</label>
              <input
                type="text"
                className="rule-viewer-input"
                value={editGlobs}
                onChange={(e) => handleGlobsChange(e.target.value)}
                disabled={isSaving}
                placeholder="src/**/*.ts, src/**/*.tsx"
              />
              <span className="rule-viewer-field-hint">
                Comma-separated glob patterns to scope this rule to specific files
              </span>
            </div>
          </div>

          {/* Code Editor Section */}
          <div className="rule-viewer-editor-section">
            <div className="rule-viewer-editor-header">
              <span className="rule-viewer-editor-label">Content (Markdown)</span>
            </div>
            <div className="rule-viewer-editor">
              <CodeEditorCodeMirror
                content={editContent}
                filename={`${isNewRule ? editName : rule!.name}.md`}
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
