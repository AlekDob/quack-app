import { useState } from 'react';
import { useMarketplace } from '../hooks/useMarketplace';
import type { MarketplaceCategory, MarketplaceResource } from '../types';
import MarketplaceCard from './MarketplaceCard';
import MarketplaceInstallModal from './MarketplaceInstallModal';
import MarketplaceContributeModal from './MarketplaceContributeModal';

/**
 * MarketplaceDrawer - Drawer version of the marketplace
 * Replaces the old PluginsPanel drawer
 */

interface MarketplaceDrawerProps {
  workingDir?: string;
  onRefresh?: () => void;
}

export default function MarketplaceDrawer({
  workingDir,
  onRefresh,
}: MarketplaceDrawerProps) {
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

  const categories: Array<{ value: MarketplaceCategory | 'all'; label: string; icon: string }> = [
    { value: 'all', label: 'All', icon: '🏪' },
    { value: 'agents', label: 'Agents', icon: '🦆' },
    { value: 'commands', label: 'Commands', icon: '⌘' },
    { value: 'hooks', label: 'Hooks', icon: '🪝' },
    { value: 'settings', label: 'Settings', icon: '⚙️' },
    { value: 'mcp', label: 'MCP', icon: '🔌' },
    { value: 'stacks', label: 'Stacks', icon: '📚' },
    { value: 'skills', label: 'Skills', icon: '⭐' },
  ];

  const handleCategoryChange = (category: MarketplaceCategory | 'all') => {
    setFilters({
      ...filters,
      category: category === 'all' ? undefined : category,
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
      onRefresh?.();
    }
    return success;
  };

  const handleUninstall = async (resourceId: string) => {
    const success = await uninstallResource(resourceId);
    if (success) {
      console.log('Resource uninstalled successfully');
      onRefresh?.();
    }
    return success;
  };

  const handleContribute = async (resource: Partial<MarketplaceResource>) => {
    console.log('Contributing resource:', resource);
    // In production, this would submit to the marketplace API
    alert('Thank you for your contribution! Your resource will be reviewed by our team.');
  };

  const handleRefresh = async () => {
    await loadResources();
    onRefresh?.();
  };

  const activeCategory = filters.category || 'all';
  const displayedResources = resources;
  const installedCount = library.installedResources.length;

  return (
    <div className="marketplace-drawer flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold" style={{ color: '#f28c52' }}>
              🛍️ Marketplace
            </h3>
            {installedCount > 0 && (
              <div
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                }}
              >
                {installedCount} installed
              </div>
            )}
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
              onClick={handleRefresh}
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 transform -translate-y-1/2"
            style={{ color: 'rgba(255, 255, 255, 0.5)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-10 pr-4 py-2 rounded text-sm"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div
        className="px-4 py-3 border-b overflow-x-auto"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleCategoryChange(cat.value)}
              className="px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all duration-200"
              style={{
                background: activeCategory === cat.value
                  ? 'rgba(242, 140, 82, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${activeCategory === cat.value
                  ? 'rgba(242, 140, 82, 0.4)'
                  : 'rgba(255, 255, 255, 0.12)'}`,
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-12">
        {loading && (
          <div
            className="flex items-center justify-center py-8 text-sm"
            style={{ color: 'rgba(255, 255, 255, 0.6)' }}
          >
            Loading marketplace...
          </div>
        )}

        {error && (
          <div className="p-4">
            <div
              className="p-3 rounded-lg text-sm"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
              }}
            >
              <p className="font-medium mb-1">Error loading marketplace</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && displayedResources.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <p
              className="text-sm"
              style={{ color: 'rgba(255, 255, 255, 0.6)' }}
            >
              {searchQuery
                ? 'No resources found matching your search'
                : 'No resources available'}
            </p>
          </div>
        )}

        {!loading && !error && displayedResources.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8 pt-4">
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
