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
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'agents':
        return '🦆';
      case 'commands':
        return '⌘';
      case 'hooks':
        return '🪝';
      case 'settings':
        return '⚙️';
      case 'mcp':
        return '🔌';
      case 'stacks':
        return '📚';
      case 'skills':
        return '⭐';
      default:
        return '📦';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'agents':
        return '#f28c52'; // Orange
      case 'commands':
        return '#3b82f6'; // Blue
      case 'hooks':
        return '#8b5cf6'; // Purple
      case 'settings':
        return '#6b7280'; // Gray
      case 'mcp':
        return '#10b981'; // Green
      case 'stacks':
        return '#f59e0b'; // Amber
      case 'skills':
        return '#ec4899'; // Pink
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      className="marketplace-card"
      style={{
        background: 'rgba(20, 24, 32, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={() => onViewDetails(resource)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(242, 140, 82, 0.08)';
        e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.2)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(242, 140, 82, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(20, 24, 32, 0.8)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Badges Row */}
      <div className="flex items-center gap-2 mb-3">
        {/* Category Badge */}
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{
            background: `${getCategoryColor(resource.category)}20`,
            color: getCategoryColor(resource.category),
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{getCategoryIcon(resource.category)}</span>
          {resource.category}
        </span>

        {/* Verified Badge */}
        {resource.verified && (
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ✓ Verified
          </span>
        )}

        {/* Featured Badge */}
        {resource.featured && (
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              background: 'rgba(251, 191, 36, 0.1)',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ⭐ Featured
          </span>
        )}

        {/* Favorite Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(resource.id);
          }}
          className="ml-auto"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {favorited ? '❤️' : '🤍'}
        </button>
      </div>

      {/* Resource Name */}
      <h4
        className="text-base font-semibold mb-2"
        style={{ color: 'rgba(255, 255, 255, 0.9)' }}
      >
        {resource.name}
      </h4>

      {/* Description */}
      <p
        className="text-sm mb-3"
        style={{
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {resource.description}
      </p>

      {/* Author and Stats */}
      <div
        className="flex items-center gap-4 text-xs mb-3"
        style={{ color: 'rgba(255, 255, 255, 0.5)' }}
      >
        <div className="flex items-center gap-1">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          </svg>
          {resource.author}
        </div>

        <div className="flex items-center gap-1">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {resource.installCount}
        </div>

        {resource.rating && (
          <div className="flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ color: '#fbbf24' }}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {resource.rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {resource.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded text-xs"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            #{tag}
          </span>
        ))}
        {resource.tags.length > 3 && (
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            +{resource.tags.length - 3}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {installed ? (
          <button
            type="button"
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#22c55e',
              cursor: 'default',
            }}
          >
            ✓ Installed
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInstall(resource);
            }}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: 'rgba(242, 140, 82, 0.1)',
              border: '1px solid rgba(242, 140, 82, 0.3)',
              color: '#f28c52',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(242, 140, 82, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(242, 140, 82, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.3)';
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
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'rgba(255, 255, 255, 0.9)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
        >
          Details
        </button>
      </div>
    </div>
  );
}
