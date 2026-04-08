import { useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import type { MarketplaceResource } from '../types';
import type { ActiveProject } from './modal-steps/types';
import { getCategoryGradient, getCategoryIcon, VerifiedIcon, formatInstallCount, hasDuckAvatar, getDuckAvatarUrl } from './store/StoreIcons';
import MarkdownText from './MarkdownText';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AlekDob/quack-marketplace/main';

type ExtResource = MarketplaceResource & {
  _pluginSource?: string;
  _skillPath?: string;
  _commandPath?: string;
  _agentPath?: string;
  _rulePath?: string;
  _mcpServerName?: string;
  _mcpServerConfig?: { command: string; args?: string[] };
};

function buildManualCommand(resource: ExtResource): string | null {
  const src = resource._pluginSource;
  if (!src) return null;

  if (resource._skillPath) {
    const name = resource._skillPath.split('/').pop() || '';
    return `mkdir -p ~/.claude/skills/${name} && curl -sL "${GITHUB_RAW_BASE}/${src}/${resource._skillPath}/SKILL.md" -o ~/.claude/skills/${name}/SKILL.md`;
  }
  if (resource._commandPath) {
    const file = resource._commandPath.split('/').pop() || '';
    return `mkdir -p ~/.claude/commands && curl -sL "${GITHUB_RAW_BASE}/${src}/${resource._commandPath}" -o ~/.claude/commands/${file}`;
  }
  if (resource._agentPath) {
    const file = resource._agentPath.split('/').pop() || '';
    return `mkdir -p ~/.claude/agents && curl -sL "${GITHUB_RAW_BASE}/${src}/${resource._agentPath}" -o ~/.claude/agents/${file}`;
  }
  if (resource._rulePath) {
    const file = resource._rulePath.split('/').pop() || '';
    return `mkdir -p ~/.claude/rules && curl -sL "${GITHUB_RAW_BASE}/${src}/${resource._rulePath}" -o ~/.claude/rules/${file}`;
  }
  if (resource._mcpServerName && resource._mcpServerConfig) {
    const cfg = resource._mcpServerConfig;
    const args = cfg.args ? ` ${cfg.args.join(' ')}` : '';
    return `npx ${cfg.command}${args}`;
  }
  return null;
}

interface MarketplaceInstallModalProps {
  resource: MarketplaceResource | null;
  installed: boolean;
  hasUpdate?: boolean;
  installedVersion?: string;
  onClose: () => void;
  onInstall: (resource: MarketplaceResource, scope: 'global' | 'project') => Promise<boolean>;
  onUpdate?: (resource: MarketplaceResource, scope: 'global' | 'project') => Promise<boolean>;
  onUninstall?: (resourceId: string) => Promise<boolean>;
  activeProjects?: ActiveProject[];
}

export default function MarketplaceInstallModal({
  resource, installed, hasUpdate, installedVersion, onClose, onInstall, onUpdate, onUninstall,
}: MarketplaceInstallModalProps) {
  const [installing, setInstalling] = useState(false);
  const [scope, setScope] = useState<'global' | 'project'>('global');
  const [copied, setCopied] = useState(false);

  if (!resource) return null;

  const isAgentBundle = resource.category === 'agent-bundles';
  const manualCommand = buildManualCommand(resource as ExtResource);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const success = await onInstall(resource, scope);
      if (success) setTimeout(() => onClose(), 300);
    } finally {
      setInstalling(false);
    }
  };

  const handleUpdate = async () => {
    if (!onUpdate || !resource) return;
    setInstalling(true);
    try {
      const success = await onUpdate(resource, scope);
      if (success) setTimeout(() => onClose(), 300);
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async () => {
    if (!onUninstall) return;
    setInstalling(true);
    try {
      const success = await onUninstall(resource.id);
      if (success) setTimeout(() => onClose(), 800);
    } finally {
      setInstalling(false);
    }
  };

  const handleOpenRepository = async () => {
    if (resource.repository) {
      try { await open(resource.repository); }
      catch (err) { console.error('Failed to open repository:', err); }
    }
  };

  return (
    <div className="store-detail-overlay" onClick={onClose}>
      <div className="store-detail-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="store-detail-header">
          {hasDuckAvatar(resource.icon) ? (
            <img
              src={getDuckAvatarUrl(resource.icon!)}
              alt={resource.name}
              className="store-detail-avatar"
            />
          ) : (
            <div className="store-detail-icon" style={{ background: getCategoryGradient(resource.category) }}>
              {getCategoryIcon(resource.category, 24)}
            </div>
          )}
          <div className="store-detail-title-group">
            <h3 className="store-detail-name">{resource.name}</h3>
            <span className="store-detail-meta">
              {resource.author} · v{resource.version} · {resource.category}
            </span>
          </div>
          <button type="button" className="store-detail-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Trust signals */}
        <div className="store-detail-signals">
          {resource.verified && (
            <span className="store-item-verified"><VerifiedIcon /> Verified</span>
          )}
          {resource.installCount > 0 && (
            <span className="store-item-installs">
              {formatInstallCount(resource.installCount)} installs
            </span>
          )}
        </div>

        {/* Description body - scrollable for long content */}
        <div className="store-detail-body">
          <MarkdownText>{resource.longDescription || resource.description}</MarkdownText>
        </div>

        {/* Manual install command */}
        {manualCommand && (
          <div className="store-detail-manual">
            <span className="store-detail-manual-label">Manual install</span>
            <div className="store-detail-manual-cmd">
              <code>{manualCommand}</code>
              <button
                type="button"
                className="store-detail-manual-copy"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(manualCommand);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch { /* clipboard fallback */ }
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Tags */}
        {resource.tags.length > 0 && (
          <div className="store-detail-tags">
            {resource.tags.slice(0, 6).map((tag) => (
              <span key={tag} className="store-detail-tag">#{tag}</span>
            ))}
          </div>
        )}

        {/* Scope selector - hidden for agent-bundles (project picker handles it) */}
        {!installed && !isAgentBundle && (
          <div className="store-detail-scope">
            <button
              type="button"
              className={`store-scope-btn ${scope === 'global' ? 'active' : ''}`}
              onClick={() => setScope('global')}
            >
              Global
            </button>
            <button
              type="button"
              className={`store-scope-btn ${scope === 'project' ? 'active' : ''}`}
              onClick={() => setScope('project')}
              disabled
            >
              Project
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="store-detail-actions">
          {installed ? (
            <>
              <span className="store-detail-installed-badge">
                Installed{installedVersion && installedVersion !== 'unknown' ? ` v${installedVersion}` : ''}
              </span>
              {hasUpdate && onUpdate && (
                <button
                  type="button"
                  className="store-detail-btn store-detail-btn-install"
                  onClick={handleUpdate}
                  disabled={installing}
                >
                  {installing ? 'Updating...' : `Update to v${resource.version}`}
                </button>
              )}
              {onUninstall && (
                <button
                  type="button"
                  className="store-detail-btn store-detail-btn-remove"
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
              className="store-detail-btn store-detail-btn-install"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing
                ? 'Installing...'
                : isAgentBundle
                  ? 'Install Agent...'
                  : 'Install'
              }
            </button>
          )}
          {resource.repository && (
            <button
              type="button"
              className="store-detail-btn store-detail-btn-github"
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
