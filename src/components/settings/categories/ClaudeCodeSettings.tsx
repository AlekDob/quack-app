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
  const [bedrockEnabled, setBedrockEnabled] = useState(false);
  const [autoMemoryEnabled, setAutoMemoryEnabled] = useState(true);
  const [memoryEnvOverride, setMemoryEnvOverride] = useState(false);
  const [loading, setLoading] = useState(true);

  // LLM Provider state
  const { provider, providerBaseUrl, providerApiKey, ollamaModel, btwModel, bedrockModelOverride, openaiApiKey, googleApiKey, openrouterApiKey, minimaxApiKey, zaiApiKey } = useSettingsStore(s => s.claude);
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
      setBedrockEnabled(envVars['CLAUDE_CODE_USE_BEDROCK'] === '1');
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

  const handleToggleBedrock = async (enabled: boolean) => {
    setBedrockEnabled(enabled);
    try {
      await invoke('set_claude_env_var', {
        key: 'CLAUDE_CODE_USE_BEDROCK',
        value: enabled ? '1' : null,
      });
    } catch (err) {
      console.error('Failed to save Bedrock setting:', err);
      setBedrockEnabled(!enabled);
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
      {/* LLM Provider — moved to Settings > Models */}
      <SectionHeader
        title="LLM Provider"
        description="Provider and API key configuration has moved to the Models tab"
      />
      <div className="settings-group">
        <SettingsRow
          label="Active Provider"
          description={`Currently using: ${provider === 'anthropic' ? 'Anthropic (Claude)' : provider}`}
          control={
            <span style={{
              fontSize: 12, color: 'var(--accent-color)', fontWeight: 600,
              cursor: 'default',
            }}>
              Configure in Models tab
            </span>
          }
        />
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

      {/* BTW Side-Chain */}
      <SectionHeader
        title="BTW Side-Chain"
        description="Quick questions drawer — ask without interrupting the main session"
      />
      <div className="settings-group">
        <SettingsRow
          label="Model"
          description="AI model for BTW quick responses (lighter = faster)"
          control={
            <select
              className="settings-select"
              value={btwModel}
              onChange={(e) => updateClaude({ btwModel: e.target.value })}
            >
              <option value="haiku45">Haiku 4.5</option>
              <option value="sonnet46">Sonnet 4.6</option>
              <option value="opus46">Opus 4.6</option>
            </select>
          }
        />
      </div>

      {/* Cloud Provider — always visible, applies to Claude Code SDK agents */}
      <SectionHeader
        title="Cloud Provider"
        description="Route Claude Code agent calls through your own AWS Bedrock account"
      />
      <div className="settings-group">
        <SettingsRow
          label="Use AWS Bedrock"
          description="Sets CLAUDE_CODE_USE_BEDROCK=1 so agents route through your AWS account"
          control={
            <IOSSwitch
              checked={bedrockEnabled}
              onChange={handleToggleBedrock}
              disabled={loading}
            />
          }
        />
        {/* Brain: fix-bedrock-model-override */}
        {bedrockEnabled && (
          <>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 12px', margin: '4px 12px 0', borderRadius: 8,
              backgroundColor: 'rgba(0, 217, 255, 0.06)',
              border: '1px solid rgba(0, 217, 255, 0.12)',
            }}>
              <span style={{ fontSize: 13, lineHeight: '18px', flexShrink: 0, opacity: 0.7 }}>&#x2139;</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, opacity: 0.8 }}>
                Requires valid AWS credentials (AWS_PROFILE, AWS_REGION, etc.) configured in your shell.
                Restart active sessions for changes to take effect.
              </span>
            </div>
            <SettingsRow
              label="Model Override"
              description="Override the model sent to Bedrock. Paste a Bedrock model ID or full ARN. Leave empty to use the default model selection."
              control={
                <input
                  className="settings-input"
                  type="text"
                  value={bedrockModelOverride}
                  onChange={(e) => updateClaude({ bedrockModelOverride: e.target.value })}
                  placeholder="e.g. us.anthropic.claude-sonnet-4-5-20250929-v1:0"
                  style={{ fontSize: 11 }}
                />
              }
            />
            {bedrockModelOverride?.trim() && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 12px', margin: '0 12px 12px', borderRadius: 8,
                backgroundColor: 'rgba(0, 217, 255, 0.06)',
                border: '1px solid rgba(0, 217, 255, 0.12)',
              }}>
                <span style={{ fontSize: 13, lineHeight: '18px', flexShrink: 0, opacity: 0.7 }}>&#x2713;</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, opacity: 0.8 }}>
                  All agents will use <code style={{ fontSize: 10, backgroundColor: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>{bedrockModelOverride.trim()}</code> regardless of model selection.
                </span>
              </div>
            )}
            {!bedrockModelOverride?.trim() && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 12px', margin: '0 12px 12px', borderRadius: 8,
                backgroundColor: 'rgba(var(--accent-rgb), 0.06)',
                border: '1px solid rgba(var(--accent-rgb), 0.12)',
              }}>
                <span style={{ fontSize: 13, lineHeight: '18px', flexShrink: 0, opacity: 0.7 }}>&#x26A0;</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, opacity: 0.8 }}>
                  Some models (e.g. Opus 4.6, Sonnet 4.6) may not be available on Bedrock yet.
                  If you get "model identifier is invalid", paste the correct Bedrock model ID above.
                </span>
              </div>
            )}
          </>
        )}
      </div>

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
