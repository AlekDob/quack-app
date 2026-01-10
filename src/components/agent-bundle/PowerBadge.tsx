import React from 'react';
import type { PowerRatingBreakdown } from '../../types';
import {
  getPowerRatingColor,
  getPowerRatingTier,
  getPowerRatingPercentage,
} from '../../utils/powerRating';
import '../PowerBadge.css';

interface PowerBadgeProps {
  powerRating: PowerRatingBreakdown;
  compact?: boolean;
  falloutStyle?: boolean;
}

/**
 * Power Badge Component
 *
 * Displays agent power rating with compact styling for the equipment editor
 * Supports Fallout Pip-Boy style with green monochrome
 */
export function PowerBadge({ powerRating, compact = true, falloutStyle = false }: PowerBadgeProps) {
  // Use Fallout green for falloutStyle, otherwise calculate based on power
  const color = falloutStyle ? '#14FF00' : getPowerRatingColor(powerRating.total);
  const tier = getPowerRatingTier(powerRating.total);
  const percentage = getPowerRatingPercentage(powerRating.total);

  const classNames = [
    'power-badge',
    compact ? 'compact' : '',
    falloutStyle ? 'fallout-style' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      {/* Header */}
      <div className="power-header">
        <div className="power-value" style={{ color }}>
          <span className="power-label">POWER</span>
          <span className="power-number">{powerRating.total}</span>
        </div>
        <div className="power-tier" style={{ color }}>
          {tier.toUpperCase()}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="power-bar">
        <div
          className="power-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Breakdown */}
      {!compact && (
        <div className="power-breakdown">
          <div className="breakdown-item">
            <span className="breakdown-label">Skills</span>
            <span className="breakdown-value">{powerRating.skillCount}</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-label">Droids</span>
            <span className="breakdown-value">{powerRating.droidCount}</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-label">Rules</span>
            <span className="breakdown-value">{powerRating.ruleCount}</span>
          </div>
          <div className="breakdown-item">
            <span className="breakdown-label">Cmds</span>
            <span className="breakdown-value">{powerRating.commandCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
