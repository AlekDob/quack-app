/**
 * AssetCard - Draggable card for a single Claude asset
 */

import { useDraggable } from '@dnd-kit/core';
import type { ClaudeAsset, ClaudeAssetType } from '../../types/claudeAssets';
import './AssetCard.css';

interface AssetCardProps {
  asset: ClaudeAsset;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onDelete: () => void;
}

// Asset type colors
const ASSET_COLORS: Record<ClaudeAssetType, string> = {
  droid: '#8b5cf6',
  command: '#3b82f6',
  rule: '#f59e0b',
  skill: '#10b981',
  mcp: '#ec4899',
  hook: '#06b6d4',
};

// SVG icons for asset types
const AssetIcon = ({ type, size = 16 }: { type: ClaudeAssetType; size?: number }) => {
  const icons: Record<ClaudeAssetType, React.ReactNode> = {
    droid: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
      </svg>
    ),
    command: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    rule: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    skill: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
    mcp: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M4.93 4.93l2.83 2.83" />
        <path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
      </svg>
    ),
    hook: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  };
  return icons[type] || icons.skill;
};

export default function AssetCard({
  asset,
  isSelected,
  onSelect,
  onPreview,
  onDelete,
}: AssetCardProps) {

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: asset.id,
    data: { asset },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const assetColor = ASSET_COLORS[asset.type as ClaudeAssetType] || '#6b7280';

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`asset-card ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      {/* Header with icon and type badge */}
      <div className="asset-card-header">
        <div
          className="asset-icon"
          style={{ background: `${assetColor}20`, color: assetColor }}
        >
          <AssetIcon type={asset.type as ClaudeAssetType} />
        </div>
        <span
          className="asset-type-badge"
          style={{
            background: `${assetColor}15`,
            color: assetColor,
            borderColor: `${assetColor}30`,
          }}
        >
          {asset.type}
        </span>
        {asset.isDirectory && (
          <span className="asset-directory-badge">DIR</span>
        )}
      </div>

      {/* Asset name */}
      <div className="asset-name">{asset.name}</div>

      {/* Description if available */}
      {asset.metadata.description && (
        <div className="asset-description">{asset.metadata.description}</div>
      )}

      {/* Metadata */}
      <div className="asset-meta">
        {asset.metadata.model && (
          <span className="meta-tag model">{asset.metadata.model}</span>
        )}
        {asset.size > 0 && (
          <span className="meta-tag size">{formatSize(asset.size)}</span>
        )}
        {asset.modifiedAt > 0 && (
          <span className="meta-tag date">{formatDate(asset.modifiedAt)}</span>
        )}
      </div>

      {/* Actions */}
      <div className="asset-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="action-btn"
          onClick={onPreview}
          title="Preview"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <button
          type="button"
          className="action-btn danger"
          onClick={onDelete}
          title="Delete"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Drag hint */}
      <div className="drag-hint">
        Drag to copy to another project
      </div>
    </div>
  );
}
