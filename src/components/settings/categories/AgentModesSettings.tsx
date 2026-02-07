import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useSessionStore } from '../../../stores/sessionStore';
import type { EffortLevel, ThinkingMode } from '../../../types';
import { getModelOptions } from '../../../services/modelService';
import { useModelsConfig } from '../../../hooks/useAppConfig';
import SectionHeader from '../controls/SectionHeader';
import './AgentModesSettings.css';

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

interface RuleInfo {
  name: string;
  exists: boolean;
}

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
  const selectedSession = useSessionStore((s) => s.getSelectedSession());
  const [rules, setRules] = useState<RuleInfo[]>([]);

  const projectPath = selectedSession?.projectPath;
  const projectName = selectedSession?.projectName || 'No project';

  useEffect(() => {
    if (!projectPath) return;
    checkRules(projectPath);
  }, [projectPath]);

  const checkRules = async (projPath: string) => {
    const ruleFiles = [
      { name: 'use-codebase-map', file: 'use-codebase-map.md' },
      { name: 'use-quack-brain', file: 'use-quack-brain.md' },
      { name: 'apatr-d', file: 'Analyze-Plan-act-test-review-document.md' },
    ];

    const results: RuleInfo[] = [];
    for (const r of ruleFiles) {
      try {
        await invoke<string>('read_file_content', { path: `${projPath}/.claude/rules/${r.file}` });
        results.push({ name: r.name, exists: true });
      } catch {
        results.push({ name: r.name, exists: false });
      }
    }
    setRules(results);
  };

  const handleReset = () => {
    if (window.confirm('Reset to Anthropic recommended defaults?\n\nBypass: Sonnet 4.5\nPlan: Opus 4.5')) {
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

      {/* Active Rules */}
      <SectionHeader
        title="Active Rules"
        description={`Rules detected in ${projectName}`}
      />

      <div className="settings-group">
        {rules.length === 0 ? (
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-description">
                {projectPath ? 'Checking rules...' : 'Select a session to view project rules'}
              </div>
            </div>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.name} className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`rule-dot ${rule.exists ? 'active' : ''}`} />
                  {rule.name}
                </div>
              </div>
              <div className="settings-row-control">
                <span className={`rule-badge ${rule.exists ? 'rule-badge-active' : ''}`}>
                  {rule.exists ? 'Active' : 'Not installed'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
