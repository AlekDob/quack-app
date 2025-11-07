import { useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import type { MarketplaceResource } from '../types';

/**
 * MarketplaceInstallModal - Modal for viewing resource details and installation
 * Shows full info, install command, and action buttons
 */

interface MarketplaceInstallModalProps {
  resource: MarketplaceResource | null;
  installed: boolean;
  onClose: () => void;
  onInstall: (resource: MarketplaceResource) => Promise<boolean>;
  onUninstall?: (resourceId: string) => Promise<boolean>;
}

export default function MarketplaceInstallModal({
  resource,
  installed,
  onClose,
  onInstall,
  onUninstall,
}: MarketplaceInstallModalProps) {
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!resource) return null;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(resource.installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const success = await onInstall(resource);
      if (success) {
        // Close modal after successful install
        setTimeout(() => onClose(), 1000);
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
        setTimeout(() => onClose(), 1000);
      }
    } finally {
      setInstalling(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'agents': return '🦆';
      case 'commands': return '⌘';
      case 'hooks': return '🪝';
      case 'settings': return '⚙️';
      case 'mcp': return '🔌';
      case 'stacks': return '📚';
      case 'skills': return '⭐';
      default: return '📦';
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full mx-4 overflow-hidden"
        style={{
          background: 'rgba(12, 16, 24, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          maxHeight: '90vh',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{getCategoryIcon(resource.category)}</span>
                <div>
                  <h2
                    className="text-xl font-bold"
                    style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    {resource.name}
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                  >
                    by {resource.author} • v{resource.version}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                background: 'rgba(242, 140, 82, 0.1)',
                color: '#f28c52',
              }}
            >
              {resource.category}
            </span>
            {resource.verified && (
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e',
                }}
              >
                ✓ Verified
              </span>
            )}
            {resource.featured && (
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  color: '#fbbf24',
                }}
              >
                ⭐ Featured
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          <div className="p-6 space-y-6">
            {/* Description */}
            <div>
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Description
              </h3>
              <p
                className="text-sm"
                style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  lineHeight: '1.6',
                }}
              >
                {resource.description}
              </p>
            </div>

            {/* Installation Command */}
            <div>
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Installation Command
              </h3>
              <div
                className="relative p-3 rounded-lg font-mono text-sm"
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#22c55e',
                }}
              >
                <code>{resource.installCommand}</code>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 px-3 py-1 rounded text-xs font-sans transition-colors"
                  style={{
                    background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: copied ? '#22c55e' : 'rgba(255, 255, 255, 0.9)',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div
                className="p-3 rounded-lg"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: '#f28c52' }}
                >
                  {resource.installCount}
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                >
                  Installs
                </div>
              </div>

              {resource.rating && (
                <div
                  className="p-3 rounded-lg"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div
                    className="text-2xl font-bold mb-1"
                    style={{ color: '#fbbf24' }}
                  >
                    {resource.rating.toFixed(1)} ⭐
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                  >
                    Rating
                  </div>
                </div>
              )}

              <div
                className="p-3 rounded-lg"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div
                  className="text-sm font-bold mb-1"
                  style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                >
                  v{resource.version}
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                >
                  Version
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {resource.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded text-xs"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'rgba(255, 255, 255, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Repository Link */}
            {resource.repository && (
              <div>
                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  Repository
                </h3>
                <button
                  type="button"
                  onClick={handleOpenRepository}
                  className="text-sm inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#3b82f6',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  View on GitHub
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="px-6 py-4 border-t flex items-center gap-3"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          {installed ? (
            <>
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#22c55e',
                  cursor: 'default',
                }}
              >
                ✓ Installed
              </button>
              {onUninstall && (
                <button
                  type="button"
                  onClick={handleUninstall}
                  disabled={installing}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                  }}
                  onMouseEnter={(e) => {
                    if (!installing) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  }}
                >
                  {installing ? 'Uninstalling...' : 'Uninstall'}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: 'rgba(242, 140, 82, 0.1)',
                border: '1px solid rgba(242, 140, 82, 0.3)',
                color: '#f28c52',
              }}
              onMouseEnter={(e) => {
                if (!installing) {
                  e.currentTarget.style.background = 'rgba(242, 140, 82, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(242, 140, 82, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.3)';
              }}
            >
              {installing ? 'Installing...' : 'Install Now'}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.9)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
