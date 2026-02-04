import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useMarketplace } from '../hooks/useMarketplace';
import { useSessionStore } from '../stores/sessionStore';
import type { MarketplaceCategory, MarketplaceResource } from '../types';
import MarketplaceInstallModal from './MarketplaceInstallModal';
import './AddonsDrawer.css';

/**
 * AddonsDrawer - Codex-style minimal addons browser
 * Two sections: Installed and Recommended
 * Minimal rows with gradient icons (no emoji)
 */

interface AddonsDrawerProps {
  onClose: () => void;
  onRefresh?: () => void;
}

type AddonTab = 'all' | 'skills' | 'agents' | 'droids' | 'rules' | 'mcp' | 'hooks' | 'snippets';

const TAB_CONFIG: Array<{ value: AddonTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'skills', label: 'Skills' },
  { value: 'agents', label: 'Agents' },
  { value: 'droids', label: 'Droids' },
  { value: 'rules', label: 'Rules' },
  { value: 'mcp', label: 'MCP' },
  { value: 'hooks', label: 'Hooks' },
  { value: 'snippets', label: 'Snippets' },
];

// Category-specific gradients - each addon type has its own color
const CATEGORY_GRADIENTS: Record<string, string> = {
  skills: 'linear-gradient(135deg, #f28c52, #e67339)',       // Orange - main accent
  agents: 'linear-gradient(135deg, #f28c52, #fbbf24)',       // Orange/Yellow - personas
  'agent-bundles': 'linear-gradient(135deg, #f28c52, #fbbf24)',
  droids: 'linear-gradient(135deg, #4ecdc4, #26a69a)',       // Teal - automation
  rules: 'linear-gradient(135deg, #60a5fa, #3b82f6)',        // Blue - governance
  hooks: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',        // Purple - events
  mcp: 'linear-gradient(135deg, #34d399, #10b981)',          // Green - servers
  commands: 'linear-gradient(135deg, #f472b6, #ec4899)',     // Pink - snippets
  snippets: 'linear-gradient(135deg, #f472b6, #ec4899)',     // Pink - snippets
  default: 'linear-gradient(135deg, #6b7280, #4b5563)',      // Gray - fallback
};

function getCategoryGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.default;
}


// Icons - EXACT COPIES from SidePanelAccordion for uniformity
function getCategoryIcon(category: string): React.ReactElement {
  const iconStyle = { width: 14, height: 14, color: 'white' };

  switch (category) {
    case 'skills':
      // Star icon - matches SidePanel skills icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'agents':
    case 'agent-bundles':
      // Person icon for agents (personas)
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <circle cx="10" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 17a5 5 0 0 1 10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'droids':
      // Robot icon - matches SidePanel agents/droids icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
          <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
          <line x1="7.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'rules':
      // Document with checkmarks - matches SidePanel rules icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M4 3h8l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 10l1.5 1.5L9 9M5 14l1.5 1.5L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'hooks':
      // Hook icon - matches SidePanel hooks icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M10 3v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 10c0 2.5-2 4-4 4s-4-1.5-4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="3" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'mcp':
      // Server/MCP icon - matches SidePanel mcp icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="8" r="1.5" fill="currentColor" />
          <circle cx="13" cy="8" r="1.5" fill="currentColor" />
          <path d="M7 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'commands':
    case 'snippets':
      // Terminal/commands icon - matches SidePanel commands icon
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 7l2 2-2 2M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" style={iconStyle}>
          <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

export default function AddonsDrawer({ onClose, onRefresh }: AddonsDrawerProps) {
  const {
    allResources,
    library,
    loading,
    error,
    loadResources,
    installResource,
    uninstallResource,
    isInstalled,
  } = useMarketplace();

  const selectedSession = useSessionStore((s) => s.getSelectedSession());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<AddonTab>('all');
  const [selectedResource, setSelectedResource] = useState<MarketplaceResource | null>(null);

  // Filter resources based on active tab
  const filteredResources = useMemo(() => {
    let filtered = allResources;

    if (activeTab !== 'all') {
      const categoryMap: Record<AddonTab, MarketplaceCategory[]> = {
        all: [],
        skills: ['skills'],
        agents: ['agents', 'agent-bundles'],
        droids: ['droids'],
        rules: ['rules'],
        mcp: ['mcp'],
        hooks: ['hooks'],
        snippets: ['commands'], // snippets maps to commands for now
      };
      const cats = categoryMap[activeTab];
      if (cats.length > 0) {
        filtered = filtered.filter(r => cats.includes(r.category));
      }
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

  // Split into installed and recommended
  const installedResources = filteredResources.filter(r => isInstalled(r.id));
  const recommendedResources = filteredResources.filter(r => !isInstalled(r.id));

  const handleTabChange = (tab: AddonTab) => {
    setActiveTab(tab);
    // Don't set category filter in hook - let local filtering handle it
    // This allows mapping one tab to multiple categories (e.g., agents -> ['agents', 'agent-bundles'])
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleInstall = async (resource: MarketplaceResource, scope: 'global' | 'project' = 'global') => {
    const projectPath = selectedSession?.projectPath;
    const toastId = toast.loading(`Installing ${resource.name}...`);

    try {
      const success = await installResource(resource, scope, projectPath);
      if (success) {
        toast.success(`${resource.name} installed`, { id: toastId, duration: 4000 });
        onRefresh?.();
        return true;
      }
      return false;
    } catch (err) {
      toast.error(`Failed to install`, { id: toastId });
      return false;
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
    } catch (err) {
      toast.error(`Failed to remove`, { id: toastId });
      return false;
    }
  };

  const handleNewAddon = () => {
    // TODO: Open modal to create new addon via skill-creator
    toast.info('Create new addon coming soon');
  };

  const handleRefresh = async () => {
    await loadResources();
    onRefresh?.();
  };

  return (
    <div className="addons-drawer">
      {/* Header */}
      <div className="addons-header">
        <div className="addons-header-top">
          <h2 className="addons-title">Addons</h2>
          <div className="addons-header-actions">
            <button
              type="button"
              className="addons-btn addons-btn-close"
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="addons-search">
          <svg className="addons-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search addons..."
            className="addons-search-input"
          />
        </div>

        {/* Tabs */}
        <div className="addons-tabs">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`addons-tab ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="addons-content">
        {loading && (
          <div className="addons-loading">Loading addons...</div>
        )}

        {error && (
          <div className="addons-error">
            <p>Error loading addons</p>
            <button type="button" onClick={handleRefresh} className="addons-btn">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Installed Section */}
            {installedResources.length > 0 && (
              <div className="addons-section">
                <h3 className="addons-section-title">Installed</h3>
                <div className="addons-list">
                  {installedResources.map((resource) => (
                    <AddonRow
                      key={resource.id}
                      resource={resource}
                      installed={true}
                      onInstall={handleInstall}
                      onUninstall={handleUninstall}
                      onViewDetails={setSelectedResource}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Section */}
            {recommendedResources.length > 0 && (
              <div className="addons-section">
                <h3 className="addons-section-title">Recommended</h3>
                <div className="addons-list">
                  {recommendedResources.map((resource) => (
                    <AddonRow
                      key={resource.id}
                      resource={resource}
                      installed={false}
                      onInstall={handleInstall}
                      onUninstall={handleUninstall}
                      onViewDetails={setSelectedResource}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {filteredResources.length === 0 && (
              <div className="addons-empty">
                {searchQuery ? 'No addons match your search' : 'No addons available'}
              </div>
            )}
          </>
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

// Minimal addon row component
interface AddonRowProps {
  resource: MarketplaceResource;
  installed: boolean;
  onInstall: (resource: MarketplaceResource) => void;
  onUninstall: (resourceId: string) => Promise<boolean>;
  onViewDetails: (resource: MarketplaceResource) => void;
}

function AddonRow({ resource, installed, onInstall, onUninstall, onViewDetails }: AddonRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="addon-row"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onViewDetails(resource)}
    >
      {/* Gradient Icon */}
      <div
        className="addon-icon"
        style={{ background: getCategoryGradient(resource.category) }}
      >
        {getCategoryIcon(resource.category)}
      </div>

      {/* Info */}
      <div className="addon-info">
        <div className="addon-name">{resource.name}</div>
        <div className="addon-description">{resource.description}</div>
      </div>

      {/* Action */}
      <div className={`addon-action ${isHovered ? 'visible' : ''}`}>
        {installed ? (
          <button
            type="button"
            className="addon-btn-action addon-btn-installed"
            onClick={(e) => {
              e.stopPropagation();
              onUninstall(resource.id);
            }}
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            className="addon-btn-action addon-btn-install"
            onClick={(e) => {
              e.stopPropagation();
              onInstall(resource);
            }}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
