import type { StoreTab } from './storeConstants';
import { TAB_CONFIG } from './storeConstants';
import { getCategoryIcon, getDiscoverIcon } from './StoreIcons';

interface StoreSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: StoreTab;
  onTabChange: (tab: StoreTab) => void;
  onClose: () => void;
}

function NavIcon({ tab }: { tab: StoreTab }) {
  if (tab === 'all') return getDiscoverIcon(16);
  return getCategoryIcon(tab, 16);
}

export default function StoreSidebar({
  searchQuery, onSearchChange, activeTab, onTabChange, onClose,
}: StoreSidebarProps) {
  return (
    <div className="store-sidebar">
      <div className="store-sidebar-header">
        <h2 className="store-sidebar-title">Quack Store</h2>
        <button
          type="button"
          className="store-sidebar-close"
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="store-sidebar-search">
        <svg className="store-sidebar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="store-sidebar-search-input"
        />
      </div>

      <nav className="store-sidebar-nav">
        <div className="store-sidebar-nav-section">
          <button
            type="button"
            className={`store-sidebar-item ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => onTabChange('all')}
          >
            <span className="store-sidebar-item-icon">
              <NavIcon tab="all" />
            </span>
            Discover
          </button>
        </div>

        <div className="store-sidebar-nav-section">
          <span className="store-sidebar-section-label">Categories</span>
          {TAB_CONFIG.filter((t) => t.value !== 'all').map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`store-sidebar-item ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => onTabChange(tab.value)}
            >
              <span className="store-sidebar-item-icon">
                <NavIcon tab={tab.value} />
              </span>
              {tab.sidebarLabel}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
