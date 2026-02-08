import type { MarketplaceResource } from '../../types';
import type { StoreTab } from './storeConstants';
import { TAB_CONFIG } from './storeConstants';
import StoreHeroBanner from './StoreHeroBanner';
import StoreFeaturedCard from './StoreFeaturedCard';
import StoreItemCard from './StoreItemCard';
import StoreEmptyState from './StoreEmptyState';

interface StoreMainContentProps {
  loading: boolean;
  error: string | null;
  featuredResources: MarketplaceResource[];
  sortedResources: MarketplaceResource[];
  activeTab: StoreTab;
  searchQuery: string;
  isInstalled: (id: string) => boolean;
  onInstall: (resource: MarketplaceResource, scope?: 'global' | 'project') => Promise<boolean>;
  onUninstall: (resourceId: string) => Promise<boolean>;
  onViewDetails: (resource: MarketplaceResource) => void;
  onRefresh: () => void;
}

function getPageTitle(tab: StoreTab): string {
  const config = TAB_CONFIG.find((t) => t.value === tab);
  return config?.sidebarLabel ?? 'Discover';
}

export default function StoreMainContent({
  loading, error, featuredResources, sortedResources,
  activeTab, searchQuery, isInstalled,
  onInstall, onUninstall, onViewDetails, onRefresh,
}: StoreMainContentProps) {
  if (loading) {
    return (
      <div className="store-main-content">
        <StoreEmptyState type="loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="store-main-content">
        <StoreEmptyState type="error" onRetry={onRefresh} />
      </div>
    );
  }

  const heroResource = featuredResources[0] ?? null;
  const gridFeatured = featuredResources.slice(1);

  return (
    <div className="store-main-content">
      <div className="store-main-header">
        <h1 className="store-main-title">{getPageTitle(activeTab)}</h1>
        <p className="store-main-subtitle">
          {sortedResources.length} item{sortedResources.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {heroResource && (
        <StoreHeroBanner
          resource={heroResource}
          installed={isInstalled(heroResource.id)}
          onInstall={onInstall}
          onViewDetails={onViewDetails}
        />
      )}

      {gridFeatured.length > 0 && (
        <div className="store-featured-grid">
          {gridFeatured.map((r) => (
            <StoreFeaturedCard
              key={r.id}
              resource={r}
              installed={isInstalled(r.id)}
              onInstall={onInstall}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}

      {sortedResources.length > 0 ? (
        <div className="store-item-grid">
          {sortedResources.map((r) => (
            <StoreItemCard
              key={r.id}
              resource={r}
              installed={isInstalled(r.id)}
              onInstall={onInstall}
              onUninstall={onUninstall}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      ) : (
        <StoreEmptyState
          type={searchQuery ? 'no-results' : 'empty'}
          query={searchQuery}
        />
      )}
    </div>
  );
}
