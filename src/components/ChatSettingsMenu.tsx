import { useState, useRef, useEffect, useCallback } from 'react';
import type { ThinkingMode, PermissionMode } from '../hooks/useClaudeChat';
import type { EffortLevel, LLMProviderType } from '../types';
import type { ModelConfig } from '../services/modelService';
import { getModelOptions, getModelLabel } from '../services/modelService';
import { useModelsConfig } from '../hooks/useAppConfig';
import { useSettingsStore } from '../stores/settingsStore';
import { fetchOllamaModels, getOllamaModelOptions } from '../services/ollamaService';
// Brain: 037-anthropic-compatible-providers
import { BUILTIN_PRESETS } from '../constants/providerPresets';
import { getProviderToken } from '../services/providerService';
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
  /** True when the active session runs on the Codex backend. Codex manages its
   *  own model/mode/effort, so the Claude provider controls are hidden for it. */
  isCodexSession?: boolean;
}

// ThinkingMode options removed - now controlled via brain icon toggle in footer

const permissionModeOptions = [
  { value: 'plan' as PermissionMode, label: 'Plan · Planning only' },
  { value: 'bypass' as PermissionMode, label: 'Build · No confirmations' },
  { value: 'ask' as PermissionMode, label: 'Ask · Ask before acting' },
  { value: 'debug' as PermissionMode, label: 'Debug · Systematic debugging' },
  { value: 'chat' as PermissionMode, label: 'Chat · Conversational' },
];

const effortOptions = [
  { value: 'low' as EffortLevel, label: 'Fast', desc: 'Latency-first, not intelligence-sensitive' },
  { value: 'medium' as EffortLevel, label: 'Balanced', desc: 'Lower cost, some intelligence trade-off' },
  { value: 'high' as EffortLevel, label: 'Smart', desc: 'Minimum for intelligence-sensitive work' },
  { value: 'xhigh' as EffortLevel, label: 'Deep', desc: 'Recommended default on Opus 4.7' },
  { value: 'max' as EffortLevel, label: 'Max', desc: 'Deepest reasoning, no budget cap (session only)' },
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
  isCodexSession,
}: ChatSettingsMenuProps) {
  const { models: remoteModels, loading: modelsLoading } = useModelsConfig();
  const modelOptions = getModelOptions(remoteModels);
  const { provider, providerBaseUrl, ollamaModel, bedrockModelOverride } = useSettingsStore(s => s.claude);
  const updateClaude = useSettingsStore(s => s.updateClaudeSettings);
  // Brain: 037-anthropic-compatible-providers
  const activeProvider = useSettingsStore(s => s.claude.activeProvider) ?? { kind: 'anthropic' as const };
  const customProviders = useSettingsStore(s => s.claude.customProviders) ?? [];
  const providerModelCache = useSettingsStore(s => s.claude.providerModelCache) ?? {};
  const activeProviderId = activeProvider.kind === 'custom' ? activeProvider.providerId : 'anthropic';

  const [isOpen, setIsOpen] = useState(false);
  const [ollamaModelOptions, setOllamaModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [providerSwitched, setProviderSwitched] = useState(false);
  // Brain: 037-anthropic-compatible-providers
  // Set of provider ids with a saved API key. Refreshed whenever the popover opens.
  const [providersWithKey, setProvidersWithKey] = useState<Set<string>>(new Set());
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

  // Brain: 037-anthropic-compatible-providers
  // When the popover opens, probe all custom-compatible providers for a saved API key
  // and filter the dropdown to only show usable ones (+ Anthropic Official as no-key default).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const probe = async () => {
      const candidates = [...BUILTIN_PRESETS, ...customProviders]
        .filter((p) => p.id !== 'anthropic');
      const results = await Promise.all(
        candidates.map(async (p) => {
          const token = await getProviderToken(p.id);
          return token ? p.id : null;
        }),
      );
      if (cancelled) return;
      setProvidersWithKey(new Set(results.filter((id): id is string => !!id)));
    };
    void probe();
    return () => {
      cancelled = true;
    };
  }, [isOpen, customProviders]);

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
    // Brain: 037-anthropic-compatible-providers
    // When a custom provider is active, show the provider's real model name
    // (e.g. "MiniMax-M2", "glm-4.6") instead of the underlying Anthropic friendly tier.
    if (activeProvider.kind === 'custom') {
      // Live model from /v1/models always wins.
      if (activeProvider.activeModel) return activeProvider.activeModel;
      const ap = BUILTIN_PRESETS.find(p => p.id === activeProvider.providerId)
        ?? customProviders.find(p => p.id === activeProvider.providerId);
      if (ap) {
        if (baseModel === 'haiku45' && ap.haikuModel) return ap.haikuModel;
        if (baseModel === 'opus47' && ap.defaultModel) return ap.defaultModel;
        return ap.sonnetModel || ap.haikuModel || ap.defaultModel || ap.name;
      }
    }
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
      ask: '#a78bfa',
      debug: '#22c55e',
      chat: '#00D9FF',
    };
    return colors[permissionMode] || '#ffffff';
  };

  const getEffortLabel = () => {
    const option = effortOptions.find(opt => opt.value === effort);
    return option?.label ?? 'Balanced';
  };

  const getEffortColor = () => {
    const colors: Record<EffortLevel, string> = {
      low: '#22c55e',     // Green - fast/cheap
      medium: '#eab308',  // Yellow - balanced
      high: '#a855f7',    // Smart
      xhigh: '#c084fc',   // Deep - Opus 4.7 default
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
          {isCodexSession ? (
            <>Codex · <span style={{ fontWeight: 600 }}>gpt-5-codex</span></>
          ) : (
            <>
              {getModelLabelText()} ·
              <span style={{ color: getPermissionColor(), fontWeight: 600 }}> {getPermissionLabel()}</span> ·
              <span style={{ color: getEffortColor(), fontWeight: 600 }}> {getEffortLabel()}</span>
            </>
          )}
        </span>
      </button>

      {isOpen && (
        <div ref={menuRef} className="chat-settings-popover">
          {isCodexSession && (
            <div className="chat-settings-section">
              <span className="chat-settings-label-text">Backend</span>
              <div style={{
                marginTop: 4, padding: '8px 10px', borderRadius: 6,
                backgroundColor: 'rgba(255,255,255,0.05)',
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              }}>
                Codex · gpt-5-codex
              </div>
              <div style={{
                fontSize: 11, color: 'var(--text-secondary)', opacity: 0.85,
                padding: '6px 0 0', lineHeight: 1.4,
              }}>
                This session runs on the Codex agent. Model, mode and effort are
                managed by Codex itself — the Claude provider/model settings do
                not apply and are ignored for Codex sessions.
              </div>
            </div>
          )}
          {!isCodexSession && (<>
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
                    backgroundColor: provider === tab.value ? 'rgba(var(--accent-rgb), 0.2)' : 'transparent',
                    color: provider === tab.value ? 'var(--accent-color)' : 'var(--text-secondary)',
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
              fontSize: 11, color: 'var(--accent-color)', opacity: 0.85,
              padding: '4px 0 0', lineHeight: 1.4,
            }}>
              Start a new chat for the switch to take effect
            </div>
          )}

          {/* Brain: 037-anthropic-compatible-providers
              Custom Model picker — visible only when "Claude" tab is active.
              Lists Anthropic Official + only providers with a saved API key (configured in Settings). */}
          {provider === 'anthropic' && (() => {
            const allowed = [...BUILTIN_PRESETS, ...customProviders].filter(
              (p) => p.id === 'anthropic' || providersWithKey.has(p.id),
            );
            const activeProviderObj =
              BUILTIN_PRESETS.find(p => p.id === activeProviderId) ??
              customProviders.find(p => p.id === activeProviderId);
            return (
              <div className="chat-settings-section">
                <span className="chat-settings-label-text">Custom Model</span>
                <select
                  className="chat-settings-select"
                  value={allowed.some(p => p.id === activeProviderId) ? activeProviderId : 'anthropic'}
                  onChange={(e) => {
                    const next = e.target.value;
                    updateClaude({
                      activeProvider: next === 'anthropic'
                        ? { kind: 'anthropic' }
                        : { kind: 'custom', providerId: next },
                    });
                  }}
                  style={{ marginTop: 4, width: '100%' }}
                >
                  {allowed.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.sonnetModel ? ` · ${p.sonnetModel}` : ''}
                    </option>
                  ))}
                </select>
                {allowed.length === 1 && (
                  <div style={{
                    fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7,
                    padding: '4px 0 0', lineHeight: 1.4,
                  }}>
                    Configure a custom provider in Settings → Claude Code to add z.ai, MiniMax, Kimi or any other Anthropic-compatible endpoint.
                  </div>
                )}
                {activeProviderId !== 'anthropic' && activeProviderObj && (
                  <div style={{
                    fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7,
                    padding: '4px 0 0',
                  }}>
                    Routing through {activeProviderObj.baseUrl}
                  </div>
                )}
              </div>
            );
          })()}

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
              {provider === 'anthropic' && activeProvider.kind === 'custom' ? (
                // Brain: 037-anthropic-compatible-providers
                // When a custom Anthropic-compatible provider is active, the Anthropic
                // friendly model names (Opus/Sonnet/Haiku) don't apply — the request must
                // carry "sonnet" or "haiku" in the model name for ANTHROPIC_DEFAULT_*_MODEL
                // env overrides to fire. Show the provider's real models instead.
                // If /v1/models was refreshed, show the full live list; otherwise fall
                // back to the bundled sonnet/haiku/default tier slots.
                (() => {
                  const ap = BUILTIN_PRESETS.find(p => p.id === activeProvider.providerId)
                    ?? customProviders.find(p => p.id === activeProvider.providerId);
                  if (!ap) return null;
                  const cached = providerModelCache[activeProvider.providerId]?.models ?? [];
                  const useCached = cached.length > 0;
                  const updateActiveModel = (id: string | undefined) => {
                    const current = useSettingsStore.getState().claude.activeProvider;
                    if (!current || current.kind !== 'custom') return;
                    if ((current.activeModel ?? undefined) === id) return;
                    useSettingsStore.getState().updateClaudeSettings({
                      activeProvider: { ...current, activeModel: id },
                    });
                  };
                  if (useCached) {
                    const activeModel = activeProvider.activeModel ?? cached[0];
                    if (activeModel !== activeProvider.activeModel) {
                      queueMicrotask(() => updateActiveModel(activeModel));
                    }
                    // Friendly id must contain "sonnet" so the env override fires.
                    if (baseModel !== 'sonnet46') {
                      queueMicrotask(() => onModelChange('sonnet46'));
                    }
                    return (
                      <select
                        value={activeModel}
                        onChange={(e) => {
                          updateActiveModel(e.target.value);
                          if (baseModel !== 'sonnet46') onModelChange('sonnet46');
                        }}
                        className="chat-settings-select"
                        style={{ flex: 1 }}
                      >
                        {cached.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    );
                  }
                  // Clear any stale activeModel when falling back to bundled tiers.
                  if (activeProvider.activeModel) {
                    queueMicrotask(() => updateActiveModel(undefined));
                  }
                  const opts: { friendly: string; label: string }[] = [];
                  opts.push({ friendly: 'sonnet46', label: ap.sonnetModel });
                  if (ap.haikuModel && ap.haikuModel !== ap.sonnetModel) {
                    opts.push({ friendly: 'haiku45', label: ap.haikuModel });
                  }
                  if (ap.defaultModel && ap.defaultModel !== ap.sonnetModel && ap.defaultModel !== ap.haikuModel) {
                    opts.push({ friendly: 'opus47', label: ap.defaultModel });
                  }
                  const selected = opts.find(o => o.friendly === baseModel)?.friendly ?? opts[0].friendly;
                  if (selected !== baseModel) {
                    queueMicrotask(() => onModelChange(selected));
                  }
                  return (
                    <select
                      value={selected}
                      onChange={(e) => onModelChange(e.target.value)}
                      className="chat-settings-select"
                      style={{ flex: 1 }}
                    >
                      {opts.map((o) => (
                        <option key={o.friendly} value={o.friendly}>{o.label}</option>
                      ))}
                    </select>
                  );
                })()
              ) : provider === 'anthropic' ? (
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
                    {option.label} — {option.desc}
                  </option>
                ))}
              </select>
            </label>
          </div>
          </>)}
        </div>
      )}
    </div>
  );
}
