import type { MarketplaceResource } from '../../types';
import { getCategoryGradient, getCategoryIcon, hasDuckAvatar, getDuckAvatarUrl } from './StoreIcons';

interface StoreFeaturedCardProps {
  resource: MarketplaceResource;
  installed: boolean;
  onInstall: (resource: MarketplaceResource) => void;
  onViewDetails: (resource: MarketplaceResource) => void;
}

export default function StoreFeaturedCard({
  resource, installed, onInstall, onViewDetails,
}: StoreFeaturedCardProps) {
  const gradient = getCategoryGradient(resource.category);

  return (
    <div
      className="store-featured-card"
      onClick={() => onViewDetails(resource)}
      style={{
        background: `linear-gradient(135deg, ${extractColor(gradient, 0)} 0%, transparent 70%)`,
      }}
    >
      <div className="store-featured-label">FEATURED</div>

      <div className="store-featured-content">
        {hasDuckAvatar(resource.icon) ? (
          <img
            src={getDuckAvatarUrl(resource.icon!)}
            alt={resource.name}
            className="store-featured-avatar"
          />
        ) : (
          <div
            className="store-featured-icon"
            style={{ background: gradient }}
          >
            {getCategoryIcon(resource.category, 20)}
          </div>
        )}

        <div className="store-featured-info">
          <div className="store-featured-name">{resource.name}</div>
          <div className="store-featured-desc">{resource.description}</div>
        </div>

        <button
          type="button"
          className={`store-get-btn ${installed ? 'store-get-btn-remove' : 'store-get-btn-get'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!installed) onInstall(resource);
          }}
        >
          {installed ? 'Installed' : 'Get'}
        </button>
      </div>
    </div>
  );
}

// Extract first color from gradient string for background tint
function extractColor(gradient: string, index: number): string {
  const colors = gradient.match(/#[0-9a-fA-F]{6}/g);
  if (colors && colors[index]) {
    return `${colors[index]}15`; // 15 = ~8% opacity hex
  }
  return 'rgba(255,255,255,0.04)';
}
