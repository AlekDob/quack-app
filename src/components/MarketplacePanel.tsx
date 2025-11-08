import { useState } from 'react';
import { useMarketplace } from '../hooks/useMarketplace';
import type { MarketplaceCategory, MarketplaceResource } from '../types';
import MarketplaceCard from './MarketplaceCard';
import MarketplaceInstallModal from './MarketplaceInstallModal';
import MarketplaceContributeModal from './MarketplaceContributeModal';

/**
 * MarketplacePanel - Main marketplace interface
 * Browse, search, and install resources from the community
 */

export default function MarketplacePanel() {
  const {
    resources,
    library,
    loading,
    error,
    filters,
    setFilters,
    loadResources,
    installResource,
    uninstallResource,
    toggleFavorite,
    isInstalled,
    isFavorite,
  } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<MarketplaceResource | null>(null);
  const [contributeModalOpen, setContributeModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories: Array<{ value: MarketplaceCategory | 'all' | 'favorites'; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: '🏪' },
    { value: 'favorites', label: 'Favorites', icon: '❤️' },
    { value: 'agents', label: 'Agents', icon: '🦆' },
    { value: 'commands', label: 'Commands', icon: '⌘' },
    { value: 'hooks', label: 'Hooks', icon: '🪝' },
    { value: 'settings', label: 'Settings', icon: '⚙️' },
    { value: 'mcp', label: 'MCP', icon: '🔌' },
    { value: 'stacks', label: 'Stacks', icon: '📚' },
    { value: 'skills', label: 'Skills', icon: '⭐' },
  ];

  const handleCategoryChange = (category: MarketplaceCategory | 'all' | 'favorites') => {
    setFilters({
      ...filters,
      category: category === 'all' || category === 'favorites' ? undefined : category,
      showFavoritesOnly: category === 'favorites',
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFilters({
      ...filters,
      searchQuery: query,
    });
  };

  const handleInstall = async (resource: MarketplaceResource) => {
    const success = await installResource(resource);
    if (success) {
      console.log('Resource installed successfully:', resource.name);
    }
    return success;
  };

  const handleUninstall = async (resourceId: string) => {
    const success = await uninstallResource(resourceId);
    if (success) {
      console.log('Resource uninstalled successfully');
    }
    return success;
  };

  const handleContribute = async (resource: Partial<MarketplaceResource>) => {
    console.log('Contributing resource:', resource);
    // In production, this would submit to the marketplace API
    alert('Thank you for your contribution! Your resource will be reviewed by our team.');
  };

  const activeCategory = filters.showFavoritesOnly ? 'favorites' : (filters.category || 'all');
  const displayedResources = filters.showFavoritesOnly
    ? resources.filter(r => isFavorite(r.id))
    : resources;

  return (
    <div className="marketplace-panel flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#f28c52' }}>
              🛍️ Marketplace
            </h3>
            <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
              Discover & install resources
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setContributeModalOpen(true)}
              className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200"
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
              }}
            >
              + Contribute
            </button>

            <button
              type="button"
              onClick={loadResources}
              disabled={loading}
              className="px-3 py-1.5 rounded text-xs font-medium transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.9)',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              {loading ? '...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full px-3 py-2 pl-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Category Tabs */}
      <div
        className="px-4 py-2 border-b overflow-x-auto"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex gap-1">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleCategoryChange(cat.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200"
              style={{
                background: activeCategory === cat.value
                  ? 'rgba(242, 140, 82, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${activeCategory === cat.value
                  ? 'rgba(242, 140, 82, 0.5)'
                  : 'rgba(255, 255, 255, 0.1)'}`,
                color: activeCategory === cat.value
                  ? '#f28c52'
                  : 'rgba(255, 255, 255, 0.7)',
              }}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Bar */}
      <div
        className="px-4 py-2 border-b flex items-center gap-3"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex items-center gap-2 flex-1">
          <button
            type="button"
            onClick={() => setFilters({ ...filters, verified: !filters.verified })}
            className="px-2 py-1 rounded text-xs transition-all duration-200"
            style={{
              background: filters.verified
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${filters.verified
                ? 'rgba(34, 197, 94, 0.5)'
                : 'rgba(255, 255, 255, 0.1)'}`,
              color: filters.verified ? '#22c55e' : 'rgba(255, 255, 255, 0.6)',
            }}
          >
            ✓ Verified
          </button>

          <button
            type="button"
            onClick={() => setFilters({ ...filters, featured: !filters.featured })}
            className="px-2 py-1 rounded text-xs transition-all duration-200"
            style={{
              background: filters.featured
                ? 'rgba(251, 191, 36, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${filters.featured
                ? 'rgba(251, 191, 36, 0.5)'
                : 'rgba(255, 255, 255, 0.1)'}`,
              color: filters.featured ? '#fbbf24' : 'rgba(255, 255, 255, 0.6)',
            }}
          >
            ⭐ Featured
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className="p-1.5 rounded transition-colors"
            style={{
              background: viewMode === 'grid'
                ? 'rgba(242, 140, 82, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              color: viewMode === 'grid' ? '#f28c52' : 'rgba(255, 255, 255, 0.6)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="p-1.5 rounded transition-colors"
            style={{
              background: viewMode === 'list'
                ? 'rgba(242, 140, 82, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              color: viewMode === 'list' ? '#f28c52' : 'rgba(255, 255, 255, 0.6)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div
            className="flex items-center justify-center py-8 text-sm"
            style={{ color: 'rgba(255, 255, 255, 0.6)' }}
          >
            Loading marketplace...
          </div>
        )}

        {error && (
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && displayedResources.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h4
              className="text-base font-semibold mb-2"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              No resources found
            </h4>
            <p
              className="text-sm"
              style={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              Try adjusting your filters or search query
            </p>
          </div>
        )}

        {!loading && !error && displayedResources.length > 0 && (
          <div
            className={viewMode === 'grid' ? 'grid gap-4' : 'space-y-3'}
            style={viewMode === 'grid' ? {
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            } : undefined}
          >
            {displayedResources.map((resource) => (
              <MarketplaceCard
                key={resource.id}
                resource={resource}
                installed={isInstalled(resource.id)}
                favorited={isFavorite(resource.id)}
                onInstall={handleInstall}
                onViewDetails={setSelectedResource}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {displayedResources.length > 0 && (
        <div
          className="px-4 py-2.5 border-t text-xs text-center"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          Showing {displayedResources.length} resource{displayedResources.length === 1 ? '' : 's'}
          {library.installedResources.length > 0 && (
            <> • {library.installedResources.length} installed</>
          )}
        </div>
      )}

      {/* Install Modal */}
      {selectedResource && (
        <MarketplaceInstallModal
          resource={selectedResource}
          installed={isInstalled(selectedResource.id)}
          onClose={() => setSelectedResource(null)}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
        />
      )}

      {/* Contribute Modal */}
      <MarketplaceContributeModal
        isOpen={contributeModalOpen}
        onClose={() => setContributeModalOpen(false)}
        onSubmit={handleContribute}
      />
    </div>
  );
}
