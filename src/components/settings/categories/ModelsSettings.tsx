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
  isSpecial, statusOverride, children,
}: {
  name: string; providerId: string; apiKey: string;
  onKeyChange: (k: string) => void; models: string[];
  accentColor: string; isSpecial?: boolean;
  statusOverride?: 'active' | 'unconfigured'; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [test, setTest] = useState<TestState>(IDLE);

  const dotColor = statusOverride === 'active' || (!isSpecial && apiKey.length > 0)
    ? '#22c55e' : 'rgba(128,132,150,0.4)';

  const handleKeyChange = (k: string) => { onKeyChange(k); setTest(IDLE); };

  const runTest = useCallback(async () => {
    setTest({ loading: true });
    const result = await testProviderConnection(providerId, apiKey);
    const msg = result.ok ? 'Connected' : (result.error ?? 'Failed').slice(0, 80);
    setTest({ loading: false, ok: result.ok, message: msg });
  }, [providerId, apiKey]);

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
            <>
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
            </>
          )}
          {models.length > 0 && (
            <div style={S.modelList}>
              Models: {models.join(', ')}
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

export default function ModelsSettings() {
  const { providerBaseUrl, providerApiKey, openaiApiKey, googleApiKey,
    openrouterApiKey, minimaxApiKey, zaiApiKey } = useSettingsStore(s => s.claude);
  const updateClaude = useSettingsStore(s => s.updateClaudeSettings);

  return (
    <div>
      <style>{`@keyframes quack-spin { to { transform: rotate(360deg); } }`}</style>
      <SectionHeader title="LLM Providers" description="Configure API keys for each provider. Keys are stored locally." />
      <div style={S.container}>
        <AnthropicCard />
        <ProviderCard name="OpenAI" providerId="openai" apiKey={openaiApiKey ?? ''} accentColor="#10a37f" onKeyChange={v => updateClaude({ openaiApiKey: v })} models={['GPT-5.3 Codex', 'GPT-4.1', 'GPT-4o', 'o3', 'o4-mini', 'Codex Mini']} />
        <ProviderCard name="Google" providerId="google" apiKey={googleApiKey ?? ''} accentColor="#4285f4" onKeyChange={v => updateClaude({ googleApiKey: v })} models={['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 2.5 Flash Lite']} />
        <ProviderCard name="OpenRouter" providerId="openrouter" apiKey={openrouterApiKey ?? ''} accentColor="#6366f1" onKeyChange={v => updateClaude({ openrouterApiKey: v })} models={['100+ aggregated models']} />
        <ProviderCard name="MiniMax" providerId="minimax" apiKey={minimaxApiKey ?? ''} accentColor="#f59e0b" onKeyChange={v => updateClaude({ minimaxApiKey: v })} models={['MiniMax M2.5', 'MiniMax M2.5 HighSpeed', 'MiniMax M2.1']} />
        <ProviderCard name="GLM / ZAI" providerId="zai" apiKey={zaiApiKey ?? ''} accentColor="#06b6d4" onKeyChange={v => updateClaude({ zaiApiKey: v })} models={['GLM-5', 'GLM-4.7', 'GLM-4.7 Flash']} />
        <OllamaCard baseUrl={providerBaseUrl ?? 'http://localhost:11434'}
          onBaseUrlChange={v => updateClaude({ providerBaseUrl: v })} />
        <CustomCard baseUrl={providerBaseUrl ?? ''} apiKey={providerApiKey ?? ''}
          onBaseUrlChange={v => updateClaude({ providerBaseUrl: v })}
          onKeyChange={v => updateClaude({ providerApiKey: v })} />
      </div>
    </div>
  );
}
