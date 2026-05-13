import { memo } from 'react';
import type { MessageSettingsMetadata } from '../types';
import './MessageSettingsBadges.css';

interface MessageSettingsBadgesProps {
  settings?: MessageSettingsMetadata;
}

const modelLabels: Record<string, string> = {
  opus: 'Opus',
  opus46: 'Opus 4.6',
  sonnet: 'Sonnet',
  sonnet45: 'Sonnet 4.5',
  haiku: 'Haiku',
  haiku45: 'Haiku 4.5',
};

const effortIcons: Record<string, string> = {
  low: '>',
  medium: '>>',
  high: '>>>',
  xhigh: '>>>>',
  max: 'MAX',
};

const effortLabels: Record<string, string> = {
  low: 'Fast',
  medium: 'Balanced',
  high: 'Smart',
  xhigh: 'Deep',
  max: 'Max',
};

const thinkingIcons: Record<string, string> = {
  auto: 'A',
  think: 'T',
  hard: 'TH',
  harder: 'TH+',
  ultra: 'U',
};

function MessageSettingsBadges({ settings }: MessageSettingsBadgesProps) {
  if (!settings) return null;

  const { model, effort, thinkingMode, hasThinkingBlocks, modelDisplayName } = settings;

  // Only show if at least one setting is present
  if (!model && !effort && !thinkingMode) return null;

  // Brain: 037-anthropic-compatible-providers
  // Prefer the explicit display name (set when a custom provider was active)
  // over the friendly tier id mapping.
  const renderedLabel = modelDisplayName || (model ? (modelLabels[model] || model) : '');

  return (
    <div className="message-settings-badges">
      {/* Model Badge */}
      {model && (
        <span className={`settings-badge model-badge model-${model}`} title={`Model: ${renderedLabel}`}>
          {renderedLabel}
        </span>
      )}

      {/* Effort Badge */}
      {effort && (
        <span
          className={`settings-badge effort-badge effort-${effort}`}
          title={`Effort: ${effortLabels[effort] || effort}`}
        >
          {effortIcons[effort] || effort}
        </span>
      )}

      {/* Thinking Mode Badge */}
      {thinkingMode && thinkingMode !== 'auto' && (
        <span
          className={`settings-badge thinking-badge thinking-${thinkingMode}`}
          title={`Thinking: ${thinkingMode}`}
        >
          {thinkingIcons[thinkingMode] || thinkingMode}
        </span>
      )}

      {/* Thinking Blocks Indicator */}
      {hasThinkingBlocks && (
        <span
          className="settings-badge thinking-active-badge"
          title="Response contains thinking blocks"
        >
          *
        </span>
      )}
    </div>
  );
}

export default memo(MessageSettingsBadges);
