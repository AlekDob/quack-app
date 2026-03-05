import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ContextFile {
  name: string;
  scope: string;
  exists: boolean;
}

interface ContextPanelProps {
  tauriAvailable: boolean;
  onOpenContextDrawer: (scope: string) => void;
  projectName?: string;
  gitBranch?: string;
}

export default function ContextPanel({
  tauriAvailable,
  onOpenContextDrawer,
  projectName,
  gitBranch,
}: ContextPanelProps) {
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalCollapsed, setGlobalCollapsed] = useState(false);
  const [projectCollapsed, setProjectCollapsed] = useState(false);

  useEffect(() => {
    void loadContextFiles();
  }, [tauriAvailable]);

  const loadContextFiles = async () => {
    if (!tauriAvailable) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const files = await invoke<ContextFile[]>("list_claude_md_files", {
        workingDir: null,
      });
      setContextFiles(files);
    } catch (error) {
      console.error("Failed to load CLAUDE.md files:", error);
      setContextFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleContextClick = (scope: string) => {
    onOpenContextDrawer(scope);
  };

  if (!tauriAvailable) {
    return (
      <div className="context-panel">
        <div className="text-6xl mb-6">📝</div>
        <h3 className="text-xl font-bold mb-3" style={{ color: "#f28c52" }}>
          Context Panel
        </h3>
        <p
          className="text-base mb-2 max-w-md"
          style={{ color: "rgba(255, 255, 255, 0.7)" }}
        >
          Available only in Tauri environment
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="context-panel">
        <div className="text-sm" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
          Loading context files...
        </div>
      </div>
    );
  }

  const globalFiles = contextFiles.filter((f) => f.scope === "global");
  const projectFiles = contextFiles.filter((f) => f.scope === "project");

  return (
    <div className="context-panel">
      {/* Current Project Info */}
      {(projectName || gitBranch) && (
        <div className="context-section" style={{ marginBottom: '16px' }}>
          <div className="context-section-header" style={{ cursor: 'default' }}>
            <div className="context-section-title">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                style={{ opacity: 0.6 }}
              >
                <path
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Current Workspace</span>
            </div>
          </div>
          <div className="context-list">
            {projectName && (
              <div
                className="context-item"
                style={{ cursor: 'default', padding: '8px 12px' }}
              >
                <div className="context-item-icon">📁</div>
                <div className="context-item-content">
                  <div className="context-item-name" style={{ fontSize: '0.9em' }}>
                    {projectName}
                  </div>
                </div>
              </div>
            )}
            {gitBranch && (
              <div
                className="context-item"
                style={{ cursor: 'default', padding: '8px 12px' }}
              >
                <div className="context-item-icon">🌿</div>
                <div className="context-item-content">
                  <div
                    className="context-item-name"
                    style={{
                      fontSize: '0.85em',
                      fontFamily: 'monospace',
                      color: '#4ecdc4',
                    }}
                  >
                    {gitBranch}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Context Section */}
      {globalFiles.length > 0 && (
        <div className="context-section">
          <div
            className="context-section-header"
            onClick={() => setGlobalCollapsed(!globalCollapsed)}
          >
            <div className="context-section-title">
              <svg
                className="context-section-arrow"
                style={{
                  transform: globalCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                }}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                style={{ opacity: 0.6 }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 6v12M6 12h12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>Global Context</span>
              <span className="context-count-badge">{globalFiles.length}</span>
            </div>
          </div>

          {!globalCollapsed && (
            <div className="context-list">
              {globalFiles.map((file) => (
                <div
                  key={`${file.scope}-${file.name}`}
                  className="context-item"
                  onClick={() => handleContextClick(file.scope)}
                  style={{
                    opacity: file.exists ? 1 : 0.5,
                    cursor: file.exists ? "pointer" : "not-allowed",
                  }}
                >
                  <div className="context-item-icon">📝</div>
                  <div className="context-item-content">
                    <div className="context-item-name">{file.name}</div>
                    {!file.exists && (
                      <div
                        className="text-xs"
                        style={{ color: "rgba(255, 255, 255, 0.4)" }}
                      >
                        File not found
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Project Context Section */}
      {projectFiles.length > 0 && (
        <div className="context-section">
          <div
            className="context-section-header"
            onClick={() => setProjectCollapsed(!projectCollapsed)}
          >
            <div className="context-section-title">
              <svg
                className="context-section-arrow"
                style={{
                  transform: projectCollapsed
                    ? "rotate(-90deg)"
                    : "rotate(0deg)",
                }}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                style={{ opacity: 0.6 }}
              >
                <path
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Project Context</span>
              <span className="context-count-badge">{projectFiles.length}</span>
            </div>
          </div>

          {!projectCollapsed && (
            <div className="context-list">
              {projectFiles.map((file) => (
                <div
                  key={`${file.scope}-${file.name}`}
                  className="context-item"
                  onClick={() =>
                    file.exists ? handleContextClick(file.scope) : undefined
                  }
                  style={{
                    opacity: file.exists ? 1 : 0.5,
                    cursor: file.exists ? "pointer" : "not-allowed",
                  }}
                >
                  <div className="context-item-icon">📝</div>
                  <div className="context-item-content">
                    <div className="context-item-name">{file.name}</div>
                    {!file.exists && (
                      <div
                        className="text-xs"
                        style={{ color: "rgba(255, 255, 255, 0.4)" }}
                      >
                        File not found
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {contextFiles.length === 0 && (
        <div
          className="text-sm text-center mt-8"
          style={{ color: "rgba(255, 255, 255, 0.5)" }}
        >
          No CLAUDE.md files found
        </div>
      )}
    </div>
  );
}
