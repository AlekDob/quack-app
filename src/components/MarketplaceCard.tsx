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
        borderRadius: '10px',
        padding: '12px',
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
      <div className="flex items-center gap-1.5 mb-2">
        {/* Category Badge */}
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{
            background: `${getCategoryColor(resource.category)}20`,
            color: getCategoryColor(resource.category),
          }}
        >
          {resource.category}
        </span>

        {/* Verified Badge */}
        {resource.verified && (
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#22c55e',
            }}
          >
            Verified
          </span>
        )}

        {/* Featured Badge */}
        {resource.featured && (
          <span
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              background: 'rgba(251, 191, 36, 0.1)',
              color: '#fbbf24',
            }}
          >
            Featured
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
            padding: '4px',
            transition: 'transform 0.2s ease',
            color: favorited ? '#f28c52' : 'rgba(255, 255, 255, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Resource Name */}
      <h4
        className="text-sm font-semibold mb-1"
        style={{ color: 'rgba(255, 255, 255, 0.9)' }}
      >
        {resource.name}
      </h4>

      {/* Description */}
      <p
        className="text-xs mb-2"
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

      {/* Author */}
      <div
        className="flex items-center gap-1.5 text-xs mb-2"
        style={{ color: 'rgba(255, 255, 255, 0.5)' }}
      >
        <svg
          width="12"
          height="12"
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

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
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
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#22c55e',
              cursor: 'default',
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
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
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
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
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
