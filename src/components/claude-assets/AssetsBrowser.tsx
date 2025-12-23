/**
 * AssetsBrowser - Grid display of assets with filtering
 */

import AssetCard from './AssetCard';
import type { ClaudeAsset } from '../../types/claudeAssets';
import './AssetsBrowser.css';

interface AssetsBrowserProps {
  assets: ClaudeAsset[];
  selectedAsset: ClaudeAsset | null;
  onSelectAsset: (asset: ClaudeAsset | null) => void;
  onPreview: (asset: ClaudeAsset) => void;
  onDelete: (asset: ClaudeAsset) => void;
}

export default function AssetsBrowser({
  assets,
  selectedAsset,
  onSelectAsset,
  onPreview,
  onDelete,
}: AssetsBrowserProps) {
  if (assets.length === 0) {
    return (
      <div className="assets-browser empty">
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No assets found</h3>
          <p>Select a project from the sidebar or adjust your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assets-browser">
      <div className="assets-grid">
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            isSelected={selectedAsset?.id === asset.id}
            onSelect={() => onSelectAsset(asset)}
            onPreview={() => onPreview(asset)}
            onDelete={() => onDelete(asset)}
          />
        ))}
      </div>
    </div>
  );
}
