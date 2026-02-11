import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useMarketplace } from '../hooks/useMarketplace';
import type { MarketplaceResource } from '../types';
import type { ActiveProject } from './modal-steps/types';
import type { StoreTab } from './store/storeConstants';
import { CATEGORY_MAP } from './store/storeConstants';
import StoreSidebar from './store/StoreSidebar';
import StoreMainContent from './store/StoreMainContent';
import MarketplaceInstallModal from './MarketplaceInstallModal';
import StoreProjectPickerModal from './store/StoreProjectPickerModal';
import './QuackStoreDrawer.css';

interface QuackStoreDrawerProps {
  onClose: () => void;
  onRefresh?: () => void;
  activeProjects?: ActiveProject[];
}

export default function QuackStoreDrawer({ onClose, onRefresh, activeProjects = [] }: QuackStoreDrawerProps) {
  const {
    allResources, loading, error, loadResources,
    installResource, uninstallResource, installAgentBundle, isInstalled,
  } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StoreTab>('all');
  const [selectedResource, setSelectedResource] = useState<MarketplaceResource | null>(null);

  // Project picker state for agent-bundle installs
  const [pendingBundleResource, setPendingBundleResource] = useState<MarketplaceResource | null>(null);

  const filteredResources = useMemo(() => {
    let filtered = allResources;
    const cats = CATEGORY_MAP[activeTab];
    if (cats.length > 0) {
      filtered = filtered.filter(r => cats.includes(r.category));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allResources, activeTab, searchQuery]);

  const sortedResources = useMemo(() => {
    return [...filteredResources].sort((a, b) => {
      const aFeatured = a.featured ? 1 : 0;
      const bFeatured = b.featured ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;
      const aInstalled = isInstalled(a.id) ? 1 : 0;
      const bInstalled = isInstalled(b.id) ? 1 : 0;
      if (aInstalled !== bInstalled) return bInstalled - aInstalled;
      return a.name.localeCompare(b.name);
    });
  }, [filteredResources, isInstalled]);

  const featuredResources = useMemo(() => {
    if (activeTab !== 'all' || searchQuery) return [];
    return allResources.filter(r => r.featured);
  }, [allResources, activeTab, searchQuery]);

  const handleInstall = async (resource: MarketplaceResource, scope: 'global' | 'project' = 'global') => {
    // For agent-bundles, show project picker instead of installing directly
    if (resource.category === 'agent-bundles') {
      setPendingBundleResource(resource);
      return true; // Signal that we handled it (picker will do the actual install)
    }
    const toastId = toast.loading(`Installing ${resource.name}...`);
    try {
      const success = await installResource(resource, scope);
      if (success) {
        toast.success(`${resource.name} installed`, { id: toastId, duration: 4000 });
        onRefresh?.();
        return true;
      }
      return false;
    } catch {
      toast.error('Failed to install', { id: toastId });
      return false;
    }
  };

  const handleProjectSelected = async (projectPath: string, projectName: string) => {
    if (!pendingBundleResource) return;
    const resource = pendingBundleResource;
    setPendingBundleResource(null);

    const toastId = toast.loading(`Installing ${resource.name}...`);
    try {
      await installAgentBundle(resource, projectPath, projectName);
      toast.success(`${resource.name} installed in ${projectName}`, { id: toastId, duration: 4000 });
      onRefresh?.();
    } catch {
      toast.error('Failed to install', { id: toastId });
    }
  };

  const handleUninstall = async (resourceId: string) => {
    const resource = allResources.find(r => r.id === resourceId);
    const name = resource?.name || 'Resource';
    const toastId = toast.loading(`Removing ${name}...`);
    try {
      const success = await uninstallResource(resourceId);
      if (success) {
        toast.success(`${name} removed`, { id: toastId, duration: 3000 });
        onRefresh?.();
        return true;
      }
      return false;
    } catch {
      toast.error('Failed to remove', { id: toastId });
      return false;
    }
  };

  const handleRefresh = async () => {
    await loadResources();
    onRefresh?.();
  };

  return (
    <div className="quack-store-drawer">
      <StoreSidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={onClose}
      />
      <StoreMainContent
        loading={loading}
        error={error}
        featuredResources={featuredResources}
        sortedResources={sortedResources}
        activeTab={activeTab}
        searchQuery={searchQuery}
        isInstalled={isInstalled}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        onViewDetails={setSelectedResource}
        onRefresh={handleRefresh}
      />
      {selectedResource && (
        <MarketplaceInstallModal
          resource={selectedResource}
          installed={isInstalled(selectedResource.id)}
          onClose={() => setSelectedResource(null)}
          onInstall={handleInstall}
          onUninstall={handleUninstall}
          activeProjects={activeProjects}
        />
      )}
      {pendingBundleResource && (
        <StoreProjectPickerModal
          projects={activeProjects}
          resourceName={pendingBundleResource.name}
          onSelect={handleProjectSelected}
          onCancel={() => setPendingBundleResource(null)}
        />
      )}
    </div>
  );
}
