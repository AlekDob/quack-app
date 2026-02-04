import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import type { MarketplaceResource } from '../types';
import { useSessionStore } from '../stores/sessionStore';

/**
 * MarketplaceInstallModal - Compact inline detail panel (Codex-style)
 * Minimal design matching AddonsDrawer aesthetic
 */

interface MarketplaceInstallModalProps {
  resource: MarketplaceResource | null;
  installed: boolean;
  onClose: () => void;
  onInstall: (resource: MarketplaceResource, scope: 'global' | 'project') => Promise<boolean>;
  onUninstall?: (resourceId: string) => Promise<boolean>;
}

// Category-specific gradients - matches AddonsDrawer
const CATEGORY_GRADIENTS: Record<string, string> = {
  skills: 'linear-gradient(135deg, #f28c52, #e67339)',       // Orange - main accent
  agents: 'linear-gradient(135deg, #f28c52, #fbbf24)',       // Orange/Yellow - personas
  'agent-bundles': 'linear-gradient(135deg, #f28c52, #fbbf24)',
  droids: 'linear-gradient(135deg, #4ecdc4, #26a69a)',       // Teal - automation
  rules: 'linear-gradient(135deg, #60a5fa, #3b82f6)',        // Blue - governance
  hooks: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',        // Purple - events
  mcp: 'linear-gradient(135deg, #34d399, #10b981)',          // Green - servers
  commands: 'linear-gradient(135deg, #f472b6, #ec4899)',     // Pink - snippets
  snippets: 'linear-gradient(135deg, #f472b6, #ec4899)',     // Pink - snippets
  default: 'linear-gradient(135deg, #6b7280, #4b5563)',      // Gray - fallback
};

function getCategoryGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.default;
}

// Icons - EXACT COPIES from SidePanelAccordion for uniformity
function getCategoryIcon(category: string): React.ReactElement {
  const iconStyle = { width: 14, height: 14, color: 'white' };

  switch (category) {
    case 'skills':
      // Star icon - matches SidePanel skills icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'agents':
    case 'agent-bundles':
      // Person icon for agents (personas)
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <circle cx="10" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 17a5 5 0 0 1 10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'droids':
      // Robot icon - matches SidePanel agents/droids icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
          <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
          <line x1="7.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'rules':
      // Document with checkmarks - matches SidePanel rules icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M4 3h8l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 10l1.5 1.5L9 9M5 14l1.5 1.5L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'hooks':
      // Hook icon - matches SidePanel hooks icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M10 3v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 10c0 2.5-2 4-4 4s-4-1.5-4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="3" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'mcp':
      // Server/MCP icon - matches SidePanel mcp icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="8" r="1.5" fill="currentColor" />
          <circle cx="13" cy="8" r="1.5" fill="currentColor" />
          <path d="M7 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'commands':
    case 'snippets':
      // Terminal/commands icon - matches SidePanel commands icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 7l2 2-2 2M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

export default function MarketplaceInstallModal({
  resource,
  installed,
  onClose,
  onInstall,
  onUninstall,
}: MarketplaceInstallModalProps) {
  const [installing, setInstalling] = useState(false);
  const [scope, setScope] = useState<'global' | 'project'>('global');

  const selectedSession = useSessionStore((s) => s.getSelectedSession());
  const projectPath = selectedSession?.projectPath;
  const projectName = selectedSession?.projectName || 'No project';

  if (!resource) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const success = await onInstall(resource, scope);
      if (success) {
        setTimeout(() => onClose(), 800);
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async () => {
    if (!onUninstall) return;
    setInstalling(true);
    try {
      const success = await onUninstall(resource.id);
      if (success) {
        setTimeout(() => onClose(), 800);
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleOpenRepository = async () => {
    if (resource.repository) {
      try {
        await open(resource.repository);
      } catch (err) {
        console.error('Failed to open repository:', err);
      }
    }
  };

  return (
    <div className="addon-detail-overlay" onClick={onClose}>
      <div className="addon-detail-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="addon-detail-header">
          <div className="addon-detail-icon" style={{ background: getCategoryGradient(resource.category) }}>
            {getCategoryIcon(resource.category)}
          </div>
          <div className="addon-detail-title-group">
            <h3 className="addon-detail-name">{resource.name}</h3>
            <span className="addon-detail-meta">
              {resource.author} · v{resource.version}
            </span>
          </div>
          <button type="button" className="addon-detail-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="addon-detail-description">{resource.description}</p>

        {/* Tags */}
        {resource.tags.length > 0 && (
          <div className="addon-detail-tags">
            {resource.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="addon-detail-tag">#{tag}</span>
            ))}
          </div>
        )}

        {/* Scope selector (only for install) */}
        {!installed && (
          <div className="addon-detail-scope">
            <button
              type="button"
              className={`addon-scope-btn ${scope === 'global' ? 'active' : ''}`}
              onClick={() => setScope('global')}
            >
              Global
            </button>
            <button
              type="button"
              className={`addon-scope-btn ${scope === 'project' ? 'active' : ''}`}
              onClick={() => projectPath && setScope('project')}
              disabled={!projectPath}
            >
              {projectPath ? projectName : 'No project'}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="addon-detail-actions">
          {installed ? (
            <>
              <span className="addon-detail-installed-badge">Installed</span>
              {onUninstall && (
                <button
                  type="button"
                  className="addon-detail-btn addon-detail-btn-remove"
                  onClick={handleUninstall}
                  disabled={installing}
                >
                  {installing ? 'Removing...' : 'Remove'}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="addon-detail-btn addon-detail-btn-install"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? 'Installing...' : 'Install'}
            </button>
          )}
          {resource.repository && (
            <button
              type="button"
              className="addon-detail-btn addon-detail-btn-github"
              onClick={handleOpenRepository}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
