import { useSettingsStore } from '../../../stores/settingsStore';
import type { EffortLevel } from '../../../types';
import { getModelOptions, defaultEffortForModel } from '../../../services/modelService';
import { useModelsConfig } from '../../../hooks/useAppConfig';
import SectionHeader from '../controls/SectionHeader';
import './AgentModesSettings.css';

// Ordered low → max. Opus 4.7 supports all five; older models fall back to
// the highest supported level at or below the chosen one (per Anthropic docs).
const effortOptions = [
  { value: 'low' as EffortLevel, label: 'Fast', desc: 'Latency-first, not intelligence-sensitive', icon: '>' },
  { value: 'medium' as EffortLevel, label: 'Balanced', desc: 'Lower cost, some intelligence trade-off', icon: '>>' },
  { value: 'high' as EffortLevel, label: 'Smart', desc: 'Minimum for intelligence-sensitive work', icon: '>>>' },
  { value: 'xhigh' as EffortLevel, label: 'Deep', desc: 'Recommended default on Opus 4.7', icon: '>>>>' },
  { value: 'max' as EffortLevel, label: 'Max', desc: 'Deepest reasoning, no budget cap (session only)', icon: 'MAX' },
];

interface ModePresetCardProps {
  mode: 'bypass' | 'plan' | 'ask' | 'debug' | 'chat';
  title: string;
  description: string;
  color: string;
  icon: string;
}

function ModePresetCard({ mode, title, description, color, icon }: ModePresetCardProps) {
  const { agentModePresets, updateModePreset } = useSettingsStore();
  const { models: remoteModels } = useModelsConfig();
  const modelOptions = getModelOptions(remoteModels);
  const fallbackModel = 'opus47';
  const preset = agentModePresets[mode] ?? {
    model: fallbackModel,
    thinkingMode: 'auto' as const,
    effort: defaultEffortForModel(fallbackModel),
  };

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
    if (window.confirm('Reset to Anthropic recommended defaults?\n\nBuild: Opus 4.7 (Deep / xhigh)\nPlan: Opus 4.7 (Deep / xhigh)\nAsk: Opus 4.7 (Deep / xhigh)\nDebug: Opus 4.7 (Max)\nChat: Sonnet 4.6 (Fast / low)')) {
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
          title="Build Mode"
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
        <ModePresetCard
          mode="ask"
          title="Ask Mode"
          description="Full coding power with supervision - asks permission for each tool use"
          color="#f59e0b"
          icon="&#x1F6E1;&#xFE0F;"
        />
        <ModePresetCard
          mode="debug"
          title="Debug Mode"
          description="Systematic debugging - consults Brain and follows 4-phase debug approach"
          color="#22c55e"
          icon="&#x2B21;"
        />
        <ModePresetCard
          mode="chat"
          title="Chat Mode"
          description="Conversational - asks before writing or editing, minimizes token usage"
          color="#00D9FF"
          icon="&#x25CB;"
        />
      </div>

      <div className="mode-presets-actions">
        <button className="ios-button ios-button-secondary" onClick={handleReset}>
          Reset to Anthropic Defaults
        </button>
        <div className="mode-presets-hint">
          Defaults: Build/Plan/Ask = Opus 4.7 (Deep), Debug = Opus 4.7 (Max), Chat = Sonnet 4.6 (Fast). Older models fall back to the highest supported level.
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
