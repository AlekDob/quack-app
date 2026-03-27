import { useState, useRef, useEffect, useCallback } from 'react';
import type { ThinkingMode, PermissionMode } from '../hooks/useClaudeChat';
import type { EffortLevel, LLMProviderType } from '../types';
import type { ModelConfig } from '../services/modelService';
import { getModelOptions, getModelLabel } from '../services/modelService';
import { useModelsConfig } from '../hooks/useAppConfig';
import { useSettingsStore } from '../stores/settingsStore';
import { fetchOllamaModels, getOllamaModelOptions } from '../services/ollamaService';
import './ChatSettingsMenu.css';

interface ChatSettingsMenuProps {
  model: string;
  thinkingMode: ThinkingMode;
  permissionMode: PermissionMode;
  effort: EffortLevel;
  onModelChange: (model: string) => void;
  onThinkingModeChange: (mode: ThinkingMode) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
  onEffortChange: (effort: EffortLevel) => void;
  disabled?: boolean;
}

// ThinkingMode options removed - now controlled via brain icon toggle in footer

const permissionModeOptions = [
  { value: 'plan' as PermissionMode, label: '◇ Plan · Planning only' },
  { value: 'bypass' as PermissionMode, label: '⬢ Build · No confirmations' },
  { value: 'debug' as PermissionMode, label: '⬡ Debug · Systematic debugging' },
  { value: 'chat' as PermissionMode, label: '○ Chat · Ask before acting' },
];

const effortOptions = [
  { value: 'low' as EffortLevel, label: 'Fast · Quick responses, lower cost', icon: '>' },
  { value: 'medium' as EffortLevel, label: 'Balanced · Default quality', icon: '>>' },
  { value: 'high' as EffortLevel, label: 'Quality · Thorough responses', icon: '>>>' },
];

export default function ChatSettingsMenu({
  model,
  thinkingMode,
  permissionMode,
  effort,
  onModelChange,
  onThinkingModeChange,
  onPermissionModeChange,
  onEffortChange,
  disabled,
}: ChatSettingsMenuProps) {
  const { models: remoteModels, loading: modelsLoading } = useModelsConfig();
  const modelOptions = getModelOptions(remoteModels);
  const { provider, providerBaseUrl, ollamaModel, bedrockModelOverride } = useSettingsStore(s => s.claude);
  const updateClaude = useSettingsStore(s => s.updateClaudeSettings);

  const [isOpen, setIsOpen] = useState(false);
  const [ollamaModelOptions, setOllamaModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [providerSwitched, setProviderSwitched] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch Ollama models when popover opens and provider is ollama
  const refreshOllamaModels = useCallback(async () => {
    const url = providerBaseUrl || 'http://localhost:11434';
    const models = await fetchOllamaModels(url);
    setOllamaModelOptions(getOllamaModelOptions(models));
  }, [providerBaseUrl]);

  useEffect(() => {
    if (isOpen && provider === 'ollama') {
      refreshOllamaModels();
    }
  }, [isOpen, provider, refreshOllamaModels]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // 1M context window support: model IDs ending with [1m] suffix
  // Opus 4.6 has 1M natively (automatic on Max/Team/Enterprise/API) — no toggle needed.
  // Sonnet 4.6 requires explicit [1m] suffix (extra usage billing on Max/Team).
  const baseModel = model.replace('[1m]', '');
  const is1MEnabled = model.endsWith('[1m]');
  const supports1M = baseModel === 'sonnet46';

  // Brain: fix-bedrock-model-override
  const hasBedrockOverride = !!bedrockModelOverride?.trim();

  const getModelLabelText = () => {
    if (provider !== 'anthropic') return ollamaModel || provider;
    // When Bedrock override is active, show the override model ID (truncated)
    if (hasBedrockOverride) {
      const override = bedrockModelOverride.trim();
      // Extract model name from ARN if possible (last segment after /)
      const arnParts = override.split('/');
      const shortName = arnParts.length > 1 ? arnParts[arnParts.length - 1] : override;
      return shortName.length > 30 ? `${shortName.substring(0, 27)}...` : shortName;
    }
    const label = getModelLabel(baseModel, remoteModels);
    return is1MEnabled ? `${label} (1M)` : label;
  };

  // getThinkingLabel removed - thinking mode now shown via brain icon in footer

  const getPermissionLabel = () => {
    const option = permissionModeOptions.find(opt => opt.value === permissionMode);
    return option?.label.split('·')[0].trim() ?? permissionMode;
  };

  const getPermissionColor = () => {
    const colors: Record<PermissionMode, string> = {
      plan: '#60a5fa',
      bypass: '#f87171',
      debug: '#22c55e',
      chat: '#00D9FF',
    };
    return colors[permissionMode] || '#ffffff';
  };

  const getEffortLabel = () => {
    const option = effortOptions.find(opt => opt.value === effort);
    return option?.icon ?? '>>';
  };

  const getEffortColor = () => {
    const colors: Record<EffortLevel, string> = {
      low: '#22c55e',     // Green - fast/cheap
      medium: '#eab308',  // Yellow - balanced
      high: '#a855f7',    // Purple - quality
      max: '#ef4444',     // Red - maximum effort
    };
    return colors[effort] || '#eab308';
  };

  return (
    <div className="chat-settings-menu">
      <button
        ref={buttonRef}
        type="button"
        className="chat-settings-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label="Chat settings"
        title="Chat settings"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
        </svg>
        <span className="chat-settings-summary">
          {getModelLabelText()} ·
          <span style={{ color: getPermissionColor(), fontWeight: 600 }}> {getPermissionLabel()}</span> ·
          <span style={{ color: getEffortColor(), fontWeight: 600 }}> {getEffortLabel()}</span>
        </span>
      </button>

      {isOpen && (
        <div ref={menuRef} className="chat-settings-popover">
          {/* Provider quick-switch tabs */}
          <div className="chat-settings-section">
            <span className="chat-settings-label-text">Provider</span>
            <div style={{
              display: 'flex', gap: 4, marginTop: 4,
              padding: 2, borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}>
              {([
                { value: 'anthropic' as LLMProviderType, label: 'Claude' },
                { value: 'ollama' as LLMProviderType, label: 'Ollama' },
              ]).map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    if (tab.value !== provider) {
                      updateClaude({ provider: tab.value });
                      setProviderSwitched(true);
                    }
                    if (tab.value === 'ollama' && !providerBaseUrl) {
                      updateClaude({ providerBaseUrl: 'http://localhost:11434' });
                    }
                  }}
                  style={{
                    flex: 1, padding: '4px 8px', fontSize: 12, fontWeight: 500,
                    border: 'none', borderRadius: 4, cursor: 'pointer',
                    backgroundColor: provider === tab.value ? 'rgba(242, 140, 82, 0.2)' : 'transparent',
                    color: provider === tab.value ? '#f28c52' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {providerSwitched && (
            <div style={{
              fontSize: 11, color: '#f28c52', opacity: 0.85,
              padding: '4px 0 0', lineHeight: 1.4,
            }}>
              Start a new chat for the switch to take effect
            </div>
          )}

          {/* Model dropdown - adapts to provider */}
          <div className="chat-settings-section">
            <label className="chat-settings-label">
              <span className="chat-settings-label-text">
                Model
                {hasBedrockOverride && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, fontWeight: 700,
                    padding: '1px 5px', borderRadius: 3,
                    backgroundColor: 'rgba(255, 153, 0, 0.15)',
                    color: '#ff9900', letterSpacing: '0.04em',
                  }}>
                    BEDROCK
                  </span>
                )}
              </span>
              {provider === 'anthropic' ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    value={baseModel}
                    onChange={(e) => {
                      const newBase = e.target.value;
                      const new1MSupported = newBase === 'sonnet46';
                      onModelChange(is1MEnabled && new1MSupported ? `${newBase}[1m]` : newBase);
                    }}
                    className="chat-settings-select"
                    style={{ flex: 1, opacity: hasBedrockOverride ? 0.5 : 1 }}
                    title={hasBedrockOverride ? 'Model overridden by Bedrock settings' : undefined}
                  >
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {supports1M && (
                    <button
                      type="button"
                      onClick={() => onModelChange(is1MEnabled ? baseModel : `${baseModel}[1m]`)}
                      title={is1MEnabled ? 'Disabilita context window 1M (torna a 200k)' : 'Abilita context window 1M'}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        backgroundColor: is1MEnabled ? 'rgba(0, 217, 255, 0.2)' : 'rgba(128, 132, 150, 0.15)',
                        color: is1MEnabled ? '#00D9FF' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      1M
                    </button>
                  )}
                </div>
              ) : (
                ollamaModelOptions.length > 0 ? (
                  <select
                    value={ollamaModel}
                    onChange={(e) => updateClaude({ ollamaModel: e.target.value })}
                    className="chat-settings-select"
                  >
                    <option value="">-- Select model --</option>
                    {ollamaModelOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => updateClaude({ ollamaModel: e.target.value })}
                    placeholder="e.g. qwen3-coder"
                    className="chat-settings-select"
                    style={{ border: '1px solid rgba(128,132,150,0.32)' }}
                  />
                )
              )}
            </label>
          </div>

          {/* Thinking section removed - now controlled via brain icon in footer */}

          <div className="chat-settings-section">
            <label className="chat-settings-label">
              <span className="chat-settings-label-text">Mode</span>
              <select
                value={permissionMode}
                onChange={(e) => onPermissionModeChange(e.target.value as PermissionMode)}
                className="chat-settings-select"
              >
                {permissionModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="chat-settings-section">
            <label className="chat-settings-label">
              <span className="chat-settings-label-text">Effort</span>
              <select
                value={effort}
                onChange={(e) => onEffortChange(e.target.value as EffortLevel)}
                className="chat-settings-select"
              >
                {effortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
