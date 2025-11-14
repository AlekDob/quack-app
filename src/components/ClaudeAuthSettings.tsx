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
  const [credentialsPath, setCredentialsPath] = useState<string | null>(null);
  const [cliAvailable, setCliAvailable] = useState<boolean | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    checkAuthentication();
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

      setCliCredentials(cliCreds);

      // Check if ANTHROPIC_API_KEY is set (via Tauri command)
      // Note: We can't directly access process.env from frontend, but we can infer from CLI credentials
      setHasApiKey(false); // We'll add a Tauri command for this later
    } catch (error) {
      console.error('Failed to check authentication:', error);
    } finally {
      setLoading(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}`;
  };

  const openCredentialsFile = async () => {
    if (!credentialsPath) return;

    try {
      await invoke('open_file_externally', { path: credentialsPath });
    } catch (error) {
      console.error('Failed to open credentials file:', error);
      alert(`Failed to open file: ${error}`);
    }
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
      <div className="auth-section">
        <h3 className="section-title">Authentication Status</h3>

        <div className="auth-status-grid">
          <div className="status-card">
            <div className="status-header">
              <span className={`status-dot ${cliAvailable ? 'active' : ''}`} />
              <span className="status-label">Claude CLI</span>
            </div>
            <p className="status-text">
              {cliAvailable ? 'CLI installed and available' : 'Not configured'}
            </p>
            {cliCredentials && (
              <p className="status-detail">
                Type: {cliCredentials.auth_type.toUpperCase()}
              </p>
            )}
          </div>

          <div className="status-card">
            <div className="status-header">
              <span className={`status-dot ${hasApiKey ? 'active' : ''}`} />
              <span className="status-label">API Key</span>
            </div>
            <p className="status-text">
              {hasApiKey ? 'ANTHROPIC_API_KEY is set' : 'Not configured'}
            </p>
          </div>
        </div>
      </div>

      {!cliCredentials && !hasApiKey && (
        <div className="auth-section">
          <h3 className="section-title">Setup Authentication</h3>

          <div className="setup-method">
            <h4>Claude Code CLI</h4>
            <ol>
              <li>Install: <code>npm install -g @anthropic-ai/claude-code</code></li>
              <li>Run: <code>claude /login</code></li>
              <li>Restart Quack</li>
            </ol>
          </div>

          <div className="setup-method">
            <h4>API Key</h4>
            <ol>
              <li>Get key from <code>console.anthropic.com</code></li>
              <li>Set environment variable:
                <pre>export ANTHROPIC_API_KEY="sk-ant-..."</pre>
              </li>
              <li>Restart Quack</li>
            </ol>
          </div>
        </div>
      )}

      {/* Authenticated Details */}
      {cliCredentials && (
        <div className="auth-section oauth-section">
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
                <div className="detail-value-with-action">
                  <span className="detail-value credential-path">{credentialsPath}</span>
                  <button
                    onClick={openCredentialsFile}
                    className="open-file-button-inline"
                    title="Open credentials file"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
