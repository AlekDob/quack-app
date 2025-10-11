import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [cliAvailable, setCliAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuthentication();

    // Listen for OAuth success
    const unlistenSuccess = listen<{ access_token: string }>('claude-oauth-success', async (event) => {
      console.log('OAuth success:', event.payload);
      setOAuthLoading(false);

      // Save the token
      try {
        await invoke('set_claude_api_key', { key: event.payload.access_token });
        setMessage({ type: 'success', text: 'OAuth authentication successful!' });
        await checkAuthentication();
      } catch (error) {
        console.error('Failed to save OAuth token:', error);
        setMessage({ type: 'error', text: 'Failed to save OAuth token' });
      }
    });

    // Listen for OAuth errors
    const unlistenError = listen<string>('claude-oauth-error', (event) => {
      console.error('OAuth error:', event.payload);
      setOAuthLoading(false);
      setMessage({ type: 'error', text: `OAuth failed: ${event.payload}` });
    });

    return () => {
      unlistenSuccess.then(fn => fn());
      unlistenError.then(fn => fn());
    };
  }, []);

  const checkAuthentication = async () => {
    setLoading(true);
    try {
      // Check if Claude CLI is available
      const cliAvail = await invoke<boolean>('check_claude_cli_available');
      setCliAvailable(cliAvail);

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

  const handleOAuthLogin = async () => {
    setOAuthLoading(true);
    setMessage(null);

    try {
      await invoke('start_claude_oauth');
      setMessage({ type: 'success', text: 'Opening browser for authentication...' });
    } catch (error) {
      console.error('Failed to start OAuth flow:', error);
      setMessage({ type: 'error', text: 'Failed to start OAuth flow' });
      setOAuthLoading(false);
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

      {/* Claude CLI Status */}
      <div className="auth-section cli-status-section">
        <div className="section-header">
          <h3>Claude Code CLI Status</h3>
          {cliAvailable !== null && (
            <div className={`status-badge ${cliAvailable ? 'status-success' : 'status-error'}`}>
              <span className="status-dot" />
              {cliAvailable ? 'Available' : 'Not Available'}
            </div>
          )}
        </div>
        {cliAvailable ? (
          <div className="auth-info">
            <p className="info-text">
              ✓ Claude Code CLI is installed and authenticated. The chat will use your CLI credentials automatically.
            </p>
          </div>
        ) : (
          <div className="auth-info warning-info">
            <p className="info-text">
              ⚠️ Claude Code CLI is not available or not authenticated.
              <br />
              To enable chat features, please:
              <ol>
                <li>Install Claude Code CLI: <code>npm install -g claude-code</code></li>
                <li>Login with your account: <code>claude auth login</code></li>
              </ol>
            </p>
          </div>
        )}
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

      {/* OAuth Login Section */}
      <div className="auth-section oauth-login-section">
        <div className="section-header">
          <h3>🔐 OAuth Authentication (Recommended)</h3>
        </div>
        <p className="auth-info-text">
          Log in with your Claude account for seamless authentication.
        </p>
        <button
          type="button"
          className="btn btn-primary oauth-button"
          onClick={handleOAuthLogin}
          disabled={oauthLoading}
        >
          {oauthLoading ? (
            <>
              <span className="spinner" /> Waiting for authentication...
            </>
          ) : (
            <>
              <span className="oauth-icon">🔑</span> Login with Claude
            </>
          )}
        </button>
      </div>

      {/* Manual API Key Section */}
      <div className="auth-section manual-section">
        <div className="section-header">
          <h3>Manual API Key (Alternative)</h3>
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
