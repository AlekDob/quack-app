import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { TokenStats } from '../../../types';
import ClaudeAuthSettings from '../../ClaudeAuthSettings';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSInput from '../controls/IOSInput';

export default function AIAssistantSettings() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo'>('gpt-4o-mini');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadStats();
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const savedKey = await invoke<string | null>('get_ai_api_key');
      if (savedKey) {
        const decoded = atob(savedKey);
        setApiKey(decoded);
      }

      const savedModel = await invoke<string>('get_ai_model');
      setModel(savedModel as typeof model);
    } catch (err) {
      console.error('Failed to load saved AI settings:', err);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const tokenStats = await invoke<TokenStats>('get_token_usage_stats');
      setStats(tokenStats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSaveAndTest = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('Please enter an API key');
      setTestResult('error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setErrorMessage('Invalid API key format. OpenAI keys start with "sk-"');
      setTestResult('error');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setErrorMessage('');

    try {
      await invoke('save_api_key', { key: apiKey });
      await invoke('set_ai_model', { model });

      const connected = await invoke<boolean>('test_api_connection');

      if (connected) {
        setTestResult('success');
        setErrorMessage('');
      } else {
        setTestResult('error');
        setErrorMessage('Connection test failed. Please check your API key.');
      }
    } catch (err) {
      setTestResult('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  return (
    <div className="settings-category">
      {/* OpenAI Section */}
      <SectionHeader
        title="OpenAI API Key"
        description="Your API key is stored locally and encrypted. Get your key from OpenAI Platform."
      />
      <div className="settings-group">
        <SettingsRow
          label="API Key"
          description="Enter your OpenAI API key (starts with sk-)"
          control={
            <IOSInput
              type="text"
              value={apiKey}
              onChange={setApiKey}
              placeholder="sk-..."
              spellCheck={false}
            />
          }
        />
        <div className="notification-actions">
          <button
            className="ios-button ios-button-primary"
            onClick={handleSaveAndTest}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Save & Test'}
          </button>
        </div>

        {testResult === 'success' && (
          <div className="notification-status success">
            <span className="status-icon">✓</span>
            <span className="status-message">Connected successfully!</span>
          </div>
        )}

        {testResult === 'error' && (
          <div className="notification-status error">
            <span className="status-icon">✕</span>
            <span className="status-message">{errorMessage || 'Connection failed'}</span>
          </div>
        )}
      </div>

      {/* Model Selection */}
      <SectionHeader
        title="AI Model"
        description="Choose the model for AI suggestions. gpt-4o-mini is recommended for best cost/performance."
      />
      <div className="settings-group">
        <div className="ai-model-options">
          <label className="ai-model-option">
            <input
              type="radio"
              name="model"
              value="gpt-4o-mini"
              checked={model === 'gpt-4o-mini'}
              onChange={(e) => setModel(e.target.value as typeof model)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT-4o Mini</div>
              <div className="ai-model-desc">Fast & economical (~$0.15/1M tokens)</div>
              <div className="ai-model-badge ai-model-badge-recommended">Recommended</div>
            </div>
          </label>

          <label className="ai-model-option">
            <input
              type="radio"
              name="model"
              value="gpt-4o"
              checked={model === 'gpt-4o'}
              onChange={(e) => setModel(e.target.value as typeof model)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT-4o</div>
              <div className="ai-model-desc">Most capable (~$2.50/1M tokens)</div>
            </div>
          </label>

          <label className="ai-model-option">
            <input
              type="radio"
              name="model"
              value="gpt-3.5-turbo"
              checked={model === 'gpt-3.5-turbo'}
              onChange={(e) => setModel(e.target.value as typeof model)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT-3.5 Turbo</div>
              <div className="ai-model-desc">Budget option (~$0.50/1M tokens)</div>
            </div>
          </label>
        </div>
      </div>

      {/* Claude Authentication */}
      <SectionHeader title="Claude Integration" />
      <div className="settings-group">
        <ClaudeAuthSettings />
      </div>
    </div>
  );
}
