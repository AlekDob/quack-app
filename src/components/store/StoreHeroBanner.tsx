import type { MarketplaceResource } from '../../types';
import { getCategoryGradient, getCategoryIcon, hasDuckAvatar, getDuckAvatarUrl } from './StoreIcons';

interface StoreHeroBannerProps {
  resource: MarketplaceResource;
  installed: boolean;
  onInstall: (resource: MarketplaceResource) => void;
  onViewDetails: (resource: MarketplaceResource) => void;
}

export default function StoreHeroBanner({
  resource, installed, onInstall, onViewDetails,
}: StoreHeroBannerProps) {
  const gradient = getCategoryGradient(resource.category);
  const bgColor = extractHeroColor(gradient);

  return (
    <div
      className="store-hero-banner"
      onClick={() => onViewDetails(resource)}
      style={{ background: `linear-gradient(135deg, ${bgColor} 0%, transparent 60%)` }}
    >
      {hasDuckAvatar(resource.icon) ? (
        <img
          src={getDuckAvatarUrl(resource.icon!)}
          alt={resource.name}
          className="store-hero-avatar"
        />
      ) : (
        <div className="store-hero-icon" style={{ background: gradient }}>
          {getCategoryIcon(resource.category, 36)}
        </div>
      )}

      <div className="store-hero-info">
        <div className="store-hero-label">FEATURED</div>
        <div className="store-hero-name">{resource.name}</div>
        <div className="store-hero-desc">{resource.description}</div>
        <div className="store-hero-meta">
          {resource.author} · v{resource.version}
        </div>
      </div>

      <div className="store-hero-action">
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

function extractHeroColor(gradient: string): string {
  const colors = gradient.match(/#[0-9a-fA-F]{6}/g);
  return colors?.[0] ? `${colors[0]}20` : 'rgba(255,255,255,0.04)';
}
