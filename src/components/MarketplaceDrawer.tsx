import { useState } from 'react';
import { toast } from 'sonner';
import { useMarketplace } from '../hooks/useMarketplace';
import { useSessionStore } from '../stores/sessionStore';
import type { MarketplaceCategory, MarketplaceResource } from '../types';
import MarketplaceCard from './MarketplaceCard';
import MarketplaceInstallModal from './MarketplaceInstallModal';

/**
 * MarketplaceDrawer - Fetches plugins from quack-marketplace GitHub repo
 * Dynamically shows categories based on what the repo contains
 */

interface MarketplaceDrawerProps {
  onRefresh?: () => void;
}

const CATEGORY_META: Record<MarketplaceCategory, { label: string }> = {
  skills: { label: 'Skills' },
  agents: { label: 'Agents' },
  droids: { label: 'Droids' },
  commands: { label: 'Commands' },
  hooks: { label: 'Hooks' },
  settings: { label: 'Settings' },
  mcp: { label: 'MCP' },
  stacks: { label: 'Stacks' },
  rules: { label: 'Rules' },
  'agent-bundles': { label: 'Bundles' },
};

export default function MarketplaceDrawer({
  onRefresh,
}: MarketplaceDrawerProps) {
  const {
    resources,
    library,
    loading,
    error,
    filters,
    setFilters,
    categories,
    loadResources,
    installResource,
    uninstallResource,
    toggleFavorite,
    isInstalled,
    isFavorite,
  } = useMarketplace();

  const selectedSession = useSessionStore((s) => s.getSelectedSession());

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<MarketplaceResource | null>(null);

  // Build dynamic category tabs from what the repo actually contains
  const categoryTabs: Array<{ value: MarketplaceCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    ...categories.map(cat => ({
      value: cat,
      label: CATEGORY_META[cat]?.label || cat,
    })),
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

  const handleInstall = async (resource: MarketplaceResource, scope: 'global' | 'project' = 'global') => {
    const projectPath = selectedSession?.projectPath;
    const toastId = toast.loading(`Installing ${resource.name}...`, {
      description: scope === 'project' ? 'Installing to project...' : 'Installing globally...',
    });

    try {
      const success = await installResource(resource, scope, projectPath);
      if (success) {
        const location = scope === 'project' && projectPath
          ? `${selectedSession?.projectName}/.claude/${resource.category}/`
          : `~/.claude/${resource.category}/`;
        toast.success(`${resource.name} installed!`, {
          id: toastId,
          description: `Saved to ${location}`,
          duration: 5000,
        });
        onRefresh?.();
        return true;
      }
      return false;
    } catch (err) {
      toast.error(`Failed to install ${resource.name}`, {
        id: toastId,
        description: err instanceof Error ? err.message : 'Unknown error',
        duration: 6000,
      });
      return false;
    }
  };

  const handleUninstall = async (resourceId: string) => {
    const resource = resources.find(r => r.id === resourceId);
    const name = resource?.name || 'Resource';
    const toastId = toast.loading(`Uninstalling ${name}...`);

    try {
      const success = await uninstallResource(resourceId);
      if (success) {
        toast.success(`${name} uninstalled`, { id: toastId, duration: 4000 });
        onRefresh?.();
        return true;
      }
      return false;
    } catch (err) {
      toast.error(`Failed to uninstall ${name}`, {
        id: toastId,
        description: err instanceof Error ? err.message : 'Unknown error',
        duration: 5000,
      });
      return false;
    }
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
        className="px-3 py-2.5 border-b"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: '#f28c52' }}>
              Marketplace
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
            {loading ? '...' : 'Refresh'}
          </button>
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
        className="px-3 py-2 border-b overflow-x-auto"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categoryTabs.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleCategoryChange(cat.value)}
              className="px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-all duration-200"
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
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-8">
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
            <p
              className="text-sm"
              style={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              {searchQuery
                ? 'No resources found matching your search'
                : 'No resources available'}
            </p>
          </div>
        )}

        {!loading && !error && displayedResources.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-4 pt-3">
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
    </div>
  );
}
