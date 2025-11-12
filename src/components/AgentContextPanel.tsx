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

interface ContextFileStats {
  char_count: number;
  word_count: number;
  line_count: number;
  score: 'good' | 'warning' | 'bad';
}

interface AgentContextPanelProps {
  tauriAvailable: boolean;
  activeAgentId?: string | null;
  activeAgentName?: string | null;
  activeAgentAvatar?: string | null;
  activeAgentWorkingOn?: string | null;
  activeAgentCwd?: string | null;
  activeAgentPersonality?: Partial<AgentPersonality> | null; // Added: personality from terminal state
  onOpenFile?: (entry: DirectoryEntry) => void;
  onOpenContextDrawer?: (scope: string) => void;
  projectName?: string;
  gitBranch?: string;
  refreshKey?: number; // Added: forces refresh when agent is edited
}

export default function AgentContextPanel({
  tauriAvailable,
  activeAgentId,
  activeAgentName,
  activeAgentAvatar,
  activeAgentWorkingOn,
  activeAgentCwd,
  activeAgentPersonality, // Added: personality from terminal state
  onOpenFile,
  onOpenContextDrawer,
  projectName,
  gitBranch,
  refreshKey, // Added: forces refresh when agent is edited
}: AgentContextPanelProps) {
  const [personality, setPersonality] = useState<AgentPersonality | null>(null);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [globalStats, setGlobalStats] = useState<ContextFileStats | null>(null);
  const [projectStats, setProjectStats] = useState<ContextFileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [personalityCollapsed, setPersonalityCollapsed] = useState(false);
  const [globalCollapsed, setGlobalCollapsed] = useState(false);
  const [projectCollapsed, setProjectCollapsed] = useState(false);

  useEffect(() => {
    void loadAgentContext();
  }, [tauriAvailable, activeAgentId, refreshKey]); // Added refreshKey to trigger reload when agent is edited

  const loadAgentContext = async () => {
    if (!tauriAvailable) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Use personality from props (state) instead of loading from Rust
      if (activeAgentPersonality && Object.keys(activeAgentPersonality).length > 0) {
        // Personality available from terminal state - use it!
        const fullPersonality: AgentPersonality = {
          id: activeAgentId || '',
          name: activeAgentName || '',
          role: activeAgentPersonality.role || '',
          technicalContext: activeAgentPersonality.technicalContext,
          rules: activeAgentPersonality.rules,
          communicationStyle: activeAgentPersonality.communicationStyle || 'friendly',
          customNotes: activeAgentPersonality.customNotes,
          // Legacy fields (for backwards compatibility)
          intro: activeAgentPersonality.intro,
          personality: activeAgentPersonality.personality,
          quirks: activeAgentPersonality.quirks,
          specialties: activeAgentPersonality.specialties,
          skills: activeAgentPersonality.skills,
          expressions: activeAgentPersonality.expressions,
        };
        setPersonality(fullPersonality);
        console.log('✅ Loaded personality from state:', fullPersonality);
      } else if (activeAgentId && activeAgentCwd) {
        // Fallback: try loading from Rust (for backward compatibility)
        try {
          const loadedPersonality = await invoke<AgentPersonality>(
            'load_agent_personality',
            {
              projectPath: activeAgentCwd,
              personalityId: activeAgentId,
            }
          );
          console.log('✅ Loaded personality from Rust:', loadedPersonality);
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

        // Load stats for global CLAUDE.md
        try {
          const gStats = await invoke<ContextFileStats>('get_claude_md_stats', {
            scope: 'global',
            workingDir: activeAgentCwd || null,
          });
          setGlobalStats(gStats);
        } catch (error) {
          console.error('Failed to load global CLAUDE.md stats:', error);
          setGlobalStats(null);
        }

        // Load stats for project CLAUDE.md
        try {
          const pStats = await invoke<ContextFileStats>('get_claude_md_stats', {
            scope: 'project',
            workingDir: activeAgentCwd || null,
          });
          setProjectStats(pStats);
        } catch (error) {
          console.error('Failed to load project CLAUDE.md stats:', error);
          setProjectStats(null);
        }
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
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f28c52" strokeWidth="1.5" style={{ margin: '0 auto 1.5rem' }}>
            <circle cx="12" cy="7" r="3"/>
            <path d="M5 17a5 5 0 0 1 10 0"/>
            <path d="M14 5l2-2M6 5L4 3"/>
          </svg>
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
          <div className="loading-spinner">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
          <p>Loading agent context...</p>
        </div>
      </div>
    );
  }

  const globalFiles = contextFiles.filter((f) => f.scope === 'global');
  const projectFiles = contextFiles.filter((f) => f.scope === 'project');

  // Helper function to render stats badge
  const renderStatsBadge = (stats: ContextFileStats | null) => {
    if (!stats || stats.char_count === 0) return null;

    const getScoreColor = (score: string) => {
      switch (score) {
        case 'good':
          return '#4ecdc4'; // green
        case 'warning':
          return '#f8b739'; // yellow/orange
        case 'bad':
          return '#ff6b6b'; // red
        default:
          return '#999';
      }
    };

    const formatNumber = (num: number) => {
      if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}k`;
      }
      return num.toString();
    };

    return (
      <span
        style={{
          fontSize: '0.75em',
          padding: '2px 6px',
          borderRadius: '8px',
          background: `${getScoreColor(stats.score)}15`,
          color: getScoreColor(stats.score),
          fontWeight: 600,
          marginLeft: '6px',
        }}
      >
        {formatNumber(stats.char_count)}
      </span>
    );
  };

  return (
    <div className="agent-context-panel">
      {/* Current Workspace Info */}
      {(projectName || gitBranch) && (
        <div className="context-section" style={{ marginBottom: '12px' }}>
          <div className="context-section-header" style={{ cursor: 'default', paddingBottom: '8px' }}>
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
          <div className="context-list" style={{ gap: '4px' }}>
            {projectName && (
              <div
                className="context-item"
                style={{ cursor: 'default', padding: '6px 12px', background: 'rgba(242, 140, 82, 0.05)' }}
              >
                <div className="context-item-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                  </svg>
                </div>
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
                style={{ cursor: 'default', padding: '6px 12px', background: 'rgba(78, 205, 196, 0.05)' }}
              >
                <div className="context-item-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2">
                    <line x1="6" y1="3" x2="6" y2="15"/>
                    <circle cx="18" cy="6" r="3"/>
                    <circle cx="6" cy="18" r="3"/>
                    <path d="M18 9a9 9 0 0 1-9 9"/>
                  </svg>
                </div>
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
              {renderStatsBadge(globalStats)}
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
                  <div className="context-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
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
              {renderStatsBadge(projectStats)}
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
                  <div className="context-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
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
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p>No context files found</p>
          <p className="empty-hint">
            Create .md files in .claude/ directory
          </p>
        </div>
      )}
    </div>
  );
}
