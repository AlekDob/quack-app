import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ClaudeAuthSettings from '../../ClaudeAuthSettings';
import AuthDebugPanel from '../../AuthDebugPanel';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import { useSettingsStore } from '../../../stores/settingsStore';
import { checkOllamaRunning, fetchOllamaModels, getOllamaModelOptions } from '../../../services/ollamaService';
import type { LLMProviderType, OllamaModel } from '../../../types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export default function ClaudeCodeSettings() {
  const [agentTeamsEnabled, setAgentTeamsEnabled] = useState(false);
  const [autoMemoryEnabled, setAutoMemoryEnabled] = useState(true);
  const [memoryEnvOverride, setMemoryEnvOverride] = useState(false);
  const [loading, setLoading] = useState(true);

  // LLM Provider state
  const { provider, providerBaseUrl, providerApiKey, ollamaModel } = useSettingsStore(s => s.claude);
  const updateClaude = useSettingsStore(s => s.updateClaudeSettings);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);

  useEffect(() => { loadSettings(); }, []);

  // Check Ollama status when provider is 'ollama'
  useEffect(() => {
    if (provider === 'ollama') {
      refreshOllama();
    } else {
      setOllamaOnline(null);
      setOllamaModels([]);
    }
  }, [provider, providerBaseUrl]);

  const loadSettings = async () => {
    try {
      const [envVars, memoryFlag] = await Promise.all([
        invoke<Record<string, string>>('get_claude_env_vars'),
        invoke<boolean | null>('get_claude_settings_flag', { key: 'autoMemoryEnabled' }),
      ]);
      setAgentTeamsEnabled(envVars['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'] === '1');
      setAutoMemoryEnabled(memoryFlag ?? true);
      setMemoryEnvOverride(envVars['CLAUDE_CODE_DISABLE_AUTO_MEMORY'] === '1');
    } catch (err) {
      console.error('Failed to load Claude settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshOllama = useCallback(async () => {
    const url = providerBaseUrl || DEFAULT_OLLAMA_URL;
    const online = await checkOllamaRunning(url);
    setOllamaOnline(online);
    if (online) {
      setOllamaModels(await fetchOllamaModels(url));
    } else {
      setOllamaModels([]);
    }
  }, [providerBaseUrl]);

  const handleToggleAgentTeams = async (enabled: boolean) => {
    setAgentTeamsEnabled(enabled);
    try {
      await invoke('set_claude_env_var', {
        key: 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
        value: enabled ? '1' : null,
      });
    } catch (err) {
      console.error('Failed to save Agent Teams setting:', err);
      setAgentTeamsEnabled(!enabled);
    }
  };

  const handleToggleAutoMemory = async (enabled: boolean) => {
    setAutoMemoryEnabled(enabled);
    try {
      // When enabling, remove the key (Claude Code default is enabled)
      // When disabling, set to false explicitly
      await invoke('set_claude_settings_flag', {
        key: 'autoMemoryEnabled',
        value: enabled ? null : false,
      });
    } catch (err) {
      console.error('Failed to save Auto Memory setting:', err);
      setAutoMemoryEnabled(!enabled);
    }
  };

  const handleProviderChange = (newProvider: LLMProviderType) => {
    updateClaude({ provider: newProvider });
    if (newProvider === 'ollama' && !providerBaseUrl) {
      updateClaude({ providerBaseUrl: DEFAULT_OLLAMA_URL });
    }
  };

  const modelOptions = getOllamaModelOptions(ollamaModels);

  return (
    <div className="settings-category">
      {/* LLM Provider */}
      <SectionHeader
        title="LLM Provider"
        description="Choose between Anthropic API, local Ollama models, or a custom endpoint"
      />
      <div className="settings-group">
        <SettingsRow
          label="Provider"
          description="Ollama enables free local models. Custom supports any OpenAI-compatible endpoint."
          control={
            <select
              className="settings-select"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as LLMProviderType)}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="custom">Custom Endpoint</option>
            </select>
          }
        />

        {provider !== 'anthropic' && (
          <SettingsRow
            label="Base URL"
            description={provider === 'ollama' ? 'Ollama server address' : 'OpenAI-compatible API endpoint'}
            control={
              <input
                className="settings-input"
                type="text"
                value={providerBaseUrl}
                onChange={(e) => updateClaude({ providerBaseUrl: e.target.value })}
                placeholder={provider === 'ollama' ? DEFAULT_OLLAMA_URL : 'https://api.example.com'}
              />
            }
          />
        )}

        {provider === 'custom' && (
          <SettingsRow
            label="API Key"
            description="Authentication key for the custom endpoint"
            control={
              <input
                className="settings-input"
                type="password"
                value={providerApiKey}
                onChange={(e) => updateClaude({ providerApiKey: e.target.value })}
                placeholder="sk-..."
              />
            }
          />
        )}

        {provider === 'ollama' && (
          <>
            <SettingsRow
              label="Status"
              description="Connection to Ollama server"
              control={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 20,
                    backgroundColor: ollamaOnline === null
                      ? 'rgba(102, 102, 102, 0.15)'
                      : ollamaOnline
                        ? 'rgba(0, 217, 255, 0.1)'
                        : 'rgba(255, 68, 68, 0.1)',
                    border: `1px solid ${
                      ollamaOnline === null ? 'rgba(102,102,102,0.3)' :
                      ollamaOnline ? 'rgba(0,217,255,0.25)' : 'rgba(255,68,68,0.25)'
                    }`,
                    transition: 'all 0.3s ease',
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      backgroundColor: ollamaOnline === null ? '#666' : ollamaOnline ? '#00D9FF' : '#ff4444',
                      boxShadow: ollamaOnline ? '0 0 6px rgba(0,217,255,0.5)' : 'none',
                      transition: 'all 0.3s ease',
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                      {ollamaOnline === null ? 'Checking' : ollamaOnline ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <button
                    onClick={refreshOllama}
                    title="Refresh connection"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, display: 'flex', alignItems: 'center',
                      color: 'var(--text-secondary)', opacity: 0.6,
                      transition: 'opacity 0.2s ease, transform 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'rotate(45deg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                    </svg>
                  </button>
                </div>
              }
            />
            <SettingsRow
              label="Model"
              description="Select an installed model or type a name"
              control={
                ollamaModels.length > 0 ? (
                  <select
                    className="settings-select"
                    value={ollamaModel}
                    onChange={(e) => updateClaude({ ollamaModel: e.target.value })}
                  >
                    <option value="">-- Select model --</option>
                    {modelOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="settings-input"
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => updateClaude({ ollamaModel: e.target.value })}
                    placeholder="e.g. qwen3-coder"
                  />
                )
              }
            />
          </>
        )}

        {provider === 'custom' && (
          <SettingsRow
            label="Model"
            description="Model name for the custom endpoint"
            control={
              <input
                className="settings-input"
                type="text"
                value={ollamaModel}
                onChange={(e) => updateClaude({ ollamaModel: e.target.value })}
                placeholder="e.g. gpt-4o, llama-3.3-70b"
              />
            }
          />
        )}

        {provider !== 'anthropic' && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '8px 12px', margin: '12px 12px', borderRadius: 8,
            backgroundColor: 'rgba(242, 140, 82, 0.06)',
            border: '1px solid rgba(242, 140, 82, 0.12)',
          }}>
            <span style={{ fontSize: 13, lineHeight: '18px', flexShrink: 0, opacity: 0.7 }}>⚠</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, opacity: 0.8 }}>
              Non-Claude models may have reduced context, no extended thinking, and variable tool-use quality.
            </span>
          </div>
        )}
      </div>

      {/* Claude Authentication (only for Anthropic) */}
      {provider === 'anthropic' && (
        <>
          <SectionHeader
            title="Claude Integration"
            description="Authenticate with Claude to enable AI-powered features"
          />
          <div className="settings-group">
            <ClaudeAuthSettings />
          </div>
        </>
      )}

      {/* Memory */}
      <SectionHeader
        title="Memory"
        description="Claude automatically saves patterns, preferences, and insights across sessions"
      />
      <div className="settings-group">
        <SettingsRow
          label="Auto Memory"
          description={
            memoryEnvOverride
              ? <span>Overridden by <code style={{ fontSize: 10 }}>CLAUDE_CODE_DISABLE_AUTO_MEMORY</code> env var</span>
              : 'Claude saves useful context to a persistent memory directory'
          }
          control={
            <IOSSwitch
              checked={autoMemoryEnabled && !memoryEnvOverride}
              onChange={handleToggleAutoMemory}
              disabled={loading || memoryEnvOverride}
            />
          }
        />
      </div>

      {/* Experimental Features */}
      <SectionHeader
        title="Experimental Features"
        description="Enable experimental Claude Code features"
      />
      <div className="settings-group">
        <SettingsRow
          label="Agent Teams"
          description="Coordinate multiple Claude Code sessions working in parallel as a team."
          control={
            <IOSSwitch
              checked={agentTeamsEnabled}
              onChange={handleToggleAgentTeams}
              disabled={loading}
            />
          }
        />
      </div>

      {/* Debug Panel */}
      <SectionHeader
        title="Authentication Debug"
        description="Diagnostic information for troubleshooting"
      />
      <div className="settings-group">
        <AuthDebugPanel />
      </div>
    </div>
  );
}
