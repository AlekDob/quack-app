import type { MarketplaceResource } from '../../types';
import { getCategoryGradient, getCategoryIcon, VerifiedIcon, formatInstallCount, hasDuckAvatar, getDuckAvatarUrl } from './StoreIcons';

interface StoreItemCardProps {
  resource: MarketplaceResource;
  installed: boolean;
  onInstall: (resource: MarketplaceResource) => void;
  onUninstall: (resourceId: string) => Promise<boolean>;
  onViewDetails: (resource: MarketplaceResource) => void;
}

export default function StoreItemCard({
  resource, installed, onInstall, onUninstall, onViewDetails,
}: StoreItemCardProps) {
  return (
    <div
      className="store-item-card"
      onClick={() => onViewDetails(resource)}
    >
      {hasDuckAvatar(resource.icon) ? (
        <img
          src={getDuckAvatarUrl(resource.icon!)}
          alt={resource.name}
          className="store-item-avatar"
        />
      ) : (
        <div
          className="store-item-icon"
          style={{ background: getCategoryGradient(resource.category) }}
        >
          {getCategoryIcon(resource.category)}
        </div>
      )}

      <div className="store-item-body">
        <div className="store-item-name-row">
          <span className="store-item-name">{resource.name}</span>
          {installed && <span className="store-installed-badge">Installed</span>}
        </div>
        <div className="store-item-meta">
          {resource.author} · v{resource.version}
        </div>
        <div className="store-item-description">
          {resource.description}
        </div>
        <div className="store-item-signals">
          {resource.verified && (
            <span className="store-item-verified">
              <VerifiedIcon /> Verified
            </span>
          )}
          {resource.installCount > 0 && (
            <span className="store-item-installs">
              {formatInstallCount(resource.installCount)} installs
            </span>
          )}
        </div>
      </div>

      <div className="store-item-action">
        {installed ? (
          <button
            type="button"
            className="store-get-btn store-get-btn-remove"
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
            className="store-get-btn store-get-btn-get"
            onClick={(e) => {
              e.stopPropagation();
              onInstall(resource);
            }}
          >
            Get
          </button>
        )}
      </div>
    </div>
  );
}
