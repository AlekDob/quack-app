import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ClaudeCredentials {
  auth_type: 'oauth' | 'apikey';
  token: string;
}

export default function ClaudeAuthSettings() {
  const [cliCredentials, setCliCredentials] = useState<ClaudeCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentialsPath, setCredentialsPath] = useState<string | null>(null);
  const [cliAvailable, setCliAvailable] = useState<boolean | null>(null);

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
      {/* Claude CLI Status */}
      <div className="auth-section cli-status-section">
        <div className="section-header">
          <h3>Claude Code CLI Status</h3>
          {cliAvailable !== null && (
            <div className={`status-badge ${cliAvailable ? 'status-success' : 'status-error'}`}>
              <span className="status-dot" />
              {cliAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}
            </div>
          )}
        </div>
        {cliAvailable ? (
          <div className="auth-info">
            <p className="info-text">
              Claude Code CLI is installed and authenticated. The chat will use your CLI credentials automatically.
            </p>
          </div>
        ) : (
          <div className="auth-info warning-info">
            <p className="info-text">
              Claude Code CLI is not available or not authenticated.
              <br />
              To enable chat features, please authenticate Claude Code from your terminal:
              <ol>
                <li>Run: <code>claude /login</code></li>
                <li>Follow the authentication process</li>
                <li>Restart Quack to detect the credentials</li>
              </ol>
            </p>
          </div>
        )}
      </div>

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
                <span className="detail-value credential-path">{credentialsPath}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
