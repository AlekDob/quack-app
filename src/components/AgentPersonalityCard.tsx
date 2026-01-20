import { useState, useEffect } from 'react';
import type { AgentPersonality, SavedAgent } from '../types';
import './AgentPersonalityCard.css';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import { getAvatarUrl } from '../utils/agentAvatars';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useBundleOperations } from '../hooks/useBundleOperations';

interface AgentPersonalityCardProps {
  personality: AgentPersonality | null;
  agentName?: string | null;
  agentAvatar?: string | null;
  agentWorkingOn?: string | null;
  agentColor?: string | null;
  agentId?: string | null;
  onImportAgent?: (agent: SavedAgent) => void;
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

  return (
    <div className="agent-personality-card">
      <div className="personality-header">
        <div className="personality-avatar">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={agentName || personality.name}
              className="avatar-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.error('[AgentPersonalityCard] Image failed to load, using fallback duck15.jpeg:', avatarUrl);
                // Always fallback to duck15.jpeg on error
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
        <div className="personality-identity">
          <h3 className="personality-name">{agentName || personality.name}</h3>
          <p className="personality-role">{personality.role}</p>
          {agentWorkingOn && (
            <div className="personality-working-on">
              <span className="working-on-label">Working on:</span>
              <span className="working-on-text">{agentWorkingOn}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bundle Export/Import Actions */}
      <div className="personality-section bundle-actions">
        <div className="bundle-buttons">
          <button
            className="bundle-btn bundle-btn-export"
            onClick={handleExport}
            disabled={exporting}
            title="Export agent as bundle"
          >
            {exporting ? 'Exporting...' : 'Export Bundle'}
          </button>
          <button
            className="bundle-btn bundle-btn-import"
            onClick={handleImport}
            disabled={importing}
            title="Import agent from bundle"
          >
            {importing ? 'Importing...' : 'Import Bundle'}
          </button>
        </div>
        {error && (
          <div className="bundle-error" onClick={clearError}>
            {error}
          </div>
        )}
      </div>

      {personality.technicalContext && (
        <div className="personality-section">
          <h4 className="section-title">Technical Context</h4>
          <p className="personality-intro">{personality.technicalContext}</p>
        </div>
      )}

      {personality.rules && personality.rules.length > 0 && (
        <div className="personality-section">
          <h4 className="section-title">Rules & Best Practices</h4>
          <div className="rules-list">
            {personality.rules.map((rule, index) => (
              <div key={index} className="rule-item">
                <span className="rule-bullet">•</span>
                <span className="rule-text">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {personality.communicationStyle && (
        <div className="personality-section">
          <h4 className="section-title">Communication Style</h4>
          <div className="communication-badge">
            {COMMUNICATION_STYLES_MAP[personality.communicationStyle] ||
              personality.communicationStyle}
          </div>
        </div>
      )}

      {personality.customNotes && (
        <div className="personality-section">
          <h4 className="section-title">Custom Notes</h4>
          <p className="personality-intro">{filterDroidsFromCustomNotes(personality.customNotes)}</p>
        </div>
      )}

      {/* HIDDEN: Favorite Expressions section - not editable in UI yet */}
      {/* {personality.expressions && personality.expressions.length > 0 && (
        <div className="personality-section">
          <h4 className="section-title">Favorite Expressions</h4>
          <div className="expressions-list">
            {personality.expressions.map((expression, index) => (
              <div key={index} className="expression-item">
                💬 {expression}
              </div>
            ))}
          </div>
        </div>
      )} */}
    </div>
  );
}
