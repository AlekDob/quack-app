import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ClaudeCredentials {
  auth_type: 'oauth' | 'apikey';
  token: string;
}

type AuthMode = 'oauth' | 'manual' | 'none';

export default function ClaudeAuthSettings() {
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [cliCredentials, setCliCredentials] = useState<ClaudeCredentials | null>(null);
  const [manualApiKey, setManualApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [credentialsPath, setCredentialsPath] = useState<string | null>(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    setLoading(true);
    try {
      // Check for Claude CLI credentials (OAuth)
      const cliCreds = await invoke<ClaudeCredentials | null>('get_claude_cli_credentials');

      // Get credentials file path
      const credsPath = await invoke<string | null>('get_credentials_path');
      setCredentialsPath(credsPath);

      // Check for saved manual API key
      const savedKey = await invoke<string | null>('get_claude_api_key');

      setCliCredentials(cliCreds);

      if (cliCreds) {
        setAuthMode('oauth');
        setSavedApiKey('');
      } else if (savedKey) {
        setAuthMode('manual');
        setSavedApiKey(savedKey);
        setManualApiKey(savedKey);
      } else {
        setAuthMode('none');
        setSavedApiKey('');
      }
    } catch (error) {
      console.error('Failed to check authentication:', error);
      setMessage({ type: 'error', text: 'Failed to check authentication status' });
      setAuthMode('none');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualKey = async () => {
    if (!manualApiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await invoke('set_claude_api_key', { key: manualApiKey.trim() });
      setSavedApiKey(manualApiKey.trim());
      setMessage({ type: 'success', text: 'API key saved successfully' });
      setAuthMode('manual');
    } catch (error) {
      console.error('Failed to save API key:', error);
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleClearManualKey = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await invoke('set_claude_api_key', { key: '' });
      setManualApiKey('');
      setSavedApiKey('');
      setMessage({ type: 'success', text: 'API key cleared' });

      // Re-check if OAuth credentials are available
      await checkAuthentication();
    } catch (error) {
      console.error('Failed to clear API key:', error);
      setMessage({ type: 'error', text: 'Failed to clear API key' });
    } finally {
      setSaving(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="claude-auth-settings">
        <div className="auth-loading">
          <div className="spinner" />
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="claude-auth-settings">
      <div className="auth-header">
        <h2>🦆 Claude Authentication</h2>
        <p className="auth-subtitle">Configure how to authenticate with Claude API</p>
      </div>

      {/* OAuth Status */}
      {cliCredentials && (
        <div className="auth-section oauth-section">
          <div className="section-header">
            <div className="status-badge status-success">
              <span className="status-dot" />
              Authenticated via Claude CLI
            </div>
          </div>
          <div className="auth-details">
            <div className="detail-row">
              <span className="detail-label">Auth Type:</span>
              <span className="detail-value">{cliCredentials.auth_type.toUpperCase()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Token:</span>
              <span className="detail-value token-masked">{maskApiKey(cliCredentials.token)}</span>
            </div>
            {credentialsPath && (
              <div className="detail-row">
                <span className="detail-label">Source:</span>
                <span className="detail-value credential-path">{credentialsPath}</span>
              </div>
            )}
          </div>
          <div className="auth-info">
            <p className="info-text">
              ✓ Using Claude CLI credentials. The app will automatically use your CLI authentication.
            </p>
          </div>
        </div>
      )}

      {/* Manual API Key Section */}
      <div className="auth-section manual-section">
        <div className="section-header">
          <h3>Manual API Key</h3>
          {!cliCredentials && authMode === 'manual' && (
            <div className="status-badge status-active">
              <span className="status-dot" />
              Active
            </div>
          )}
        </div>

        {authMode === 'manual' && savedApiKey && (
          <div className="auth-details saved-key">
            <div className="detail-row">
              <span className="detail-label">Saved Key:</span>
              <span className="detail-value token-masked">{maskApiKey(savedApiKey)}</span>
            </div>
          </div>
        )}

        <div className="api-key-input-group">
          <label htmlFor="claude-api-key">
            Enter your Claude API Key
            {cliCredentials && (
              <span className="label-note">(Will override CLI credentials)</span>
            )}
          </label>
          <input
            id="claude-api-key"
            type="password"
            className="api-key-input"
            placeholder="sk-ant-..."
            value={manualApiKey}
            onChange={(e) => setManualApiKey(e.target.value)}
            disabled={saving}
          />
          <div className="input-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveManualKey}
              disabled={saving || !manualApiKey.trim()}
            >
              {saving ? 'Saving...' : 'Save API Key'}
            </button>
            {savedApiKey && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClearManualKey}
                disabled={saving}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="auth-info">
          <p className="info-text">
            Get your API key from{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="info-link"
            >
              Anthropic Console
            </a>
          </p>
        </div>
      </div>

      {/* No Authentication Warning */}
      {authMode === 'none' && (
        <div className="auth-section warning-section">
          <div className="warning-banner">
            <span className="warning-icon">⚠️</span>
            <div className="warning-content">
              <h4>No Authentication Configured</h4>
              <p>
                Please configure authentication to use Claude chat features.
                You can either use Claude CLI authentication or enter a manual API key.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`auth-message ${message.type}`}>
          {message.type === 'success' ? '✓' : '✗'} {message.text}
        </div>
      )}

      {/* Help Section */}
      <div className="auth-section help-section">
        <h3>Authentication Methods</h3>
        <div className="help-grid">
          <div className="help-item">
            <h4>🔐 Claude CLI (Recommended)</h4>
            <p>
              Use <code>claude-code auth login</code> to authenticate via OAuth.
              Your credentials will be automatically detected from the keychain.
            </p>
          </div>
          <div className="help-item">
            <h4>🔑 Manual API Key</h4>
            <p>
              Enter your API key manually. This is useful if you prefer direct API access
              or don't use Claude CLI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
