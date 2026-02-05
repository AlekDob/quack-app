import { useState, useEffect } from 'react';
import type { AgentPersonality, SavedAgent } from '../types';
import './AgentPersonalityCard.css';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import { getAvatarUrl } from '../utils/agentAvatars';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useBundleOperations } from '../hooks/useBundleOperations';

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

interface AgentPersonalityCardProps {
  personality: AgentPersonality | null;
  agentName?: string | null;
  agentAvatar?: string | null;
  agentWorkingOn?: string | null;
  agentColor?: string | null;
  agentId?: string | null;
  onImportAgent?: (agent: SavedAgent) => void;
  // Workspace info
  projectName?: string;
  gitBranch?: string;
  // Context files
  projectFiles?: ContextFile[];
  globalFiles?: ContextFile[];
  projectStats?: ContextFileStats | null;
  globalStats?: ContextFileStats | null;
  onFileClick?: (file: ContextFile) => void;
}

const COMMUNICATION_STYLES_MAP: Record<string, string> = {
  professional: 'Professional',
  friendly: 'Friendly',
  casual: 'Casual',
  technical: 'Technical',
  sarcastic: 'Sarcastic',
};

/**
 * Filter out the "Selected Protocol Droids:" section from customNotes
 * This section is automatically added to CLAUDE.md but should not be shown in the UI
 */
function filterDroidsFromCustomNotes(customNotes?: string): string | undefined {
  if (!customNotes) return customNotes;

  const lines = customNotes.split('\n');
  const filtered: string[] = [];
  let skipDroids = false;

  for (const line of lines) {
    if (line.includes('Selected Protocol Droids:')) {
      skipDroids = true;
      continue;
    }
    if (skipDroids) {
      const trimmed = line.trim();
      // Stop skipping when we hit non-droid content
      if (!trimmed.startsWith('- ') && trimmed.length > 0) {
        skipDroids = false;
        filtered.push(line);
      }
      // Skip droid lines and empty lines within droids section
      continue;
    }
    filtered.push(line);
  }

  return filtered.join('\n').trim();
}

export default function AgentPersonalityCard({
  personality,
  agentName,
  agentAvatar,
  agentWorkingOn,
  agentColor,
  agentId,
  onImportAgent,
  projectName,
  gitBranch,
  projectFiles = [],
  globalFiles = [],
  projectStats,
  globalStats,
  onFileClick,
}: AgentPersonalityCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { exporting, importing, error, exportAgent, importBundle, clearError } = useBundleOperations();

  // Handle export button click
  async function handleExport() {
    console.log('[AgentPersonalityCard] handleExport called', { personality, agentName, agentId, agentColor });

    if (!personality || !agentName) {
      console.warn('[AgentPersonalityCard] Export aborted - missing personality or agentName', { personality: !!personality, agentName });
      return;
    }

    const agent: SavedAgent = {
      id: agentId || `agent-${Date.now()}`,
      name: agentName,
      avatar: agentAvatar || '',
      color: agentColor || '#00D4FF',
      workingOn: agentWorkingOn || '',
      personality,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
    };

    await exportAgent(agent);
  }

  // Handle import button click
  async function handleImport() {
    const imported = await importBundle();
    if (imported && onImportAgent) {
      onImportAgent(imported);
    }
  }

  // Load avatar URL (custom or default) - WITH FALLBACK for undefined avatars
  useEffect(() => {
    let isMounted = true;

    async function loadAvatarUrl() {
      // If no avatar specified, use duck15.jpeg fallback
      if (!agentAvatar) {
        console.log('[AgentPersonalityCard] No avatar specified, using duck15.jpeg fallback');
        if (isMounted) {
          // Use duck15.jpeg as fallback for agents with undefined avatar
          if (window.__TAURI__) {
            setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset'));
          } else {
            setAvatarUrl('/images/ducks/new-avatars/duck15.jpeg');
          }
        }
        return;
      }

      // Check if it's a custom avatar (UUID format)
      if (isCustomAvatar(agentAvatar)) {
        try {
          const url = await getCustomAvatarUrl(agentAvatar);
          if (isMounted) {
            setAvatarUrl(url);
          }
        } catch (error) {
          console.error('Failed to load custom avatar:', error);
          if (isMounted) {
            // Fallback to duck15.jpeg if custom avatar fails
            if (window.__TAURI__) {
              setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset'));
            } else {
              setAvatarUrl('/images/ducks/new-avatars/duck15.jpeg');
            }
          }
        }
      } else {
        // Default avatar - use getAvatarUrl helper
        if (isMounted) {
          setAvatarUrl(getAvatarUrl(agentAvatar));
        }
      }
    }

    loadAvatarUrl();

    return () => {
      isMounted = false;
    };
  }, [agentAvatar]);

  if (!personality) {
    return (
      <div className="agent-personality-card empty">
        <div className="personality-empty-state">
          <h3>No Agent Selected</h3>
          <p>Select an agent to view their personality configuration</p>
        </div>
      </div>
    );
  }

  // Filter custom notes to show
  const filteredNotes = filterDroidsFromCustomNotes(personality.customNotes);

  return (
    <div className="agent-personality-card">
      {/* Compact Header: Avatar + Name + Role + Style Badge inline */}
      <div className="personality-header-compact">
        <div className="personality-avatar">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={agentName || personality.name}
              className="avatar-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.error('[AgentPersonalityCard] Image failed to load, using fallback duck15.jpeg:', avatarUrl);
                if (window.__TAURI__) {
                  target.src = convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset');
                } else {
                  target.src = '/images/ducks/new-avatars/duck15.jpeg';
                }
              }}
            />
          ) : (
            <svg className="avatar-icon-svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="7" r="3"/>
              <path d="M5 17a5 5 0 0 1 10 0"/>
            </svg>
          )}
        </div>
        <div className="personality-identity-compact">
          <div className="personality-name-row">
            <span className="personality-name">{agentName || personality.name}</span>
            {personality.communicationStyle && (
              <span className="style-badge-inline">
                {COMMUNICATION_STYLES_MAP[personality.communicationStyle] || personality.communicationStyle}
              </span>
            )}
          </div>
          <p className="personality-role">{personality.role}</p>
        </div>
      </div>

      {/* Bio/Notes Section - directly under header without title */}
      {filteredNotes && (
        <div className="personality-bio">
          {filteredNotes}
        </div>
      )}

      {/* Proactive Skills - chip display */}
      {/* Use selectedSkills if available, otherwise extract from legacy skills field */}
      {(() => {
        let skillNames: string[] = [];

        if (personality.selectedSkills && personality.selectedSkills.length > 0) {
          skillNames = personality.selectedSkills;
        } else if (personality.skills && personality.skills.length > 0) {
          // Extract skill names from legacy format: "/path/to/skill-name/SKILL.md | WHEN: ..."
          skillNames = personality.skills.map(s => {
            // Extract the folder name before /SKILL.md or .md
            const match = s.match(/\/([^/]+)(?:\/SKILL)?\.md/i);
            if (match) return match[1];
            // Fallback: just use the last path segment
            const parts = s.split('/');
            const last = parts[parts.length - 1];
            return last.replace(/\.md$/i, '').replace(/\/SKILL$/i, '');
          });
        }

        if (skillNames.length === 0) return null;

        return (
          <div className="personality-skills-compact">
            <span className="skills-label">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="url(#skillGradientCard)" strokeWidth="2">
                <defs>
                  <linearGradient id="skillGradientCard" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f28c52" />
                    <stop offset="100%" stopColor="#e67339" />
                  </linearGradient>
                </defs>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Skills
            </span>
            {skillNames.map((skill, index) => (
              <span key={index} className="skill-chip-compact">{skill}</span>
            ))}
          </div>
        );
      })()}

      {/* Technical Context - inline without section title */}
      {personality.technicalContext && (
        <div className="personality-context">
          {personality.technicalContext}
        </div>
      )}

      {/* Workspace + Context Files Row */}
      <div className="personality-meta-row">
        {/* Workspace Info */}
        {(projectName || gitBranch) && (
          <div className="workspace-chips">
            {projectName && (
              <span className="meta-chip workspace-chip">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7h18M3 12h18M3 17h18"/>
                </svg>
                {projectName}
              </span>
            )}
            {gitBranch && (
              <span className="meta-chip branch-chip">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="6" cy="6" r="2"/>
                  <circle cx="18" cy="18" r="2"/>
                  <path d="M6 8v8c0 2 2 4 4 4h2"/>
                </svg>
                {gitBranch}
              </span>
            )}
          </div>
        )}

        {/* Context Files */}
        {(projectFiles.length > 0 || globalFiles.length > 0) && (
          <div className="context-chips">
            {projectFiles.map((file) => (
              <span
                key={`${file.scope}-${file.name}`}
                className={`meta-chip context-chip ${!file.exists ? 'not-exists' : ''}`}
                onClick={() => file.exists && onFileClick?.(file)}
              >
                {file.name}
                {projectStats && projectStats.char_count > 0 && (
                  <span className={`chip-size stats-${projectStats.score}`}>
                    {projectStats.char_count >= 1000
                      ? `${(projectStats.char_count / 1000).toFixed(1)}k`
                      : projectStats.char_count}
                  </span>
                )}
              </span>
            ))}
            {globalFiles.map((file) => (
              <span
                key={`${file.scope}-${file.name}`}
                className={`meta-chip context-chip global ${!file.exists ? 'not-exists' : ''}`}
                onClick={() => file.exists && onFileClick?.(file)}
              >
                {file.name}
                {globalStats && globalStats.char_count > 0 && (
                  <span className={`chip-size stats-${globalStats.score}`}>
                    {globalStats.char_count >= 1000
                      ? `${(globalStats.char_count / 1000).toFixed(1)}k`
                      : globalStats.char_count}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Rules as compact chips - only if present */}
      {personality.rules && personality.rules.length > 0 && (
        <div className="personality-rules-compact">
          {personality.rules.slice(0, 3).map((rule, index) => (
            <span key={index} className="rule-chip">{rule}</span>
          ))}
          {personality.rules.length > 3 && (
            <span className="rule-chip more">+{personality.rules.length - 3}</span>
          )}
        </div>
      )}

      {/* Bundle Actions - Show on hover */}
      <div className="bundle-actions-compact">
        <button
          className="bundle-btn-compact"
          onClick={handleExport}
          disabled={exporting}
          title="Export agent as bundle"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          {exporting ? 'Exporting...' : 'Export'}
        </button>
        <button
          className="bundle-btn-compact"
          onClick={handleImport}
          disabled={importing}
          title="Import agent from bundle"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          {importing ? 'Importing...' : 'Import'}
        </button>
      </div>
      {error && (
        <div className="bundle-error-compact" onClick={clearError}>
          {error}
        </div>
      )}
    </div>
  );
}
