import { useSettingsStore } from '../../../stores/settingsStore';
import type { EffortLevel, ThinkingMode } from '../../../types';
import { getModelOptions } from '../../../services/modelService';
import { useModelsConfig } from '../../../hooks/useAppConfig';
import SectionHeader from '../controls/SectionHeader';

const thinkingModeOptions = [
  { value: 'auto' as ThinkingMode, label: 'Auto', desc: 'Let model decide' },
  { value: 'think' as ThinkingMode, label: 'Think', desc: 'Step-by-step' },
  { value: 'hard' as ThinkingMode, label: 'Think Hard', desc: 'Deeper reasoning' },
  { value: 'harder' as ThinkingMode, label: 'Think Harder', desc: 'Thorough reasoning' },
  { value: 'ultra' as ThinkingMode, label: 'Ultra Think', desc: 'Maximum deliberation' },
];

const effortOptions = [
  { value: 'low' as EffortLevel, label: 'Fast', desc: 'Quick responses, lower cost', icon: '>' },
  { value: 'medium' as EffortLevel, label: 'Balanced', desc: 'Default quality', icon: '>>' },
  { value: 'high' as EffortLevel, label: 'Quality', desc: 'Thorough responses', icon: '>>>' },
];

interface ModePresetCardProps {
  mode: 'bypass' | 'plan';
  title: string;
  description: string;
  color: string;
  icon: string;
}

function ModePresetCard({ mode, title, description, color, icon }: ModePresetCardProps) {
  const { agentModePresets, updateModePreset } = useSettingsStore();
  const { models: remoteModels } = useModelsConfig();
  const modelOptions = getModelOptions(remoteModels);
  const preset = agentModePresets[mode];

  return (
    <div className="mode-preset-card" style={{ borderLeftColor: color }}>
      <div className="mode-preset-header">
        <div className="mode-preset-title" style={{ color }}>
          <span className="mode-icon">{icon}</span>
          {title}
        </div>
        <div className="mode-preset-desc">{description}</div>
      </div>

      <div className="mode-preset-options">
        <div className="mode-preset-row">
          <label className="mode-preset-label">Model</label>
          <select
            value={preset.model}
            onChange={(e) => updateModePreset(mode, { model: e.target.value })}
            className="mode-preset-select"
          >
            {modelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="mode-preset-row">
          <label className="mode-preset-label">Thinking</label>
          <select
            value={preset.thinkingMode}
            onChange={(e) => updateModePreset(mode, { thinkingMode: e.target.value as ThinkingMode })}
            className="mode-preset-select"
          >
            {thinkingModeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} - {opt.desc}
              </option>
            ))}
          </select>
        </div>

        <div className="mode-preset-row">
          <label className="mode-preset-label">Effort</label>
          <select
            value={preset.effort}
            onChange={(e) => updateModePreset(mode, { effort: e.target.value as EffortLevel })}
            className="mode-preset-select"
          >
            {effortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.icon} {opt.label} - {opt.desc}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default function AgentModesSettings() {
  const { resetModePresets } = useSettingsStore();

  const handleReset = () => {
    if (window.confirm('Reset to Anthropic recommended defaults?\n\nBypass: Sonnet 4.5\nPlan: Opus 4.6')) {
      resetModePresets();
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Agent Mode Presets"
        description="Configure default parameters for each permission mode. When you switch modes, these settings will be applied automatically."
      />

      <div className="mode-presets-grid">
        <ModePresetCard
          mode="bypass"
          title="Bypass Mode"
          description="No confirmations needed - agent executes autonomously"
          color="#f87171"
          icon="&#x2B22;"
        />
        <ModePresetCard
          mode="plan"
          title="Plan Mode"
          description="Planning only - agent creates plans without executing"
          color="#60a5fa"
          icon="&#x25C7;"
        />
      </div>

      <div className="mode-presets-actions">
        <button className="ios-button ios-button-secondary" onClick={handleReset}>
          Reset to Anthropic Defaults
        </button>
        <div className="mode-presets-hint">
          Anthropic recommends: Bypass = Sonnet, Plan = Opus
        </div>
      </div>

      <style>{`
        .mode-presets-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mode-preset-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-left: 3px solid;
          border-radius: 12px;
          padding: 20px;
          transition: border-color 0.15s ease;
        }

        .mode-preset-card:hover {
          border-color: rgba(255, 255, 255, 0.15);
        }

        .mode-preset-header {
          margin-bottom: 16px;
        }

        .mode-preset-title {
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .mode-icon {
          font-size: 12px;
        }

        .mode-preset-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.4;
        }

        .mode-preset-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mode-preset-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mode-preset-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          min-width: 64px;
          flex-shrink: 0;
        }

        .mode-preset-select {
          flex: 1;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          color: #f3f4f6;
          cursor: pointer;
          outline: none;
          transition: border-color 0.15s ease;
          font-family: inherit;
        }

        .mode-preset-select:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }

        .mode-preset-select:focus {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .mode-preset-select option {
          background: #1a1a1a;
          color: #f3f4f6;
        }

        .mode-presets-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
        }

        .mode-presets-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
        }

      `}</style>
    </div>
  );
}
