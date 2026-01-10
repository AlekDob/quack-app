import { calculatePowerRating, getPowerRatingColor, getPowerRatingPercentage, getPowerRatingTier } from '../utils/powerRating';
import './PowerBadge.css';

interface PowerBadgeProps {
  skillCount: number;
  droidCount: number;
  ruleCount: number;
  commandCount: number;
  compact?: boolean; // If true, show more compact version
}

export default function PowerBadge({
  skillCount,
  droidCount,
  ruleCount,
  commandCount,
  compact = false,
}: PowerBadgeProps) {
  const rating = calculatePowerRating(skillCount, droidCount, ruleCount, commandCount);
  const color = getPowerRatingColor(rating.total);
  const percentage = getPowerRatingPercentage(rating.total);
  const tier = getPowerRatingTier(rating.total);

  if (compact) {
    // Ultra-compact version for sidebar
    return (
      <div className="power-badge compact" title={`Power Rating: ${rating.total} (${tier})`}>
        <div className="power-value" style={{ color }}>
          <span className="power-label">POWER:</span>
          <span className="power-number">{rating.total}</span>
        </div>
        <div className="power-bar">
          <div
            className="power-bar-fill"
            style={{
              width: `${percentage}%`,
              background: `linear-gradient(90deg, ${color} 0%, ${color}88 100%)`,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="power-badge">
      <div className="power-header">
        <div className="power-value" style={{ color }}>
          <span className="power-label">POWER:</span>
          <span className="power-number">{rating.total}</span>
        </div>
        <div className="power-tier" style={{ color }}>
          {tier}
        </div>
      </div>

      <div className="power-bar">
        <div
          className="power-bar-fill"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color} 0%, ${color}88 100%)`,
          }}
        />
      </div>

      <div className="power-breakdown">
        <div className="breakdown-item">
          <span className="breakdown-label">Skills:</span>
          <span className="breakdown-value">{skillCount}</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Droids:</span>
          <span className="breakdown-value">{droidCount}</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Rules:</span>
          <span className="breakdown-value">{ruleCount}</span>
        </div>
      </div>
    </div>
  );
}
