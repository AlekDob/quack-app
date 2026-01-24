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
  const [installing, setInstalling] = useState(false);

  if (!resource) return null;

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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'agents': return '#f28c52';
      case 'commands': return '#3b82f6';
      case 'hooks': return '#8b5cf6';
      case 'settings': return '#6b7280';
      case 'mcp': return '#10b981';
      case 'stacks': return '#f59e0b';
      case 'skills': return '#ec4899';
      default: return '#6b7280';
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
          className="px-5 py-3 border-b"
          style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: `${getCategoryColor(resource.category)}20`,
                    border: `1px solid ${getCategoryColor(resource.category)}40`,
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: getCategoryColor(resource.category) }}
                  />
                </div>
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
          <div className="flex flex-wrap gap-1.5 mt-2">
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
                Verified
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
                Featured
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          <div className="p-5 space-y-4">
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

            {/* Installation Info */}
            <div>
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Installation
              </h3>
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  background: installed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${installed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  color: installed ? '#22c55e' : 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {installed
                  ? `Installed in ~/.claude/${resource.category}/`
                  : `Will be installed to ~/.claude/${resource.category}/`
                }
              </div>
            </div>

            {/* Version */}
            <div>
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                Version
              </h3>
              <div
                className="inline-block px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div
                  className="text-sm font-bold"
                  style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                >
                  v{resource.version}
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
          className="px-5 py-3 border-t flex items-center gap-2"
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
                Installed
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
                  {installing ? 'Removing...' : 'Uninstall'}
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
              {installing ? 'Installing...' : 'Install'}
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
