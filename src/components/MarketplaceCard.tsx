import type { MarketplaceResource } from '../types';

/**
 * MarketplaceCard - Individual resource card for marketplace
 * Displays resource info, stats, and action buttons
 */

interface MarketplaceCardProps {
  resource: MarketplaceResource;
  installed: boolean;
  favorited: boolean;
  onInstall: (resource: MarketplaceResource) => void;
  onViewDetails: (resource: MarketplaceResource) => void;
  onToggleFavorite: (resourceId: string) => void;
}

export default function MarketplaceCard({
  resource,
  installed,
  favorited,
  onInstall,
  onViewDetails,
  onToggleFavorite,
}: MarketplaceCardProps) {
  // Unified accent color for all categories
  const getCategoryColor = (_category: string) => {
    return '#f28c52';
  };

  /** Icons matching SidePanel.tsx tab icons */
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'skills':
        return (
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 11v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case 'agents':
      case 'agent-bundles':
        return (
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="2" r="1" fill="currentColor" />
            <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
            <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
            <line x1="7.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case 'rules':
        return (
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M4 3h8l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 10l1.5 1.5L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 14l1.5 1.5L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'commands':
        return (
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 7l2 2-2 2M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="14" cy="7" r="1.5" fill="currentColor" />
          </svg>
        );
      case 'hooks':
        return (
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M10 3v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10 10c0 2.5-2 4-4 4s-4-1.5-4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="3" r="1.5" fill="currentColor" />
            <circle cx="15" cy="7" r="1.5" fill="currentColor" />
            <circle cx="17" cy="11" r="1.5" fill="currentColor" />
            <path d="M10 6l5 1M10 8l7 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 1" />
          </svg>
        );
      case 'mcp':
        return (
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7" cy="8" r="1.5" fill="currentColor" />
            <circle cx="13" cy="8" r="1.5" fill="currentColor" />
            <path d="M7 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
    }
  };

  /** Display label - "agents" becomes "droids" */
  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'agents': return 'droids';
      case 'agent-bundles': return 'bundles';
      default: return category;
    }
  };

  const catColor = getCategoryColor(resource.category);

  return (
    <div
      className="marketplace-card"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: `3px solid ${catColor}`,
        borderRadius: '10px',
        padding: '14px 14px 14px 16px',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={() => onViewDetails(resource)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        e.currentTarget.style.borderLeftColor = catColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.borderLeftColor = catColor;
      }}
    >
      {/* Top Row: Icon + Name + Favorite */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: `${catColor}18`,
              color: catColor,
              flexShrink: 0,
            }}
          >
            {getCategoryIcon(resource.category)}
          </div>
          <h4
            className="text-sm font-semibold"
            style={{ color: 'rgba(255, 255, 255, 0.9)' }}
          >
            {resource.name}
          </h4>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(resource.id);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: favorited ? '#f28c52' : 'rgba(255, 255, 255, 0.2)',
            transition: 'color 0.15s ease',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Description */}
      <p
        className="text-xs mb-2.5"
        style={{
          color: 'rgba(255, 255, 255, 0.5)',
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {resource.description}
      </p>

      {/* Meta Row: Category + Author + Version */}
      <div className="flex items-center gap-2 mb-3" style={{ fontSize: '11px' }}>
        <span
          className="px-1.5 py-0.5 rounded"
          style={{
            background: `${catColor}15`,
            color: catColor,
            fontWeight: 500,
          }}
        >
          {getCategoryLabel(resource.category)}
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.35)' }}>
          {resource.author}
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>
          v{resource.version}
        </span>
        {resource.featured && (
          <span style={{ color: '#fbbf24', fontWeight: 500 }}>
            Featured
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {installed ? (
          <button
            type="button"
            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              color: '#4ade80',
              cursor: 'default',
              letterSpacing: '0.02em',
            }}
          >
            Installed
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInstall(resource);
            }}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
            style={{
              background: '#f28c52',
              border: '1px solid #f28c52',
              color: '#0c1018',
              letterSpacing: '0.02em',
              boxShadow: '0 2px 8px rgba(242, 140, 82, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9a06e';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(242, 140, 82, 0.45)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f28c52';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(242, 140, 82, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Install
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(resource);
          }}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.6)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
        >
          Details
        </button>
      </div>
    </div>
  );
}
