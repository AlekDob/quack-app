/**
 * AssetPreviewModal - Quick preview modal for asset content
 */

import { useEffect } from 'react';
import type { ClaudeAsset, ClaudeAssetType } from '../../types/claudeAssets';
import './AssetPreviewModal.css';

interface AssetPreviewModalProps {
  asset: ClaudeAsset;
  content: string;
  onClose: () => void;
  onEdit: () => void;
}

// Asset type icons
const ASSET_ICONS: Record<ClaudeAssetType, string> = {
  droid: '🤖',
  command: '⌨️',
  rule: '📜',
  skill: '⭐',
  mcp: '🔌',
  hook: '🪝',
};

export default function AssetPreviewModal({
  asset,
  content,
  onClose,
  onEdit,
}: AssetPreviewModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Determine syntax highlighting language
  const getLanguage = () => {
    if (asset.type === 'mcp') return 'json';
    return 'markdown';
  };

  return (
    <div className="asset-preview-overlay" onClick={onClose}>
      <div className="asset-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="preview-header">
          <div className="preview-title">
            <span className="preview-icon">
              {ASSET_ICONS[asset.type as ClaudeAssetType] || '📄'}
            </span>
            <div className="preview-info">
              <h3>{asset.name}</h3>
              <span className="preview-path">{asset.relativePath}</span>
            </div>
          </div>
          <div className="preview-actions">
            <button
              type="button"
              className="preview-btn edit"
              onClick={onEdit}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              type="button"
              className="preview-btn close"
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Metadata */}
        {asset.metadata.description && (
          <div className="preview-description">
            {asset.metadata.description}
          </div>
        )}

        {/* Content */}
        <div className="preview-content">
          <pre className={`language-${getLanguage()}`}>
            <code>{content}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="preview-footer">
          <span className="preview-project">
            Project: {asset.projectName}
          </span>
          <span className="preview-type">
            Type: {asset.type}
          </span>
        </div>
      </div>
    </div>
  );
}
