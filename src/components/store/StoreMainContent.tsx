import { useMemo } from 'react';
import type { MarketplaceCategory, MarketplaceResource } from '../../types';
import type { StoreTab } from './storeConstants';
import { TAB_CONFIG } from './storeConstants';
import { getCategoryIcon } from './StoreIcons';
import StoreHeroBanner from './StoreHeroBanner';
import StoreFeaturedCard from './StoreFeaturedCard';
import StoreItemCard from './StoreItemCard';
import StoreEmptyState from './StoreEmptyState';

// Order and labels for grouped display
const CATEGORY_GROUP_ORDER: { categories: MarketplaceCategory[]; label: string }[] = [
  { categories: ['skills'], label: 'Skills' },
  { categories: ['agents', 'agent-bundles'], label: 'Agents' },
  { categories: ['droids'], label: 'Droids' },
  { categories: ['rules'], label: 'Rules' },
  { categories: ['commands'], label: 'Commands' },
  { categories: ['mcp'], label: 'MCP Servers' },
  { categories: ['hooks'], label: 'Hooks' },
];

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

interface GroupedItemsProps {
  resources: MarketplaceResource[];
  isInstalled: (id: string) => boolean;
  onInstall: (resource: MarketplaceResource, scope?: 'global' | 'project') => Promise<boolean>;
  onUninstall: (resourceId: string) => Promise<boolean>;
  onViewDetails: (resource: MarketplaceResource) => void;
}

function GroupedItems({ resources, isInstalled, onInstall, onUninstall, onViewDetails }: GroupedItemsProps) {
  const groups = useMemo(() => {
    return CATEGORY_GROUP_ORDER
      .map((group) => ({
        ...group,
        items: resources.filter(r => group.categories.includes(r.category)),
      }))
      .filter(g => g.items.length > 0);
  }, [resources]);

  return (
    <div className="store-grouped-items">
      {groups.map((group, idx) => (
        <div key={group.label} className="store-category-group">
          <div className="store-category-header">
            <span className="store-category-icon">
              {getCategoryIcon(group.categories[0], 16)}
            </span>
            <span className="store-category-label">{group.label}</span>
            <span className="store-category-count">{group.items.length}</span>
          </div>
          <div className="store-item-grid">
            {group.items.map((r) => (
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
          {idx < groups.length - 1 && <div className="store-category-divider" />}
        </div>
      ))}
    </div>
  );
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
  const showGrouped = activeTab === 'all' && !searchQuery;

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
        showGrouped ? (
          <GroupedItems
            resources={sortedResources}
            isInstalled={isInstalled}
            onInstall={onInstall}
            onUninstall={onUninstall}
            onViewDetails={onViewDetails}
          />
        ) : (
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
        )
      ) : (
        <StoreEmptyState
          type={searchQuery ? 'no-results' : 'empty'}
          query={searchQuery}
        />
      )}
    </div>
  );
}
