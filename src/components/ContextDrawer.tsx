import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import MarkdownText from "./MarkdownText";
import CodeEditorCodeMirror from "./CodeEditorCodeMirror";
import RevealInFinderButton from "./RevealInFinderButton";

interface ContextDrawerProps {
  open: boolean;
  scope: string | null; // "global" or "project"
  workingDir?: string;
  onClose: () => void;
}

interface ContextDetails {
  content: string;
  scope: string;
  file_path: string;
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
  globe: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v20M2 12h20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  folder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export default function ContextDrawer({
  open,
  scope,
  workingDir,
  onClose,
}: ContextDrawerProps) {
  const [contextDetails, setContextDetails] = useState<ContextDetails | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Edit form state
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");

  // Load CLAUDE.md when drawer opens or scope changes
  useEffect(() => {
    if (open && scope) {
      void loadContext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setHasChanges(false);
      setContextDetails(null);
      setError(null);
    }
  }, [open]);

  const loadContext = async () => {
    if (!scope) return;

    setLoading(true);
    setError(null);

    try {
      const details = await invoke<ContextDetails>("get_claude_md_details", {
        scope,
        workingDir,
      });
      setContextDetails(details);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (!contextDetails) return;

    setEditContent(contextDetails.content);
    setOriginalContent(contextDetails.content);
    setHasChanges(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent);
    setHasChanges(newContent !== originalContent);
  };

  const handleSave = async () => {
    if (!contextDetails) return;

    setIsSaving(true);

    try {
      await invoke("save_claude_md_content", {
        content: editContent,
        scope: contextDetails.scope,
        workingDir,
      });

      // Reload context
      await loadContext();

      // Exit edit mode
      setIsEditing(false);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save CLAUDE.md:", err);
      alert(`Failed to save CLAUDE.md: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getScopeIcon = () => {
    return scope === "global" ? icons.globe : icons.folder;
  };

  const getScopeName = () => {
    return scope === "global" ? "Global Context" : "Project Context";
  };

  return (
    <div className={`quack-agency-drawer ${open ? "open" : ""}`}>
      <div className="quack-agency-drawer-backdrop" onClick={onClose} />
      <div className="quack-agency-drawer-panel">
        <header className="quack-agency-drawer-header">
          <div className="quack-agency-header-content">
            <div className="flex items-center gap-2">
              {getScopeIcon()}
              <h2>{getScopeName()}</h2>
            </div>
            {contextDetails && !isEditing && (
              <div className="quack-agency-header-buttons">
                <button
                  type="button"
                  className="quack-agency-edit-header-button"
                  onClick={handleEdit}
                  title="Edit CLAUDE.md"
                >
                  {icons.edit}
                  <span>Edit</span>
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
            <div className="quack-agency-loading">Loading CLAUDE.md...</div>
          )}

          {error && (
            <div className="quack-agency-error">
              <p>❌ Error loading CLAUDE.md:</p>
              <pre>{error}</pre>
            </div>
          )}

          {!loading && !error && contextDetails && (
            <div className="quack-agency-detail">
              {!isEditing ? (
                <>
                  <div className="agent-detail-header">
                    <div className="agent-detail-title">
                      <div className="agent-detail-title-row">
                        <h3>CLAUDE.md</h3>
                      </div>
                      <div className="agent-detail-meta">
                        <span
                          className="text-xs"
                          style={{ color: "rgba(255, 255, 255, 0.5)" }}
                        >
                          {scope === "global"
                            ? "Global context for all projects"
                            : "Project-specific context"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Markdown Content Viewer */}
                  <div className="agent-detail-markdown-viewer">
                    <MarkdownText>{contextDetails.content}</MarkdownText>
                  </div>
                </>
              ) : (
                <div className="agent-edit-form">
                  <div className="agent-edit-header">
                    <h3>Edit CLAUDE.md</h3>
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

                  <div className="agent-markdown-editor">
                    <CodeEditorCodeMirror
                      content={editContent}
                      filename="CLAUDE.md"
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
            {scope === "global" ? "~/.claude/CLAUDE.md" : ".claude/CLAUDE.md"}
          </div>
          {contextDetails && (
            <RevealInFinderButton
              path={contextDetails.file_path}
              iconOnly
            />
          )}
        </footer>
      </div>
    </div>
  );
}
