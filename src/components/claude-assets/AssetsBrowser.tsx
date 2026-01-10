/**
 * AssetsBrowser - Grid display of assets with filtering
 * Supports both single project view and grouped cross-project search results
 */

import AssetCard from './AssetCard';
import type { ClaudeAsset, GroupedSearchResults } from '../../types/claudeAssets';
import './AssetsBrowser.css';

interface AssetsBrowserProps {
  assets: ClaudeAsset[];
  selectedAsset: ClaudeAsset | null;
  onSelectAsset: (asset: ClaudeAsset | null) => void;
  onPreview: (asset: ClaudeAsset) => void;
  onDelete: (asset: ClaudeAsset) => void;
  // Global search props
  isGlobalSearch?: boolean;
  globalSearchResults?: GroupedSearchResults[];
  onSelectProject?: (projectPath: string) => void;
}

export default function AssetsBrowser({
  assets,
  selectedAsset,
  onSelectAsset,
  onPreview,
  onDelete,
  isGlobalSearch = false,
  globalSearchResults = [],
  onSelectProject,
}: AssetsBrowserProps) {
  // Global search mode - show grouped results
  if (isGlobalSearch) {
    const totalResults = globalSearchResults.reduce((sum, g) => sum + g.totalCount, 0);

    if (totalResults === 0) {
      return (
        <div className="assets-browser empty">
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No results found</h3>
            <p>Try a different search term</p>
          </div>
        </div>
      );
    }

    return (
      <div className="assets-browser global-search">
        <div className="search-summary">
          Found {totalResults} asset{totalResults !== 1 ? 's' : ''} in {globalSearchResults.length} project{globalSearchResults.length !== 1 ? 's' : ''}
        </div>
        {globalSearchResults.map((group) => (
          <div key={group.projectPath} className="project-group">
            <div
              className="project-group-header"
              onClick={() => onSelectProject?.(group.projectPath)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectProject?.(group.projectPath);
                }
              }}
            >
              <span className="project-name">{group.projectName}</span>
              <span className="project-count">{group.totalCount}</span>
            </div>
            <div className="assets-grid">
              {group.assets.map((asset) => (
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
        ))}
      </div>
    );
  }

  // Single project mode - show flat list
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
