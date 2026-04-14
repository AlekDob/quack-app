import { useState, useCallback } from 'react';
import SectionHeader from '../controls/SectionHeader';
import { useSettingsStore } from '../../../stores/settingsStore';
import { testProviderConnection } from '../../../services/providerService';

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  container: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  card: (accentColor: string): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(128,132,150,0.15)',
    borderLeft: `3px solid ${accentColor}`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  }),
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: (color: string): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  providerName: { fontWeight: 600, fontSize: 13 },
  chevron: (open: boolean): React.CSSProperties => ({
    fontSize: 10, color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'none',
    transition: 'transform 0.15s',
  }),
  body: { marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  label: { fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 },
  input: {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(128,132,150,0.25)',
    borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box' as const,
  },
  row: { display: 'flex', gap: 6, alignItems: 'center' },
  testBtn: {
    flexShrink: 0, padding: '5px 10px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(128,132,150,0.25)',
    color: 'var(--text-primary)',
  },
  feedback: (ok: boolean): React.CSSProperties => ({
    fontSize: 11, color: ok ? '#22c55e' : '#ef4444', marginTop: 4,
  }),
  modelList: {
    fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7, marginTop: 6,
    lineHeight: 1.5,
  },
  modelRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
    fontSize: 12, color: 'var(--text-secondary)',
  },
  checkbox: {
    width: 14, height: 14, accentColor: 'var(--accent-color)', cursor: 'pointer',
    margin: 0, flexShrink: 0,
  },
  modelLabel: (disabled: boolean): React.CSSProperties => ({
    opacity: disabled ? 0.4 : 0.9, textDecoration: disabled ? 'line-through' : 'none',
    cursor: 'pointer', userSelect: 'none' as const,
  }),
  addModelRow: {
    display: 'flex', gap: 6, alignItems: 'center', marginTop: 4,
  },
  addInput: {
    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(128,132,150,0.2)',
    borderRadius: 5, padding: '4px 8px', fontSize: 11, color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box' as const,
  },
  addBtn: {
    padding: '4px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
    background: 'rgba(var(--accent-rgb), 0.15)', border: '1px solid rgba(var(--accent-rgb), 0.3)',
    color: 'var(--accent-color)', fontWeight: 600, flexShrink: 0,
  },
  removeBtn: {
    fontSize: 10, color: '#ef4444', cursor: 'pointer', opacity: 0.6,
    background: 'none', border: 'none', padding: '0 2px', flexShrink: 0,
  },
  spinner: {
    display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'quack-spin 0.6s linear infinite', marginRight: 4,
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type TestState = { loading: boolean; ok?: boolean; message?: string };
const IDLE: TestState = { loading: false };

// ── ProviderCard ──────────────────────────────────────────────────────────────

function ProviderCard({
  name, providerId, apiKey, onKeyChange, models, accentColor,
  disabledModels, onToggleModel, customModels, onAddCustom, onRemoveCustom,
  isSpecial, statusOverride, children,
}: {
  name: string; providerId: string; apiKey: string;
  onKeyChange: (k: string) => void;
  models: { id: string; label: string }[];
  accentColor: string;
  disabledModels: string[];
  onToggleModel: (id: string) => void;
  customModels: string[];
  onAddCustom: (id: string) => void;
  onRemoveCustom: (id: string) => void;
  isSpecial?: boolean;
  statusOverride?: 'active' | 'unconfigured';
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [test, setTest] = useState<TestState>(IDLE);
  const [newModelId, setNewModelId] = useState('');

  const dotColor = statusOverride === 'active' || (!isSpecial && apiKey.length > 0)
    ? '#22c55e' : 'rgba(128,132,150,0.4)';

  const handleKeyChange = (k: string) => { onKeyChange(k); setTest(IDLE); };

  const runTest = useCallback(async () => {
    setTest({ loading: true });
    const result = await testProviderConnection(providerId, apiKey);
    const msg = result.ok ? 'Connected' : (result.error ?? 'Failed').slice(0, 80);
    setTest({ loading: false, ok: result.ok, message: msg });
  }, [providerId, apiKey]);

  const handleAddModel = () => {
    const id = newModelId.trim();
    if (id && !models.some(m => m.id === id) && !customModels.includes(id)) {
      onAddCustom(id);
      setNewModelId('');
    }
  };

  return (
    <div style={S.card(accentColor)}>
      <div style={S.cardHeader} onClick={() => setOpen(v => !v)}>
        <div style={S.cardLeft}>
          <span style={S.dot(dotColor)} />
          <span style={S.providerName}>{name}</span>
        </div>
        <span style={S.chevron(open)}>▼</span>
      </div>

      {open && (
        <div style={S.body}>
          {children}
          {!isSpecial && (
            <div>
              <div style={S.label}>API Key</div>
              <div style={S.row}>
                <input
                  type="password" value={apiKey} onChange={e => handleKeyChange(e.target.value)}
                  placeholder="sk-..." style={S.input} autoComplete="off"
                />
                <button style={S.testBtn} onClick={runTest} disabled={test.loading}>
                  {test.loading && <span style={S.spinner} />}
                  Test
                </button>
              </div>
              {test.message && (
                <div style={S.feedback(!!test.ok)}>
                  {test.ok ? 'Connected' : test.message}
                </div>
              )}
            </div>
          )}

          {/* Model checkboxes */}
          {models.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={S.label}>Models (uncheck to hide from dropdown)</div>
              {models.map(m => {
                const disabled = disabledModels.includes(m.id);
                return (
                  <div key={m.id} style={S.modelRow}>
                    <input type="checkbox" checked={!disabled}
                      onChange={() => onToggleModel(m.id)} style={S.checkbox} />
                    <span style={S.modelLabel(disabled)} onClick={() => onToggleModel(m.id)}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
              {customModels.map(id => (
                <div key={id} style={S.modelRow}>
                  <input type="checkbox" checked={!disabledModels.includes(id)}
                    onChange={() => onToggleModel(id)} style={S.checkbox} />
                  <span style={{ ...S.modelLabel(disabledModels.includes(id)), color: 'var(--accent-color)' }}
                    onClick={() => onToggleModel(id)}>
                    {id}
                  </span>
                  <button style={S.removeBtn} onClick={() => onRemoveCustom(id)} title="Remove custom model">x</button>
                </div>
              ))}
              <div style={S.addModelRow}>
                <input value={newModelId} onChange={e => setNewModelId(e.target.value)}
                  placeholder="Add custom model ID..." style={S.addInput}
                  onKeyDown={e => e.key === 'Enter' && handleAddModel()} />
                <button style={S.addBtn} onClick={handleAddModel} disabled={!newModelId.trim()}>
                  + Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AnthropicCard (special) ───────────────────────────────────────────────────

function AnthropicCard() {
  const [open, setOpen] = useState(false);
  return (
    <div style={S.card('#cc785c')}>
      <div style={S.cardHeader} onClick={() => setOpen(v => !v)}>
        <div style={S.cardLeft}><span style={S.dot('#22c55e')} /><span style={S.providerName}>Anthropic</span></div>
        <span style={S.chevron(open)}>▼</span>
      </div>
      {open && (
        <div style={S.body}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Authentication via Claude CLI OAuth. No API key required.</div>
          <div style={S.modelList}>Models: Claude Opus 4, Sonnet 4.5, Haiku 3.5</div>
        </div>
      )}
    </div>
  );
}

// ── OllamaCard ────────────────────────────────────────────────────────────────

function OllamaCard({ baseUrl, onBaseUrlChange }: { baseUrl: string; onBaseUrlChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [test, setTest] = useState<TestState>(IDLE);

  const runTest = useCallback(async () => {
    setTest({ loading: true });
    const result = await testProviderConnection('ollama', '', baseUrl);
    const msg = result.ok ? 'Online' : (result.error ?? 'Offline').slice(0, 80);
    setTest({ loading: false, ok: result.ok, message: msg });
  }, [baseUrl]);

  const dotColor = test.ok === true ? '#22c55e' : test.ok === false ? '#ef4444' : 'rgba(128,132,150,0.4)';

  return (
    <div style={S.card('#888888')}>
      <div style={S.cardHeader} onClick={() => setOpen(v => !v)}>
        <div style={S.cardLeft}><span style={S.dot(dotColor)} /><span style={S.providerName}>Ollama (Local)</span></div>
        <span style={S.chevron(open)}>▼</span>
      </div>
      {open && (
        <div style={S.body}>
          <div>
            <div style={S.label}>Base URL</div>
            <div style={S.row}>
              <input value={baseUrl} onChange={e => onBaseUrlChange(e.target.value)}
                placeholder="http://localhost:11434" style={S.input} />
              <button style={S.testBtn} onClick={runTest} disabled={test.loading}>
                {test.loading && <span style={S.spinner} />}
                Test
              </button>
            </div>
            {test.message && <div style={S.feedback(!!test.ok)}>{test.message}</div>}
          </div>
          <div style={S.modelList}>Models: pulled locally via ollama pull</div>
        </div>
      )}
    </div>
  );
}

// ── CustomCard ────────────────────────────────────────────────────────────────

function CustomCard({ baseUrl, apiKey, onBaseUrlChange, onKeyChange }: {
  baseUrl: string; apiKey: string;
  onBaseUrlChange: (v: string) => void; onKeyChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [test, setTest] = useState<TestState>(IDLE);

  const runTest = useCallback(async () => {
    setTest({ loading: true });
    const result = await testProviderConnection('custom', apiKey, baseUrl);
    const msg = result.ok ? 'Connected' : (result.error ?? 'Failed').slice(0, 80);
    setTest({ loading: false, ok: result.ok, message: msg });
  }, [baseUrl, apiKey]);

  return (
    <div style={S.card('#a855f7')}>
      <div style={S.cardHeader} onClick={() => setOpen(v => !v)}>
        <div style={S.cardLeft}><span style={S.dot(baseUrl ? '#22c55e' : 'rgba(128,132,150,0.4)')} /><span style={S.providerName}>Custom (OpenAI-compatible)</span></div>
        <span style={S.chevron(open)}>▼</span>
      </div>
      {open && (
        <div style={S.body}>
          <div>
            <div style={S.label}>Base URL</div>
            <input value={baseUrl} onChange={e => onBaseUrlChange(e.target.value)}
              placeholder="https://your-endpoint.com" style={S.input} />
          </div>
          <div>
            <div style={S.label}>API Key (optional)</div>
            <div style={S.row}>
              <input type="password" value={apiKey} onChange={e => { onKeyChange(e.target.value); setTest(IDLE); }}
                placeholder="sk-..." style={S.input} autoComplete="off" />
              <button style={S.testBtn} onClick={runTest} disabled={test.loading}>
                {test.loading && <span style={S.spinner} />}
                Test
              </button>
            </div>
            {test.message && <div style={S.feedback(!!test.ok)}>{test.message}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ModelsSettings ────────────────────────────────────────────────────────────

// === Model definitions per provider ===
const PROVIDER_MODELS: Record<string, { id: string; label: string }[]> = {
  openai: [
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
    { id: 'gpt-5.3-codex-spark', label: 'GPT-5.3 Codex Spark' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'o3', label: 'o3' },
    { id: 'o3-pro', label: 'o3 Pro' },
    { id: 'o4-mini', label: 'o4 Mini' },
    { id: 'codex-mini-latest', label: 'Codex Mini' },
  ],
  google: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  ],
  openrouter: [
    { id: 'openai/gpt-4o', label: 'GPT-4o' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick' },
    { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
    { id: 'qwen/qwen3-coder', label: 'Qwen3 Coder' },
    { id: 'minimax/MiniMax-M2.5', label: 'MiniMax M2.5' },
    { id: 'z-ai/glm-4.7-flash', label: 'GLM 4.7 Flash' },
  ],
  minimax: [
    { id: 'MiniMax-M2.5', label: 'MiniMax M2.5' },
    { id: 'MiniMax-M2.5-highspeed', label: 'MiniMax M2.5 HighSpeed' },
    { id: 'MiniMax-M2.1', label: 'MiniMax M2.1' },
  ],
  zai: [
    { id: 'glm-5', label: 'GLM 5' },
    { id: 'glm-4.7', label: 'GLM 4.7' },
    { id: 'glm-4.7-flash', label: 'GLM 4.7 Flash' },
  ],
};

export default function ModelsSettings() {
  const { providerBaseUrl, providerApiKey, openaiApiKey, googleApiKey,
    openrouterApiKey, minimaxApiKey, zaiApiKey,
    disabledModels = [], customModels = {},
  } = useSettingsStore(s => s.claude);
  const updateClaude = useSettingsStore(s => s.updateClaudeSettings);

  const toggleModel = useCallback((modelId: string) => {
    const current = disabledModels || [];
    const next = current.includes(modelId)
      ? current.filter(id => id !== modelId)
      : [...current, modelId];
    updateClaude({ disabledModels: next });
  }, [disabledModels, updateClaude]);

  const addCustomModel = useCallback((provider: string, modelId: string) => {
    const current = { ...(customModels || {}) };
    current[provider] = [...(current[provider] || []), modelId];
    updateClaude({ customModels: current });
  }, [customModels, updateClaude]);

  const removeCustomModel = useCallback((provider: string, modelId: string) => {
    const current = { ...(customModels || {}) };
    current[provider] = (current[provider] || []).filter(id => id !== modelId);
    // Also remove from disabled if it was disabled
    const nextDisabled = (disabledModels || []).filter(id => id !== modelId);
    updateClaude({ customModels: current, disabledModels: nextDisabled });
  }, [customModels, disabledModels, updateClaude]);

  const cardProps = (providerId: string, apiKey: string, onKeyChange: (v: string) => void) => ({
    disabledModels: disabledModels || [],
    onToggleModel: toggleModel,
    customModels: (customModels || {})[providerId] || [],
    onAddCustom: (id: string) => addCustomModel(providerId, id),
    onRemoveCustom: (id: string) => removeCustomModel(providerId, id),
    apiKey, onKeyChange,
  });

  return (
    <div>
      <style>{`@keyframes quack-spin { to { transform: rotate(360deg); } }`}</style>
      <SectionHeader title="LLM Providers" description="Configure API keys and select which models appear in the chat dropdown." />
      <div style={S.container}>
        <AnthropicCard />
        <ProviderCard name="OpenAI" providerId="openai" accentColor="#10a37f"
          models={PROVIDER_MODELS.openai}
          {...cardProps('openai', openaiApiKey ?? '', v => updateClaude({ openaiApiKey: v }))} />
        <ProviderCard name="Google" providerId="google" accentColor="#4285f4"
          models={PROVIDER_MODELS.google}
          {...cardProps('google', googleApiKey ?? '', v => updateClaude({ googleApiKey: v }))} />
        <ProviderCard name="OpenRouter" providerId="openrouter" accentColor="#6366f1"
          models={PROVIDER_MODELS.openrouter}
          {...cardProps('openrouter', openrouterApiKey ?? '', v => updateClaude({ openrouterApiKey: v }))} />
        <ProviderCard name="MiniMax" providerId="minimax" accentColor="#f59e0b"
          models={PROVIDER_MODELS.minimax}
          {...cardProps('minimax', minimaxApiKey ?? '', v => updateClaude({ minimaxApiKey: v }))} />
        <ProviderCard name="GLM / ZAI" providerId="zai" accentColor="#06b6d4"
          models={PROVIDER_MODELS.zai}
          {...cardProps('zai', zaiApiKey ?? '', v => updateClaude({ zaiApiKey: v }))} />
        <OllamaCard baseUrl={providerBaseUrl ?? 'http://localhost:11434'}
          onBaseUrlChange={v => updateClaude({ providerBaseUrl: v })} />
        <CustomCard baseUrl={providerBaseUrl ?? ''} apiKey={providerApiKey ?? ''}
          onBaseUrlChange={v => updateClaude({ providerBaseUrl: v })}
          onKeyChange={v => updateClaude({ providerApiKey: v })} />
      </div>
    </div>
  );
}
