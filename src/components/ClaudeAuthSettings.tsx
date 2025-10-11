import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './ClaudeAuthSettings.css';

interface ClaudeCredentials {
  auth_type: 'oauth' | 'apikey';
  token: string;
}

export default function ClaudeAuthSettings() {
  const [cliCredentials, setCliCredentials] = useState<ClaudeCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [credentialsPath, setCredentialsPath] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // Check for Claude CLI credentials
      const cliCreds = await invoke<ClaudeCredentials | null>('get_claude_cli_credentials');

      // Get credentials file path
      const credsPath = await invoke<string | null>('get_credentials_path');
      setCredentialsPath(credsPath);

      setCliCredentials(cliCreds);

      if (cliCreds) {
        setShowApiKeyInput(false);
      }
    } catch (error) {
      console.error('Failed to check authentication:', error);
      setMessage({ type: 'error', text: 'Failed to check authentication status' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid API key' });
      return;
    }

    setSavingApiKey(true);
    setMessage(null);

    try {
      await invoke('save_claude_credentials', { apiKey: apiKey.trim() });
      setMessage({ type: 'success', text: 'API key saved successfully!' });
      setApiKey('');
      setShowApiKeyInput(false);

      // Recheck authentication
      await checkAuthentication();
    } catch (error) {
      console.error('Failed to save API key:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save API key' });
    } finally {
      setSavingApiKey(false);
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
        <p className="auth-subtitle">Uses your existing Claude Code CLI credentials</p>
      </div>

      {/* CLI Credentials Status */}
      {cliCredentials ? (
        <div className="auth-section oauth-section">
          <div className="section-header">
            <div className="status-badge status-success">
              <span className="status-dot" />
              ✓ Authenticated
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
              ✓ Using Claude CLI credentials from your keychain. Both CLI and Agent modes will use these credentials automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="auth-section warning-section">
          <div className="warning-banner">
            <span className="warning-icon">⚠️</span>
            <div className="warning-content">
              <h4>No Authentication Found</h4>
              <p>Choose one of the following methods:</p>

              {/* Method 1: Claude CLI Login */}
              <div className="auth-method">
                <h5>Method 1: Claude Code CLI (Recommended)</h5>
                <p>Run in your terminal:</p>
                <code className="auth-command">claude login</code>
                <p className="auth-note">
                  Uses your Claude Max subscription (no separate API billing needed!)
                </p>
                <button
                  className="refresh-auth-button"
                  onClick={checkAuthentication}
                  disabled={loading}
                >
                  🔄 {loading ? 'Checking...' : 'Refresh Status'}
                </button>
              </div>

              {/* Method 2: API Key */}
              {!showApiKeyInput ? (
                <div className="auth-method">
                  <h5>Method 2: Use API Key</h5>
                  <button
                    className="show-api-input-button"
                    onClick={() => setShowApiKeyInput(true)}
                  >
                    Enter API Key Instead
                  </button>
                </div>
              ) : (
                <div className="auth-method api-key-section">
                  <h5>Method 2: Enter API Key</h5>
                  <p className="auth-note">
                    Get your API key from{' '}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      console.anthropic.com
                    </a>
                  </p>
                  <div className="api-key-input-wrapper">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="api-key-input"
                      disabled={savingApiKey}
                    />
                    <button
                      className="save-api-key-button"
                      onClick={handleSaveApiKey}
                      disabled={savingApiKey || !apiKey.trim()}
                    >
                      {savingApiKey ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
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
        <h3>How It Works</h3>
        <div className="help-grid">
          <div className="help-item">
            <h4>🔐 Claude CLI Authentication</h4>
            <p>
              Quack automatically uses your existing <code>claude login</code> credentials from the system keychain.
              No additional setup needed!
            </p>
          </div>
          <div className="help-item">
            <h4>💰 Uses Your Max Subscription</h4>
            <p>
              If you have Claude Max, you can use the SDK without a separate API billing account.
              Just <code>unset ANTHROPIC_API_KEY</code> and run <code>claude -p</code> to ensure it's working.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
