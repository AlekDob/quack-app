import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import AgentPersonalityCard from './AgentPersonalityCard';
import type { AgentPersonality, DirectoryEntry } from '../types';
import './AgentContextPanel.css';

interface ContextFile {
  name: string;
  path: string;
  scope: string;
  exists: boolean;
}

interface AgentContextPanelProps {
  tauriAvailable: boolean;
  activeAgentId?: string | null;
  activeAgentName?: string | null;
  activeAgentAvatar?: string | null;
  activeAgentWorkingOn?: string | null;
  activeAgentCwd?: string | null;
  onOpenFile?: (entry: DirectoryEntry) => void;
  onOpenContextDrawer?: (scope: string) => void;
}

export default function AgentContextPanel({
  tauriAvailable,
  activeAgentId,
  activeAgentName,
  activeAgentAvatar,
  activeAgentWorkingOn,
  activeAgentCwd,
  onOpenFile,
  onOpenContextDrawer,
}: AgentContextPanelProps) {
  const [personality, setPersonality] = useState<AgentPersonality | null>(null);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalityCollapsed, setPersonalityCollapsed] = useState(false);
  const [globalCollapsed, setGlobalCollapsed] = useState(false);
  const [projectCollapsed, setProjectCollapsed] = useState(false);

  useEffect(() => {
    void loadAgentContext();
  }, [tauriAvailable, activeAgentId]);

  const loadAgentContext = async () => {
    if (!tauriAvailable) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load personality if we have an active agent
      if (activeAgentId && activeAgentCwd) {
        try {
          // Use the agent ID directly (it's the terminal ID) and the working directory
          const loadedPersonality = await invoke<AgentPersonality>(
            'load_agent_personality',
            {
              projectPath: activeAgentCwd,
              personalityId: activeAgentId,
            }
          );
          console.log('Loaded personality:', loadedPersonality);
          setPersonality(loadedPersonality);
        } catch (error) {
          console.error('Failed to load personality:', error);
          setPersonality(null);
        }
      } else {
        setPersonality(null);
      }

      // Load CLAUDE.md files (global and project)
      try {
        const files = await invoke<ContextFile[]>('list_claude_md_files', {
          workingDir: activeAgentCwd || null,
        });
        console.log('Loaded CLAUDE.md files:', files);
        setContextFiles(files);
      } catch (error) {
        console.error('Failed to load CLAUDE.md files:', error);
        setContextFiles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (file: ContextFile) => {
    if (!file.exists) return;

    // For CLAUDE.md files, we need to get the actual path from the backend
    try {
      const details = await invoke<{ content: string; scope: string; file_path: string }>(
        'get_claude_md_details',
        {
          scope: file.scope,
          workingDir: activeAgentCwd || null,
        }
      );

      // Open the file as a tab
      if (onOpenFile && details.file_path) {
        const entry: DirectoryEntry = {
          name: 'CLAUDE.md',
          path: details.file_path,
          is_dir: false,
          is_symlink: false,
        };
        onOpenFile(entry);
      }
    } catch (error) {
      console.error('Failed to get CLAUDE.md details:', error);
      // Fallback to context drawer
      if (onOpenContextDrawer) {
        onOpenContextDrawer(file.scope);
      }
    }
  };

  if (!tauriAvailable) {
    return (
      <div className="agent-context-panel">
        <div className="context-fallback">
          <div className="text-6xl mb-6">🦆</div>
          <h3 className="text-xl font-bold mb-3" style={{ color: '#f28c52' }}>
            Agent Context
          </h3>
          <p
            className="text-base mb-2 max-w-md"
            style={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Available only in Tauri environment
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="agent-context-panel">
        <div className="context-loading">
          <div className="loading-spinner">⏳</div>
          <p>Loading agent context...</p>
        </div>
      </div>
    );
  }

  const globalFiles = contextFiles.filter((f) => f.scope === 'global');
  const projectFiles = contextFiles.filter((f) => f.scope === 'project');

  return (
    <div className="agent-context-panel">
      {/* Agent Personality Section */}
      <div className="context-section personality-section">
        <div
          className="context-section-header"
          onClick={() => setPersonalityCollapsed(!personalityCollapsed)}
        >
          <div className="context-section-title">
            <svg
              className="context-section-arrow"
              style={{
                transform: personalityCollapsed
                  ? 'rotate(-90deg)'
                  : 'rotate(0deg)',
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
                d="M8 12h8M12 8v8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span>Agent Personality</span>
          </div>
        </div>

        {!personalityCollapsed && (
          <div className="context-content">
            <AgentPersonalityCard
              personality={personality}
              agentName={activeAgentName}
              agentAvatar={activeAgentAvatar}
              agentWorkingOn={activeAgentWorkingOn}
            />
          </div>
        )}
      </div>

      {/* Context Files Section - Global */}
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
                  transform: globalCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
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
                  onClick={() => handleFileClick(file)}
                  style={{
                    opacity: file.exists ? 1 : 0.5,
                    cursor: file.exists ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div className="context-item-icon">📝</div>
                  <div className="context-item-content">
                    <div className="context-item-name">{file.name}</div>
                    {!file.exists && (
                      <div
                        className="text-xs"
                        style={{ color: 'rgba(255, 255, 255, 0.4)' }}
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

      {/* Context Files Section - Project */}
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
                    ? 'rotate(-90deg)'
                    : 'rotate(0deg)',
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
                  onClick={() => handleFileClick(file)}
                  style={{
                    opacity: file.exists ? 1 : 0.5,
                    cursor: file.exists ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div className="context-item-icon">📝</div>
                  <div className="context-item-content">
                    <div className="context-item-name">{file.name}</div>
                    {!file.exists && (
                      <div
                        className="text-xs"
                        style={{ color: 'rgba(255, 255, 255, 0.4)' }}
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
        <div className="context-empty">
          <div className="empty-icon">📂</div>
          <p>No context files found</p>
          <p className="empty-hint">
            Create .md files in .claude/ directory
          </p>
        </div>
      )}
    </div>
  );
}
